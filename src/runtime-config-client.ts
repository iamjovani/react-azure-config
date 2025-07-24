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
    return this.appId ? `/config/${this.appId}` : '/config';
  }

  private buildConfigValueEndpoint(key: string): string {
    return this.appId 
      ? `/config/${this.appId}/${encodeURIComponent(key)}`
      : `/config/${encodeURIComponent(key)}`;
  }

  private buildRefreshEndpoint(): string {
    return this.appId ? `/refresh/${this.appId}` : '/refresh';
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
        const response = await this.fetchFromService(this.buildConfigEndpoint());
        config = (response.data as ConfigurationValue) || ({} as ConfigurationValue);
        source = response.source || 'api';
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
      if (this.options.useEmbeddedService) {
        const response = await this.fetchFromService(this.buildConfigValueEndpoint(key));
        return response.data as T;
      } else {
        const config = await this.getConfiguration();
        return getNestedProperty<T>(config, key);
      }
    } catch (error) {
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
    const url = `${this.serviceUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

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