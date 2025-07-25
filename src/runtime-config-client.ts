/**
 * Runtime Configuration Client
 * 
 * Client for runtime configuration access with embedded service support,
 * configurable source hierarchy, and automatic fallback strategies.
 * 
 * @module runtime-config-client
 */

// Internal modules
import { AzureConfigurationClient } from './server/azure-client';
import { ConfigurationCache } from './cache';
import { getDefaultConfiguration, getNestedProperty } from './utils/config-utils';
import { logger } from './utils/logger';
import { handleError, ErrorType } from './utils/error-handler';
import { DEFAULT_CONSTANTS, CONFIG_SOURCES } from './constants';
import type { AzureConfigOptions, ConfigurationValue, ConfigApiResponse } from './types';

/**
 * Runtime Configuration Client
 * 
 * This client can work in two modes:
 * 1. Direct mode: Uses Azure/local providers directly (existing behavior)
 * 2. Service mode: Calls the embedded config service via HTTP
 */
export class RuntimeConfigurationClient {
  private cache: ConfigurationCache;
  private options: AzureConfigOptions;
  private azureClient: AzureConfigurationClient | null = null;
  private serviceUrl: string;
  private appId: string | undefined;

  constructor(options: AzureConfigOptions) {
    this.options = {
      sources: [CONFIG_SOURCES.AZURE, CONFIG_SOURCES.ENVIRONMENT, CONFIG_SOURCES.LOCAL, CONFIG_SOURCES.DEFAULTS],
      precedence: 'first-wins',
      useEmbeddedService: true,
      configServiceUrl: `http://localhost:${DEFAULT_CONSTANTS.CONFIG_SERVER_PORT}`,
      port: DEFAULT_CONSTANTS.CONFIG_SERVER_PORT,
      ...options
    };
    
    this.appId = this.options.appId;
    this.cache = new ConfigurationCache(options.cache);
    this.serviceUrl = this.options.configServiceUrl || `http://localhost:${this.options.port || DEFAULT_CONSTANTS.CONFIG_SERVER_PORT}`;
    
    if (!this.options.useEmbeddedService && this.options.endpoint) {
      this.azureClient = new AzureConfigurationClient(options);
    }
  }

  private buildConfigEndpoint(): string {
    // Always call the base URL directly - let the API handle app routing internally
    return '';
  }

  private buildConfigValueEndpoint(key: string): string {
    // For individual values, we'll get the full config and extract the key
    return '';
  }

  private buildRefreshEndpoint(): string {
    // Always call the base URL directly - let the API handle app routing internally
    return '/refresh';
  }

  private buildCacheKey(suffix: string = ''): string {
    const environmentKey = this.appId 
      ? `${this.appId}:${this.options.environment}`
      : this.options.environment;
    return suffix ? `${suffix}:${environmentKey}` : `config:${environmentKey}`;
  }

  async getConfiguration(): Promise<ConfigurationValue> {
    const cacheKey = this.buildCacheKey();
    
    const cached = this.cache.get<ConfigurationValue>(cacheKey);
    if (cached) {
      return cached;
    }

    let config: ConfigurationValue;
    let source: string;

    try {
      if (this.options.useEmbeddedService) {
        console.debug(`[react-azure-config] Fetching config from: ${this.serviceUrl}`);
        const response = await this.fetchFromService(this.buildConfigEndpoint());
        console.debug(`[react-azure-config] API response status: ${response.success ? 'success' : 'error'}`, response);
        
        // Handle different API response formats
        if (response.config) {
          config = response.config as ConfigurationValue;
        } else if (response.data) {
          config = response.data as ConfigurationValue;
        } else {
          config = {} as ConfigurationValue;
        }
        
        source = response.source || 'api';
        
        // If API returns empty config, try environment variable fallback
        if (Object.keys(config).length === 0) {
          console.debug('[react-azure-config] API returned empty config, trying environment variable fallback');
          config = this.getEnvironmentFallback();
          source = 'environment-fallback';
          
          // Log fallback results
          console.debug(`[react-azure-config] Environment fallback provided ${Object.keys(config).length} variables for app "${this.appId}"`);
          
          if (Object.keys(config).length === 0) {
            console.warn(`[react-azure-config] No configuration found from API or environment fallback for app "${this.appId}"`);
          }
        }
      } else {
        // Use direct Azure client (backward compatibility)
        if (!this.azureClient) {
          throw handleError(
            'Azure client not initialized',
            ErrorType.AZURE_CLIENT_ERROR,
            { useEmbeddedService: false }
          );
        }
        config = await this.azureClient.getConfiguration();
        source = 'azure';
      }

      this.cache.set(cacheKey, config, source);
      return config;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.debug(`[react-azure-config] API fetch failed for app "${this.appId}": ${errorMessage}. Activating fallback to environment variables.`);
      
      // Try environment variable fallback immediately on error
      try {
        config = this.getEnvironmentFallback();
        source = 'environment-fallback';
        
        if (Object.keys(config).length > 0) {
          console.debug(`[react-azure-config] Successfully loaded ${Object.keys(config).length} variables from environment fallback for app "${this.appId}"`);
          this.cache.set(cacheKey, config, source);
          return config;
        } else {
          console.warn(`[react-azure-config] Environment fallback returned no variables for app "${this.appId}"`);
        }
      } catch (envError) {
        const envErrorMessage = envError instanceof Error ? envError.message : String(envError);
        console.error(`[react-azure-config] Environment fallback also failed for app "${this.appId}": ${envErrorMessage}`);
      }
      
      handleError(error, ErrorType.CONFIGURATION_ERROR, {
        useEmbeddedService: this.options.useEmbeddedService,
        serviceUrl: this.serviceUrl,
        appId: this.appId
      });
      
      // Try to return stale cache
      const staleCache = this.cache.get<ConfigurationValue>(cacheKey);
      if (staleCache) {
        logger.warn('Returning stale cached configuration due to error', { appId: this.appId });
        return staleCache;
      }

      // Return defaults as last resort
      const defaultConfig = getDefaultConfiguration(this.options.environment);
      this.cache.set(cacheKey, defaultConfig, 'defaults');
      return defaultConfig;
    }
  }

  async getValue<T = unknown>(key: string): Promise<T | undefined> {
    try {
      // Always get the full configuration and extract the key
      // This ensures consistent behavior and proper fallback handling
      const config = await this.getConfiguration();
      const value = getNestedProperty<T>(config, key);
      
      // If no value found, try direct environment variable lookup
      if (value === undefined) {
        console.debug(`[react-azure-config] Key "${key}" not found in config, trying direct environment lookup`);
        const envValue = this.getEnvironmentValue<T>(key);
        if (envValue !== undefined) {
          console.debug(`[react-azure-config] Found value for "${key}" in environment variables`);
          return envValue;
        }
      }
      
      return value;
    } catch (error) {
      console.debug(`[react-azure-config] Failed to get config value for key "${key}", trying environment fallback:`, error);
      
      // Try direct environment variable lookup as fallback
      try {
        const envValue = this.getEnvironmentValue<T>(key);
        if (envValue !== undefined) {
          console.debug(`[react-azure-config] Successfully retrieved "${key}" from environment variables`);
          return envValue;
        }
      } catch (envError) {
        console.error(`[react-azure-config] Environment fallback failed for key "${key}":`, envError);
      }
      
      logger.error(`Failed to get config value for key "${key}":`, error, { appId: this.appId });
      return undefined;
    }
  }

  async refreshConfiguration(): Promise<void> {
    try {
      if (this.options.useEmbeddedService) {
        await this.fetchFromService(this.buildRefreshEndpoint(), { method: 'POST' });
      } else if (this.azureClient) {
        await this.azureClient.refreshConfiguration();
      }
      
      this.cache.clear();
    } catch (error) {
      logger.error('Failed to refresh configuration:', error, { appId: this.appId });
      throw error;
    }
  }

  private async fetchFromService(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ConfigApiResponse> {
    // Use the serviceUrl directly without additional endpoint construction
    const url = endpoint ? `${this.serviceUrl}${endpoint}` : this.serviceUrl;
    
    console.debug(`[react-azure-config] Making API request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    console.debug(`[react-azure-config] API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw handleError(
        `Config service error: ${response.status} ${response.statusText}`,
        ErrorType.SERVER_ERROR,
        { url, status: response.status, statusText: response.statusText }
      );
    }

    const data = await response.json() as ConfigApiResponse;
    
    if (!data.success && data.error) {
      throw handleError(
        `Config service error: ${data.error}`,
        ErrorType.SERVER_ERROR,
        { endpoint, apiError: data.error }
      );
    }

    return data;
  }

  /**
   * Get environment variable fallback configuration
   */
  private getEnvironmentFallback(): ConfigurationValue {
    const config: ConfigurationValue = {};
    
    // Enhanced patterns for environment variable discovery
    const patterns = [
      // App-specific patterns (highest priority)
      this.appId ? `REACT_APP_${this.appId.toUpperCase().replace(/-/g, '_')}_` : null,
      this.appId ? `${this.appId.toUpperCase().replace(/-/g, '_')}_` : null,
      // Generic React app variables
      'REACT_APP_',
      // Common service patterns
      'NEXTAUTH_',
      'OKTA_',
      'AZURE_',
      'AUTH_',
      'API_',
      'DATABASE_',
      'SGJ_'
    ].filter(Boolean) as string[];

    // Search process.env for matching patterns
    Object.keys(process.env).forEach(key => {
      const value = process.env[key];
      if (value !== undefined) {
        const matchesPattern = patterns.some(pattern => key.startsWith(pattern));
        if (matchesPattern) {
          // Transform the key for better accessibility
          const transformedKey = this.transformEnvironmentKey(key);
          config[transformedKey] = value;
          config[key] = value; // Also keep original format
          
          // Also create a simplified version for common keys
          if (key.includes('NEXTAUTH_SECRET')) {
            config['nextauth.secret'] = value;
            config['nextauthsecret'] = value;
          }
          if (key.includes('OKTA_CLIENT_ID')) {
            config['okta.client.id'] = value;
            config['oktaclientid'] = value;
          }
        }
      }
    });

    // Add common hardcoded keys that might be expected
    const commonKeys = [
      'NEXTAUTH_SECRET',
      'OKTA_CLIENT_ID', 
      'OKTA_CLIENT_SECRET',
      'OKTA_ISSUER',
      'SGJ_INVESTMENT_BASE_URL',
      'API_URL',
      'DATABASE_URL'
    ];
    
    commonKeys.forEach(key => {
      if (!config[key]) {
        const value = this.getEnvironmentValue(key);
        if (value !== undefined) {
          const nestedKey = key.toLowerCase().replace(/_/g, '.');
          config[nestedKey] = value;
          config[key] = value;
        }
      }
    });

    console.debug(`[react-azure-config] Environment fallback loaded ${Object.keys(config).length} variables:`, Object.keys(config));
    return config;
  }

  /**
   * Transform environment variable key to multiple accessible formats
   */
  private transformEnvironmentKey(key: string): string {
    let result = key;
    
    // Remove app-specific prefixes first
    if (this.appId) {
      const appIdUpper = this.appId.toUpperCase().replace(/-/g, '_');
      const appPrefixes = [
        `REACT_APP_${appIdUpper}_`,
        `${appIdUpper}_`
      ];
      
      for (const prefix of appPrefixes) {
        if (result.startsWith(prefix)) {
          result = result.substring(prefix.length);
          break;
        }
      }
    }
    
    // Remove generic prefixes
    const genericPrefixes = ['REACT_APP_'];
    for (const prefix of genericPrefixes) {
      if (result.startsWith(prefix)) {
        result = result.substring(prefix.length);
        break;
      }
    }
    
    // Convert to lowercase and replace underscores with dots
    return result.toLowerCase().replace(/_/g, '.');
  }
  
  /**
   * Get individual environment variable value with proper prefixing
   */
  private getEnvironmentValue<T = unknown>(key: string): T | undefined {
    if (typeof process === 'undefined') {
      return undefined;
    }
    
    const patterns = [
      key, // Direct key
      `REACT_APP_${key}`, // React app prefix
      this.appId ? `REACT_APP_${this.appId.toUpperCase()}_${key}` : null, // App-specific
      this.appId ? `${this.appId.toUpperCase()}_${key}` : null // App-specific without REACT_APP
    ].filter(Boolean) as string[];
    
    for (const pattern of patterns) {
      const value = process.env[pattern];
      if (value !== undefined) {
        console.debug(`[react-azure-config] Found environment variable: ${pattern}=${value}`);
        return value as T;
      }
    }
    
    return undefined;
  }



  getEnvironment(): string {
    return this.options.environment;
  }

  getAppId(): string | undefined {
    return this.appId;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  isUsingEmbeddedService(): boolean {
    return this.options.useEmbeddedService || false;
  }

  async checkServiceHealth(): Promise<any> {
    if (this.options.useEmbeddedService) {
      try {
        const response = await this.fetchFromService('/health');
        return response.data;
      } catch (error: any) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    } else {
      return {
        status: 'not-applicable',
        reason: 'Direct mode'
      };
    }
  }

  getServiceUrl(): string {
    return this.serviceUrl;
  }
}

// Factory function for easy instantiation
export const createRuntimeConfigClient = (options: AzureConfigOptions): RuntimeConfigurationClient => {
  return new RuntimeConfigurationClient(options);
};