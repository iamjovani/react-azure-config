/**
 * Enhanced Multi-Level Cache Manager
 * 
 * Provides intelligent caching for configuration sources with change detection,
 * TTL-based invalidation, and source-specific cache strategies.
 * 
 * @module enhanced-cache
 */

import { logger } from './utils/logger';
import { DEFAULT_CONSTANTS } from './constants';

interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  source: string;
  hash?: string;
}

interface CacheLayer {
  name: string;
  ttl: number;
  maxSize: number;
  entries: Map<string, CacheEntry>;
}

interface EnvironmentSnapshot {
  hash: string;
  timestamp: number;
  variables: Record<string, string | undefined>;
}

export class EnhancedCacheManager {
  private layers: Map<string, CacheLayer>;
  private environmentSnapshot: EnvironmentSnapshot | null = null;
  private envVarPrefix: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    evictions: 0
  };

  constructor(envVarPrefix: string = 'REACT_APP') {
    this.envVarPrefix = envVarPrefix;
    this.layers = new Map();
    
    // Initialize cache layers with different TTLs
    this.initializeCacheLayers();
    this.captureEnvironmentSnapshot();
    this.startCleanupInterval();
  }

  private initializeCacheLayers(): void {
    // Azure configuration cache (long TTL, external service)
    this.layers.set('azure', {
      name: 'azure',
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 100,
      entries: new Map()
    });

    // Environment variables cache (medium TTL, change-sensitive)
    this.layers.set('env-vars', {
      name: 'env-vars',
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 200,
      entries: new Map()
    });

    // File-based configuration cache (short TTL, file-sensitive)
    this.layers.set('env-files', {
      name: 'env-files',
      ttl: 2 * 60 * 1000, // 2 minutes
      maxSize: 50,
      entries: new Map()
    });

    // Merged configuration cache (shortest TTL)
    this.layers.set('merged', {
      name: 'merged',
      ttl: 1 * 60 * 1000, // 1 minute
      maxSize: 100,
      entries: new Map()
    });

    logger.debug('Initialized enhanced cache layers:', Array.from(this.layers.keys()));
  }

  /**
   * Get value from cache with automatic layer selection
   */
  get<T>(key: string, layerName?: string): T | null {
    const layer = layerName ? this.layers.get(layerName) : this.findBestLayer(key);
    if (!layer) {
      this.stats.misses++;
      return null;
    }

    const entry = layer.entries.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      layer.entries.delete(key);
      this.stats.misses++;
      return null;
    }

    // Check environment variable changes for env-sensitive caches
    if (this.isEnvironmentSensitive(layer.name) && this.hasEnvironmentChanged()) {
      this.invalidateEnvironmentSensitiveCaches();
      this.stats.invalidations++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache with appropriate layer
   */
  set<T>(key: string, value: T, source: string, layerName?: string, customTtl?: number): void {
    const layer = layerName ? this.layers.get(layerName) : this.selectLayerForSource(source);
    if (!layer) {
      logger.warn(`No cache layer found for key "${key}" and source "${source}"`);
      return;
    }

    // Handle cache size limits
    if (layer.entries.size >= layer.maxSize) {
      this.evictOldestEntries(layer, Math.floor(layer.maxSize * 0.2)); // Evict 20%
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: customTtl || layer.ttl,
      source,
      hash: this.generateValueHash(value)
    };

    layer.entries.set(key, entry);
    logger.debug(`Cached "${key}" in layer "${layer.name}" with TTL ${entry.ttl}ms`);
  }

  /**
   * Invalidate cache entries by pattern or layer
   */
  invalidate(pattern?: string, layerName?: string): number {
    let invalidated = 0;

    if (layerName) {
      const layer = this.layers.get(layerName);
      if (layer) {
        if (pattern) {
          const regex = new RegExp(pattern);
          for (const [key] of layer.entries) {
            if (regex.test(key)) {
              layer.entries.delete(key);
              invalidated++;
            }
          }
        } else {
          invalidated = layer.entries.size;
          layer.entries.clear();
        }
      }
    } else {
      // Invalidate across all layers
      for (const layer of this.layers.values()) {
        if (pattern) {
          const regex = new RegExp(pattern);
          for (const [key] of layer.entries) {
            if (regex.test(key)) {
              layer.entries.delete(key);
              invalidated++;
            }
          }
        } else {
          invalidated += layer.entries.size;
          layer.entries.clear();
        }
      }
    }

    this.stats.invalidations += invalidated;
    logger.debug(`Invalidated ${invalidated} cache entries`, { pattern, layerName });
    return invalidated;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    for (const layer of this.layers.values()) {
      layer.entries.clear();
    }
    this.stats.invalidations++;
    logger.info('Cleared all cache layers');
  }

  /**
   * Check for environment variable changes and update snapshot
   */
  checkEnvironmentChanges(): boolean {
    const hasChanged = this.hasEnvironmentChanged();
    if (hasChanged) {
      this.captureEnvironmentSnapshot();
      this.invalidateEnvironmentSensitiveCaches();
      logger.info('Environment variables changed, invalidated sensitive caches');
    }
    return hasChanged;
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const layerStats = Array.from(this.layers.entries()).map(([name, layer]) => ({
      name,
      size: layer.entries.size,
      maxSize: layer.maxSize,
      ttl: layer.ttl,
      utilization: Math.round((layer.entries.size / layer.maxSize) * 100)
    }));

    return {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100) 
        : 0,
      layers: layerStats,
      environmentHash: this.environmentSnapshot?.hash,
      lastEnvironmentUpdate: this.environmentSnapshot?.timestamp
    };
  }

  /**
   * Warm cache with provided data
   */
  warmCache(data: Record<string, { value: any; source: string; layer?: string }>): void {
    let warmed = 0;
    for (const [key, config] of Object.entries(data)) {
      this.set(key, config.value, config.source, config.layer);
      warmed++;
    }
    logger.info(`Warmed cache with ${warmed} entries`);
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('Enhanced cache manager destroyed');
  }

  // Private helper methods
  private findBestLayer(key: string): CacheLayer | undefined {
    // Prioritize by most specific layer first
    if (key.includes('azure')) return this.layers.get('azure');
    if (key.includes('env-var')) return this.layers.get('env-vars');
    if (key.includes('env-file')) return this.layers.get('env-files');
    return this.layers.get('merged');
  }

  private selectLayerForSource(source: string): CacheLayer | undefined {
    switch (source) {
      case 'azure':
        return this.layers.get('azure');
      case 'app-env-vars':
      case 'generic-env-vars':
      case 'process-env-direct':
        return this.layers.get('env-vars');
      case 'app-env-file':
      case 'root-env-file':
        return this.layers.get('env-files');
      default:
        return this.layers.get('merged');
    }
  }

  private isEnvironmentSensitive(layerName: string): boolean {
    return ['env-vars', 'merged'].includes(layerName);
  }

  private captureEnvironmentSnapshot(): void {
    const relevantVars: Record<string, string | undefined> = {};
    
    // Capture environment variables that could affect configuration
    const relevantPatterns = [
      new RegExp(`^${this.envVarPrefix}_`), // REACT_APP_*
      /^AZURE_/, // Azure-related variables
      /^(NODE_ENV|PORT|DATABASE_URL|API_URL|BASE_URL)$/, // Common config vars
      /^(OKTA_|AUTH_|JWT_|SESSION_)/, // Authentication variables
      /^[A-Z][A-Z0-9_]*_API(_[A-Z0-9_]*)?/, // API-related variables (more flexible)
      /^[A-Z][A-Z0-9_]*_URL$/, // URL variables
      /^[A-Z][A-Z0-9_]*_KEY$/, // Key variables
      /^[A-Z][A-Z0-9_]*_SECRET$/, // Secret variables
      /^[A-Z][A-Z0-9_]*_TOKEN$/, // Token variables
      /^[A-Z][A-Z0-9_]*_HOST$/, // Host variables
      /^[A-Z][A-Z0-9_]*_PORT$/, // Port variables
    ];
    
    Object.keys(process.env).forEach(key => {
      const matchesPattern = relevantPatterns.some(pattern => pattern.test(key));
      if (matchesPattern) {
        relevantVars[key] = process.env[key];
      }
    });

    const hash = this.generateEnvHash(relevantVars);
    
    this.environmentSnapshot = {
      hash,
      timestamp: Date.now(),
      variables: relevantVars
    };

    logger.debug(`Captured environment snapshot with ${Object.keys(relevantVars).length} variables, hash: ${hash}`);
  }

  private hasEnvironmentChanged(): boolean {
    if (!this.environmentSnapshot) return true;

    const currentVars: Record<string, string | undefined> = {};
    
    // Use the same patterns as captureEnvironmentSnapshot
    const relevantPatterns = [
      new RegExp(`^${this.envVarPrefix}_`), // REACT_APP_*
      /^AZURE_/, // Azure-related variables
      /^(NODE_ENV|PORT|DATABASE_URL|API_URL|BASE_URL)$/, // Common config vars
      /^(OKTA_|AUTH_|JWT_|SESSION_)/, // Authentication variables
      /^[A-Z][A-Z0-9_]*_API(_[A-Z0-9_]*)?/, // API-related variables (more flexible)
      /^[A-Z][A-Z0-9_]*_URL$/, // URL variables
      /^[A-Z][A-Z0-9_]*_KEY$/, // Key variables
      /^[A-Z][A-Z0-9_]*_SECRET$/, // Secret variables
      /^[A-Z][A-Z0-9_]*_TOKEN$/, // Token variables
      /^[A-Z][A-Z0-9_]*_HOST$/, // Host variables
      /^[A-Z][A-Z0-9_]*_PORT$/, // Port variables
    ];
    
    Object.keys(process.env).forEach(key => {
      const matchesPattern = relevantPatterns.some(pattern => pattern.test(key));
      if (matchesPattern) {
        currentVars[key] = process.env[key];
      }
    });

    const currentHash = this.generateEnvHash(currentVars);
    return currentHash !== this.environmentSnapshot.hash;
  }

  private invalidateEnvironmentSensitiveCaches(): void {
    const sensitiveLayers = ['env-vars', 'merged'];
    for (const layerName of sensitiveLayers) {
      const layer = this.layers.get(layerName);
      if (layer) {
        layer.entries.clear();
      }
    }
  }

  private generateEnvHash(variables: Record<string, string | undefined>): string {
    const sortedKeys = Object.keys(variables).sort();
    const content = sortedKeys.map(key => `${key}=${variables[key] || ''}`).join('|');
    return this.simpleHash(content);
  }

  private generateValueHash(value: any): string {
    return this.simpleHash(JSON.stringify(value));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private evictOldestEntries(layer: CacheLayer, count: number): void {
    const entries = Array.from(layer.entries.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    for (const [key] of entries) {
      layer.entries.delete(key);
      this.stats.evictions++;
    }

    logger.debug(`Evicted ${count} oldest entries from layer "${layer.name}"`);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, DEFAULT_CONSTANTS.CACHE_CLEANUP_INTERVAL);
  }

  private performCleanup(): void {
    let totalCleaned = 0;
    const now = Date.now();

    for (const layer of this.layers.values()) {
      const before = layer.entries.size;
      
      for (const [key, entry] of layer.entries) {
        if (now - entry.timestamp > entry.ttl) {
          layer.entries.delete(key);
        }
      }

      const cleaned = before - layer.entries.size;
      totalCleaned += cleaned;
    }

    // Check for environment changes
    this.checkEnvironmentChanges();

    if (totalCleaned > 0) {
      logger.debug(`Cleanup removed ${totalCleaned} expired cache entries`);
    }
  }
}