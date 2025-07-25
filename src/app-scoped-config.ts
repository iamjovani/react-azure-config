/**
 * App-Scoped Configuration Provider
 * 
 * Provides configuration loading from app-specific .env files in monorepo structure.
 * Supports reading from apps/{appId}/.env with fallback to root .env and caching.
 * 
 * @module app-scoped-config
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigurationCache } from './cache';
import { EnhancedCacheManager } from './enhanced-cache';
import { AzureConfigurationClient } from './server/azure-client';
import { logger } from './utils/logger';
import { DEFAULT_CONSTANTS } from './constants';
import type { ConfigurationValue, AzureConfigOptions, AuthenticationConfig } from './types';

interface AppConfigCache {
  content: ConfigurationValue;
  lastModified: number;
  filePath: string;
}

interface ConfigurationSource {
  type: 'azure' | 'app-env-vars' | 'generic-env-vars' | 'app-env-file' | 'root-env-file' | 'process-env-direct';
  data: ConfigurationValue;
  priority: number;
}

export class AppScopedConfigurationProvider {
  private cache: ConfigurationCache;
  private enhancedCache: EnhancedCacheManager;
  private basePath: string;
  private appConfigCache = new Map<string, AppConfigCache>();
  private envVarPrefix: string;
  private discoveredApps = new Set<string>();
  private azureClients = new Map<string, AzureConfigurationClient>();

  constructor(basePath: string = process.cwd(), envVarPrefix: string = 'REACT_APP') {
    this.basePath = basePath;
    this.envVarPrefix = envVarPrefix;
    
    // Initialize both cache systems
    this.cache = new ConfigurationCache({
      ttl: DEFAULT_CONSTANTS.MEMORY_CACHE_TTL,
      storage: ['memory']
    });
    
    this.enhancedCache = new EnhancedCacheManager(envVarPrefix);
    
    // Discover apps from environment variables on initialization
    this.discoverAppsFromEnvironment();
  }

  /**
   * Get configuration for a specific app using full precedence chain
   * @param appId - The app identifier (e.g., 'admin', 'user-portal')
   * @returns Configuration object with merged configuration from all sources
   */
  async getAppConfiguration(appId: string): Promise<ConfigurationValue> {
    try {
      // Validate appId to prevent directory traversal attacks
      if (!this.isValidAppId(appId)) {
        throw new Error(`Invalid app ID: ${appId}`);
      }

      const cacheKey = `app-config:${appId}`;
      
      // Check enhanced cache first
      const cached = this.enhancedCache.get<ConfigurationValue>(cacheKey, 'merged');
      if (cached) {
        return cached;
      }

      // Load configuration using full precedence chain
      const config = await this.loadAppConfigurationWithPrecedence(appId);
      
      // Cache the result in enhanced cache
      this.enhancedCache.set(cacheKey, config, 'merged', 'merged');
      
      // Also cache in basic cache for backward compatibility
      this.cache.set(cacheKey, config);
      
      return config;
      
    } catch (error) {
      logger.error(`Failed to load configuration for app "${appId}":`, error);
      throw error;
    }
  }

  /**
   * Get configuration value by key for a specific app
   * @param appId - The app identifier
   * @param key - The configuration key (supports nested keys with dot notation)
   * @returns The configuration value
   */
  async getAppConfigValue(appId: string, key: string): Promise<any> {
    const config = await this.getAppConfiguration(appId);
    return this.getNestedValue(config, key);
  }

  /**
   * Refresh configuration cache for a specific app
   * @param appId - The app identifier to refresh
   */
  refreshAppConfiguration(appId: string): void {
    const cacheKey = `app-config:${appId}`;
    this.cache.delete(cacheKey);
    this.appConfigCache.delete(appId);
    logger.info(`Configuration cache refreshed for app: ${appId}`);
  }

  /**
   * Refresh all cached configurations
   */
  refreshAllConfigurations(): void {
    this.cache.clear();
    this.appConfigCache.clear();
    logger.info('All app configuration caches cleared');
  }

  /**
   * Get list of available apps from both filesystem and environment variables
   * @returns Array of app IDs found in the apps directory and environment variables
   */
  getAvailableApps(): string[] {
    const filesystemApps = this.getFilesystemApps();
    const environmentApps = Array.from(this.discoveredApps);
    
    // Combine and deduplicate
    const allApps = [...new Set([...filesystemApps, ...environmentApps])];
    return allApps.filter(appId => this.isValidAppId(appId));
  }

  /**
   * Get apps from filesystem only
   * @returns Array of app IDs found in the apps directory
   */
  private getFilesystemApps(): string[] {
    const appsDir = join(this.basePath, 'apps');
    
    if (!existsSync(appsDir)) {
      return [];
    }

    try {
      const { readdirSync } = require('fs');
      return readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent: { isDirectory: () => boolean }) => dirent.isDirectory())
        .map((dirent: { name: string }) => dirent.name)
        .filter((name: string) => this.isValidAppId(name));
    } catch (error) {
      logger.warn('Failed to read apps directory:', error);
      return [];
    }
  }

  // Removed unused getCachedAppConfig method


  private isValidAppId(appId: string): boolean {
    // Prevent directory traversal and ensure valid app ID format
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
    return validPattern.test(appId) && !appId.includes('..') && !appId.includes('/');
  }

  private getNestedValue(obj: any, key: string): any {
    return key.split('.').reduce((current, path) => {
      return current && current[path] !== undefined ? current[path] : undefined;
    }, obj);
  }

  /**
   * Discover apps from environment variables on initialization
   * Filesystem-first approach: Only discover apps that exist in filesystem or are explicitly multi-word
   */
  private discoverAppsFromEnvironment(): void {
    // Start with filesystem apps as the authoritative source
    const filesystemApps = new Set(this.getFilesystemApps());
    
    // Add filesystem apps to discovered apps (these are confirmed real apps)
    filesystemApps.forEach(appId => {
      if (this.isValidAppId(appId)) {
        this.discoveredApps.add(appId);
      }
    });
    
    // Only discover additional apps from env vars if they match filesystem apps exactly
    // Pattern: REACT_APP_{FILESYSTEM_APP}_{CONFIG}
    if (filesystemApps.size > 0) {
      const filesystemAppsList = Array.from(filesystemApps);
      const appSpecificPattern = new RegExp(`^${this.envVarPrefix}_(${filesystemAppsList.map(app => app.toUpperCase().replace(/-/g, '_')).join('|')})_([A-Z][A-Z0-9_]+)$`);
      
      Object.keys(process.env).forEach(key => {
        const match = key.match(appSpecificPattern);
        if (match) {
          const appPart = match[1];
          const configPart = match[2];
          
          // Exclude variables with double underscores (nested config)
          if (!appPart.includes('__') && !configPart.includes('__')) {
            const appId = appPart.toLowerCase().replace(/_/g, '-');
            
            if (this.isValidAppId(appId) && filesystemApps.has(appId)) {
              this.discoveredApps.add(appId);
            }
          }
        }
      });
    }

    logger.debug(`Discovered apps from environment variables: ${Array.from(this.discoveredApps).join(', ')}`);
  }

  /**
   * Load configuration using full precedence chain with enhanced caching
   */
  private async loadAppConfigurationWithPrecedence(appId: string): Promise<ConfigurationValue> {
    const config: ConfigurationValue = {};
    const sources: ConfigurationSource[] = [];

    // 5. Root .env file (lowest priority)
    const rootEnvConfig = await this.loadEnvFileConfigWithCache('.env');
    sources.push({
      type: 'root-env-file',
      data: rootEnvConfig,
      priority: 1
    });
    logger.debug(`Root .env file for app "${appId}": ${Object.keys(rootEnvConfig).length} keys`);

    // 4. App-specific .env files
    const appEnvConfig = await this.loadEnvFileConfigWithCache(`apps/${appId}/.env`);
    sources.push({
      type: 'app-env-file',
      data: appEnvConfig,
      priority: 2
    });
    logger.debug(`App-specific .env file for app "${appId}": ${Object.keys(appEnvConfig).length} keys`);

    // 3. Generic environment variables (REACT_APP_*)
    const genericEnvConfig = this.parseGenericEnvVarsWithCache();
    sources.push({
      type: 'generic-env-vars',
      data: genericEnvConfig,
      priority: 3
    });
    logger.debug(`Generic env vars for app "${appId}": ${Object.keys(genericEnvConfig).length} keys`);

    // 2. App-specific environment variables (REACT_APP_ADMIN_*)
    const appEnvVarConfig = this.parseAppSpecificEnvVarsWithCache(appId);
    sources.push({
      type: 'app-env-vars',
      data: appEnvVarConfig,
      priority: 4
    });
    logger.debug(`App-specific env vars for app "${appId}": ${Object.keys(appEnvVarConfig).length} keys`);

    // 0. Direct process.env fallback (lowest priority)
    const processEnvConfig = this.parseProcessEnvDirectly(appId);
    sources.push({
      type: 'process-env-direct',
      data: processEnvConfig,
      priority: 0
    });
    logger.debug(`Direct process.env fallback for app "${appId}": ${Object.keys(processEnvConfig).length} keys`);

    // 1. Azure App Configuration (highest priority)
    const azureConfig = await this.loadAzureAppConfigurationWithCache(appId);
    sources.push({
      type: 'azure',
      data: azureConfig,
      priority: 5
    });
    logger.debug(`Azure config for app "${appId}": ${Object.keys(azureConfig).length} keys`);

    // Merge configurations by priority (lowest to highest)
    sources.sort((a, b) => a.priority - b.priority);
    sources.forEach(source => {
      this.deepMerge(config, source.data);
    });

    logger.debug(`Loaded configuration for app "${appId}" from ${sources.length} sources`);
    return config;
  }

  /**
   * Parse app-specific environment variables (REACT_APP_ADMIN_*)
   */
  private parseAppSpecificEnvVars(appId: string): ConfigurationValue {
    const config: ConfigurationValue = {};
    const appPrefix = `${this.envVarPrefix}_${appId.toUpperCase().replace(/-/g, '_')}_`;
    const matchedVars: string[] = [];
    
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(appPrefix)) {
        const value = process.env[key];
        if (value !== undefined) {
          matchedVars.push(key);
          const transformedKey = this.transformVariableName(key, appPrefix);
          this.setNestedValue(config, transformedKey, value);
        }
      }
    });

    if (matchedVars.length > 0) {
      logger.debug(`App-specific environment variables found for "${appId}":`, matchedVars);
    } else {
      logger.debug(`No app-specific environment variables found for "${appId}" with prefix "${appPrefix}"`);
    }

    return config;
  }

  /**
   * Parse generic environment variables (REACT_APP_*)
   * Filesystem-aware approach: Include all REACT_APP_ variables except those matching filesystem apps
   */
  private parseGenericEnvVars(): ConfigurationValue {
    const config: ConfigurationValue = {};
    const genericPrefix = `${this.envVarPrefix}_`;
    const matchedVars: string[] = [];
    const excludedVars: string[] = [];
    
    // Build app-specific exclusion pattern from discovered filesystem apps only
    const filesystemApps = Array.from(this.discoveredApps);
    let appExclusionPattern: RegExp | null = null;
    
    if (filesystemApps.length > 0) {
      const appPatternString = filesystemApps.map(app => app.toUpperCase().replace(/-/g, '_')).join('|');
      appExclusionPattern = new RegExp(`^${this.envVarPrefix}_(${appPatternString})_([A-Z][A-Z0-9_]+)$`);
    }
    
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(genericPrefix)) {
        const value = process.env[key];
        if (value !== undefined) {
          let isAppSpecific = false;
          
          // Only exclude if it matches a confirmed filesystem app pattern
          if (appExclusionPattern) {
            const match = key.match(appExclusionPattern);
            if (match) {
              const appPart = match[1];
              const configPart = match[2];
              
              // Exclude if no double underscores and matches filesystem app
              if (!appPart.includes('__') && !configPart.includes('__')) {
                const appId = appPart.toLowerCase().replace(/_/g, '-');
                isAppSpecific = this.discoveredApps.has(appId);
              }
            }
          }
          
          if (isAppSpecific) {
            excludedVars.push(key);
          } else {
            // Include as generic
            matchedVars.push(key);
            const transformedKey = this.transformVariableName(key, genericPrefix);
            
            // Validate transformation result before setting
            if (transformedKey && transformedKey.length > 0 && !transformedKey.includes('..') && !transformedKey.includes('')) {
              this.setNestedValue(config, transformedKey, value);
            }
          }
        }
      }
    });

    if (matchedVars.length > 0) {
      logger.debug(`Generic environment variables found:`, matchedVars);
      if (excludedVars.length > 0) {
        logger.debug(`Excluded app-specific variables:`, excludedVars);
      }
    } else {
      logger.debug(`No generic environment variables found with prefix "${genericPrefix}"`);
    }

    return config;
  }

  /**
   * Parse environment variables directly from process.env as ultimate fallback
   * This method is more permissive and will capture common environment variables
   */
  private parseProcessEnvDirectly(appId: string): ConfigurationValue {
    const config: ConfigurationValue = {};
    const relevantVars: string[] = [];
    
    // Common patterns to capture as fallback
    const patterns = [
      // Standard REACT_APP variables (should be caught by other methods, but fallback)
      new RegExp(`^${this.envVarPrefix}_`),
      // Common configuration variables
      /^(NODE_ENV|PORT|DATABASE_URL|API_URL|BASE_URL)$/,
      // App-specific patterns (less strict)
      new RegExp(`^(${appId.toUpperCase()}|${appId.toUpperCase().replace(/-/g, '_')})_`, 'i'),
      // Common service variables
      /^(OKTA_|AZURE_|AUTH_|JWT_|SESSION_)/,
      // API and URL patterns (more comprehensive)
      /^[A-Z][A-Z0-9_]*_API(_[A-Z0-9_]*)?$/,
      /^[A-Z][A-Z0-9_]*_URL$/,
      /^[A-Z][A-Z0-9_]*_KEY$/,
      /^[A-Z][A-Z0-9_]*_SECRET$/,
      /^[A-Z][A-Z0-9_]*_TOKEN$/,
      /^[A-Z][A-Z0-9_]*_HOST$/,
      /^[A-Z][A-Z0-9_]*_PORT$/,
    ];
    
    Object.keys(process.env).forEach(key => {
      const value = process.env[key];
      if (value !== undefined) {
        // Check if this variable matches any of our patterns
        const matchesPattern = patterns.some(pattern => pattern.test(key));
        
        if (matchesPattern) {
          relevantVars.push(key);
          // Use the robust transformation logic
          const transformedKey = this.transformVariableName(key, '');
          
          // Additional validation for direct process.env variables
          if (transformedKey && transformedKey.length > 0 && !transformedKey.includes('..')) {
            this.setNestedValue(config, transformedKey, value);
          }
        }
      }
    });
    
    if (relevantVars.length > 0) {
      logger.debug(`Process.env direct fallback captured variables for app "${appId}":`, relevantVars);
    }
    
    return config;
  }

  /**
   * Check if a variable is app-specific by checking against discovered apps
   * Filesystem-based: Only return true for variables matching confirmed filesystem apps
   */
  private isAppSpecificVariable(key: string): boolean {
    // Only check against confirmed filesystem apps
    const filesystemApps = Array.from(this.discoveredApps);
    
    if (filesystemApps.length === 0) {
      return false;  // No apps discovered, treat everything as generic
    }
    
    // Use the same pattern as generic parsing exclusion
    const appPatternString = filesystemApps.map(app => app.toUpperCase().replace(/-/g, '_')).join('|');
    const appSpecificPattern = new RegExp(`^${this.envVarPrefix}_(${appPatternString})_([A-Z][A-Z0-9_]+)$`);
    
    const match = key.match(appSpecificPattern);
    if (match) {
      const appPart = match[1];
      const configPart = match[2];
      
      // Only treat as app-specific if no double underscores and matches filesystem app
      if (!appPart.includes('__') && !configPart.includes('__')) {
        const appId = appPart.toLowerCase().replace(/_/g, '-');
        return this.discoveredApps.has(appId);
      }
    }
    
    return false;
  }

  /**
   * Transform variable name by removing prefixes and converting to nested structure
   * Advanced handling of double underscores with comprehensive edge case protection
   */
  private transformVariableName(originalKey: string, prefix: string): string {
    let result = originalKey.substring(prefix.length).toLowerCase();
    
    // Step 1: Normalize and handle multiple consecutive underscores
    // Replace 3+ consecutive underscores with double underscore
    result = result.replace(/_{3,}/g, '__');
    
    // Step 2: Handle edge cases with double underscores
    // Remove leading and trailing double underscores completely
    result = result.replace(/^_*__+/, '');  // Remove leading underscores including double
    result = result.replace(/__+_*$/, '');  // Remove trailing underscores including double
    
    // Step 3: Split on double underscores to identify nesting levels
    const nestingParts = result.split('__');
    
    // Step 4: Process each nesting level individually
    const processedParts = nestingParts.map(part => {
      // Remove single underscores from each part (camelCase conversion)
      return part.replace(/_/g, '');
    }).filter(part => part.length > 0);  // Remove empty parts
    
    // Step 5: Join with dots for nesting
    const finalResult = processedParts.join('.');
    
    // Step 6: Final validation - ensure no empty segments remain
    if (finalResult.includes('..') || finalResult.startsWith('.') || finalResult.endsWith('.')) {
      // If we have malformed paths, clean them up
      return finalResult
        .split('.')
        .filter(part => part.length > 0)
        .join('.');
    }
    
    return finalResult;
  }

  /**
   * Load configuration from .env file
   */
  private loadEnvFileConfig(relativePath: string): ConfigurationValue {
    const filePath = join(this.basePath, relativePath);
    const config: ConfigurationValue = {};
    
    if (!existsSync(filePath)) {
      return config;
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        // Parse KEY=VALUE format
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex === -1) {
          continue;
        }

        const key = trimmedLine.slice(0, equalIndex).trim();
        let value = trimmedLine.slice(equalIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        config[key] = value;
      }

      logger.debug(`Loaded environment variables from: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to read .env file at ${filePath}:`, error);
    }

    return config;
  }

  /**
   * Deep merge two configuration objects
   */
  private deepMerge(target: ConfigurationValue, source: ConfigurationValue): void {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.deepMerge(target[key] as ConfigurationValue, source[key] as ConfigurationValue);
      } else {
        target[key] = source[key];
      }
    });
  }

  /**
   * Set nested value using dot notation
   */
  private setNestedValue(obj: ConfigurationValue, path: string, value: string): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as ConfigurationValue;
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Load Azure App Configuration for a specific app
   */
  private async loadAzureAppConfiguration(appId: string): Promise<ConfigurationValue> {
    try {
      const azureClient = await this.getOrCreateAzureClient(appId);
      if (!azureClient) {
        return {};
      }

      const rawConfig = await azureClient.getConfiguration();
      if (!rawConfig) {
        return {};
      }

      // Normalize Azure configuration keys to match environment variable transformation
      const normalizedConfig: ConfigurationValue = {};
      Object.entries(rawConfig).forEach(([key, value]) => {
        // Transform Azure keys to match environment variable key format
        // Simply replace dots with nothing (no underscores) to match env var transformation
        const normalizedKey = key.replace(/\./g, '');
        
        // Only use the normalized key to ensure Azure wins over env vars
        normalizedConfig[normalizedKey] = value;
      });

      logger.debug(`Loaded Azure configuration for app "${appId}"`);
      return normalizedConfig;
      
    } catch (error) {
      logger.warn(`Failed to load Azure configuration for app "${appId}":`, error);
      return {};
    }
  }

  /**
   * Get or create Azure client for a specific app
   */
  private async getOrCreateAzureClient(appId: string): Promise<AzureConfigurationClient | null> {
    // Check if we already have a client for this app
    if (this.azureClients.has(appId)) {
      return this.azureClients.get(appId)!;
    }

    // Build Azure configuration options for this app
    const azureOptions = this.getAzureConfigOptions(appId);
    if (!azureOptions.endpoint) {
      // No Azure endpoint configured for this app
      return null;
    }

    try {
      const azureClient = new AzureConfigurationClient(azureOptions);
      this.azureClients.set(appId, azureClient);
      logger.info(`Created Azure client for app "${appId}" with endpoint: ${azureOptions.endpoint}`);
      return azureClient;
      
    } catch (error) {
      logger.error(`Failed to create Azure client for app "${appId}":`, error);
      return null;
    }
  }

  /**
   * Build Azure configuration options for a specific app
   */
  private getAzureConfigOptions(appId: string): AzureConfigOptions {
    const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
    
    // Look for app-specific Azure configuration
    const endpoint = process.env[`AZURE_APP_CONFIG_ENDPOINT_${appIdUpper}`] || 
                     process.env[`${this.envVarPrefix}_${appIdUpper}_AZURE_ENDPOINT`];
    
    const authentication = this.parseAzureCredentials(appId);
    
    const options: AzureConfigOptions = {
      endpoint: endpoint || undefined,
      environment: process.env.NODE_ENV || 'production',
      appId: appId || undefined,
      authentication,
      application: appId || undefined,
      label: process.env[`AZURE_APP_CONFIG_LABEL_${appIdUpper}`] || 
              process.env[`${this.envVarPrefix}_${appIdUpper}_AZURE_LABEL`] || 
              undefined,
      logLevel: 'warn'
    };

    return options;
  }

  /**
   * Parse Azure credentials for a specific app
   */
  private parseAzureCredentials(appId: string): AuthenticationConfig | undefined {
    const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
    
    // Try app-specific credentials first
    const clientId = process.env[`AZURE_CLIENT_ID_${appIdUpper}`] || 
                     process.env[`${this.envVarPrefix}_${appIdUpper}_AZURE_CLIENT_ID`];
    
    const clientSecret = process.env[`AZURE_CLIENT_SECRET_${appIdUpper}`] || 
                         process.env[`${this.envVarPrefix}_${appIdUpper}_AZURE_CLIENT_SECRET`];
    
    const tenantId = process.env[`AZURE_TENANT_ID_${appIdUpper}`] || 
                     process.env[`${this.envVarPrefix}_${appIdUpper}_AZURE_TENANT_ID`] ||
                     process.env.AZURE_TENANT_ID; // Fallback to global tenant ID

    // If we have client credentials, use service principal
    if (clientId && clientSecret && tenantId) {
      return {
        type: 'servicePrincipal',
        clientId,
        clientSecret,
        tenantId
      };
    }

    // Check if managed identity is explicitly requested
    const useManagedIdentity = process.env[`AZURE_USE_MANAGED_IDENTITY_${appIdUpper}`] || 
                               process.env[`${this.envVarPrefix}_${appIdUpper}_USE_MANAGED_IDENTITY`];
    
    if (useManagedIdentity === 'true') {
      return {
        type: 'managedIdentity',
        clientId: clientId || undefined // Optional for user-assigned managed identity
      };
    }

    // Default to Azure CLI authentication for development
    return {
      type: 'azureCli'
    };
  }

  /**
   * Refresh Azure configuration for a specific app
   */
  async refreshAzureConfiguration(appId: string): Promise<void> {
    const azureClient = this.azureClients.get(appId);
    if (azureClient) {
      try {
        await azureClient.refreshConfiguration();
        logger.info(`Refreshed Azure configuration for app "${appId}"`);
      } catch (error) {
        logger.error(`Failed to refresh Azure configuration for app "${appId}":`, error);
      }
    }
  }

  /**
   * Get Azure configuration info for debugging
   */
  getAzureConfigInfo(appId: string): any {
    const azureOptions = this.getAzureConfigOptions(appId);
    const hasClient = this.azureClients.has(appId);
    
    return {
      appId,
      endpoint: azureOptions.endpoint,
      hasClient,
      authentication: {
        type: azureOptions.authentication?.type,
        clientId: azureOptions.authentication?.clientId ? '***' : undefined,
        tenantId: azureOptions.authentication?.tenantId
      },
      application: azureOptions.application,
      label: azureOptions.label
    };
  }

  /**
   * Enhanced caching methods
   */

  /**
   * Load .env file configuration with enhanced caching
   */
  private async loadEnvFileConfigWithCache(relativePath: string): Promise<ConfigurationValue> {
    const cacheKey = `env-file:${relativePath}`;
    
    // Check enhanced cache first
    const cached = this.enhancedCache.get<ConfigurationValue>(cacheKey, 'env-files');
    if (cached) {
      return cached;
    }

    // Load from file
    const config = this.loadEnvFileConfig(relativePath);
    
    // Cache the result
    this.enhancedCache.set(cacheKey, config, 'app-env-file', 'env-files');
    
    return config;
  }

  /**
   * Parse generic environment variables with enhanced caching
   */
  private parseGenericEnvVarsWithCache(): ConfigurationValue {
    const cacheKey = 'env-vars:generic';
    
    // Check enhanced cache first
    const cached = this.enhancedCache.get<ConfigurationValue>(cacheKey, 'env-vars');
    if (cached) {
      return cached;
    }

    // Parse environment variables
    const config = this.parseGenericEnvVars();
    
    // Cache the result
    this.enhancedCache.set(cacheKey, config, 'generic-env-vars', 'env-vars');
    
    return config;
  }

  /**
   * Parse app-specific environment variables with enhanced caching
   */
  private parseAppSpecificEnvVarsWithCache(appId: string): ConfigurationValue {
    const cacheKey = `env-vars:app:${appId}`;
    
    // Check enhanced cache first
    const cached = this.enhancedCache.get<ConfigurationValue>(cacheKey, 'env-vars');
    if (cached) {
      return cached;
    }

    // Parse environment variables
    const config = this.parseAppSpecificEnvVars(appId);
    
    // Cache the result
    this.enhancedCache.set(cacheKey, config, 'app-env-vars', 'env-vars');
    
    return config;
  }

  /**
   * Load Azure App Configuration with enhanced caching
   */
  private async loadAzureAppConfigurationWithCache(appId: string): Promise<ConfigurationValue> {
    const cacheKey = `azure:${appId}`;
    
    // Check enhanced cache first
    const cached = this.enhancedCache.get<ConfigurationValue>(cacheKey, 'azure');
    if (cached) {
      return cached;
    }

    // Load from Azure
    const config = await this.loadAzureAppConfiguration(appId);
    
    // Cache the result with longer TTL for Azure
    this.enhancedCache.set(cacheKey, config, 'azure', 'azure');
    
    return config;
  }

  /**
   * Get enhanced cache statistics
   */
  getCacheStats(): any {
    return {
      basic: this.cache.getStats(),
      enhanced: this.enhancedCache.getStats()
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
    this.enhancedCache.clear();
    this.appConfigCache.clear();
    logger.info('Cleared all caches (basic, enhanced, and app-specific)');
  }

  /**
   * Warm cache with initial data
   */
  warmCache(apps: string[]): void {
    const warmData: Record<string, { value: any; source: string; layer?: string }> = {};
    
    // Warm generic environment variables
    const genericEnvVars = this.parseGenericEnvVars();
    if (Object.keys(genericEnvVars).length > 0) {
      warmData['env-vars:generic'] = {
        value: genericEnvVars,
        source: 'generic-env-vars',
        layer: 'env-vars'
      };
    }

    // Warm app-specific environment variables
    apps.forEach(appId => {
      const appEnvVars = this.parseAppSpecificEnvVars(appId);
      if (Object.keys(appEnvVars).length > 0) {
        warmData[`env-vars:app:${appId}`] = {
          value: appEnvVars,
          source: 'app-env-vars',
          layer: 'env-vars'
        };
      }
    });

    this.enhancedCache.warmCache(warmData);
  }

  /**
   * Destroy and cleanup resources
   */
  destroy(): void {
    this.enhancedCache.destroy();
    this.cache.clear();
    this.appConfigCache.clear();
    this.azureClients.clear();
    logger.info('AppScopedConfigurationProvider destroyed');
  }
}