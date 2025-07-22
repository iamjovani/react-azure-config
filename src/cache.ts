/**
 * Configuration Cache
 * 
 * Multi-layer caching system with memory and localStorage support,
 * TTL expiration, and automatic cleanup.
 * 
 * @module cache
 */

// Internal modules
import type { CachedValue, CacheConfig } from './types';
import { logger } from './utils/logger';
import { createCacheKey } from './utils/config-utils';
import { DEFAULT_CONSTANTS } from './constants';

export class ConfigurationCache {
  private memoryCache = new Map<string, CachedValue>();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: DEFAULT_CONSTANTS.MEMORY_CACHE_TTL,
      maxSize: DEFAULT_CONSTANTS.MEMORY_CACHE_SIZE,
      storage: ['memory', 'localStorage'],
      ...config
    };

    this.startCleanupInterval();
  }

  get<T = unknown>(key: string): T | null {
    const now = Date.now();
    
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue && memoryValue.expires > now) {
      return memoryValue.value as T;
    }

    if (memoryValue) {
      this.memoryCache.delete(key);
    }
    
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      try {
        const stored = localStorage.getItem(createCacheKey(key));
        if (stored) {
          const parsed: CachedValue<T> = JSON.parse(stored);
          if (parsed.expires > now) {
            this.memoryCache.set(key, parsed as CachedValue);
            return parsed.value;
          } else {
            localStorage.removeItem(createCacheKey(key));
          }
        }
      } catch (error) {
        logger.debug('Failed to read from localStorage:', error);
      }
    }

    return null;
  }

  set<T = unknown>(key: string, value: T, source: string = 'unknown'): void {
    const now = Date.now();
    const cachedValue: CachedValue<T> = {
      value,
      timestamp: now,
      expires: now + this.config.ttl,
      source
    };

    this.memoryCache.set(key, cachedValue as CachedValue);
    this.evictOldestEntriesIfNeeded();

    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      try {
        localStorage.setItem(createCacheKey(key), JSON.stringify(cachedValue));
      } catch (error) {
        logger.debug('Failed to write to localStorage:', error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          this.clearLocalStorageCache();
        }
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      this.clearLocalStorageCache();
    }
  }

  private clearLocalStorageCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(DEFAULT_CONSTANTS.CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      logger.debug('Failed to clear localStorage cache:', error);
    }
  }

  private cleanExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => {
        this.memoryCache.delete(key);
      });
    }
    
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      this.cleanExpiredLocalStorageEntries(now);
    }
  }

  private cleanExpiredLocalStorageEntries(now: number): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(DEFAULT_CONSTANTS.CACHE_KEY_PREFIX)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed: CachedValue = JSON.parse(stored);
              if (parsed.expires <= now) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      logger.debug('Failed to clean localStorage expired entries:', error);
    }
  }

  private evictOldestEntriesIfNeeded(): void {
    if (this.memoryCache.size > this.config.maxSize) {
      const entriesToRemove = this.memoryCache.size - this.config.maxSize;
      const keysIterator = this.memoryCache.keys();
      
      for (let i = 0; i < entriesToRemove; i++) {
        const oldestKey = keysIterator.next().value;
        if (oldestKey) {
          this.memoryCache.delete(oldestKey);
        }
      }
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredEntries();
    }, DEFAULT_CONSTANTS.CACHE_CLEANUP_INTERVAL);
  }

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      // Test localStorage availability
      const testKey = 'react-azure-config:test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  getStats() {
    const now = Date.now();
    const memoryStats = {
      size: this.memoryCache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      entries: Array.from(this.memoryCache.entries()).map(([key, value]) => ({
        key,
        source: value.source,
        expires: value.expires,
        isExpired: value.expires <= now
      }))
    };

    let localStorageStats: { totalKeys: number; storageUsed: number } | { error: string } | null = null;
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      try {
        const keys = Object.keys(localStorage);
        const configKeys = keys.filter(key => key.startsWith(DEFAULT_CONSTANTS.CACHE_KEY_PREFIX));
        localStorageStats = {
          totalKeys: configKeys.length,
          storageUsed: JSON.stringify(localStorage).length
        };
      } catch (error) {
        localStorageStats = { error: 'Failed to read localStorage stats' };
      }
    }

    return {
      memory: memoryStats,
      localStorage: localStorageStats,
      config: this.config
    };
  }



  // Get all cache keys
  getAllKeys(): string[] {
    const memoryKeys = Array.from(this.memoryCache.keys());
    
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      try {
        const localStorageKeys = Object.keys(localStorage)
          .filter(key => key.startsWith(DEFAULT_CONSTANTS.CACHE_KEY_PREFIX))
          .map(key => key.replace(DEFAULT_CONSTANTS.CACHE_KEY_PREFIX, ''));
        
        // Combine and deduplicate
        return Array.from(new Set([...memoryKeys, ...localStorageKeys]));
      } catch (error) {
        return memoryKeys;
      }
    }
    
    return memoryKeys;
  }

  // Delete specific cache entry
  delete(key: string): boolean {
    const memoryDeleted = this.memoryCache.delete(key);
    
    if (this.config.storage.includes('localStorage') && this.isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(createCacheKey(key));
        return true;
      } catch (error) {
        return memoryDeleted;
      }
    }
    
    return memoryDeleted;
  }

  // Get cache configuration
  getConfig(): CacheConfig {
    return { ...this.config };
  }

}