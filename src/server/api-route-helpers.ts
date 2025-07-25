/**
 * API Route Integration Helpers
 * 
 * Bridge utilities for integrating app-scoped configuration with Next.js API routes
 * and other HTTP endpoint implementations. Provides unified interface for serving
 * configuration data with proper fallback handling.
 * 
 * @module server/api-route-helpers
 */

import { AppScopedConfigurationProvider } from '../app-scoped-config';
import { AzureEnvironmentLoader } from './azure-env-loader';
import { logger } from '../utils/logger';
import type { ConfigurationValue, AuthenticationConfig } from '../types';
import type { AzureEnvLoaderOptions } from './azure-env-loader';

/**
 * Options for API route configuration handler
 */
export interface ApiRouteHandlerOptions extends Omit<AzureEnvLoaderOptions, 'appId'> {
  /** App ID for app-scoped configuration */
  appId: string;
  /** Enable local environment variable fallback */
  enableLocalFallback?: boolean;
  /** Custom variable name mappings for fallback */
  variableMappings?: Record<string, string[]>;
  /** Whether to include debugging information in responses */
  includeDebugInfo?: boolean;
}

/**
 * Response format for API routes
 */
export interface ApiConfigResponse {
  success: boolean;
  data?: ConfigurationValue;
  config?: ConfigurationValue; // Backward compatibility
  source: string;
  timestamp: number;
  appId?: string;
  debug?: {
    sourcesUsed: string[];
    fallbackActivated: boolean;
    variableCount: number;
    errors?: string[];
  };
  error?: string;
}

/**
 * Enhanced App Configuration Handler
 * 
 * Provides unified interface for serving app-scoped configuration via API routes
 * with intelligent fallback handling and debugging capabilities.
 */
export class ApiRouteConfigHandler {
  private appScopedProvider: AppScopedConfigurationProvider;
  private azureLoader: AzureEnvironmentLoader;
  private options: ApiRouteHandlerOptions;
  private debugInfo: { errors: string[]; sourcesUsed: string[]; fallbackActivated: boolean } = {
    errors: [],
    sourcesUsed: [],
    fallbackActivated: false
  };

  constructor(options: ApiRouteHandlerOptions) {
    this.options = {
      enableLocalFallback: true,
      includeDebugInfo: process.env.NODE_ENV === 'development',
      ...options
    };

    // Initialize app-scoped provider for comprehensive configuration loading
    this.appScopedProvider = new AppScopedConfigurationProvider();
    
    // Initialize Azure loader for environment variable loading
    this.azureLoader = new AzureEnvironmentLoader({
      appId: this.options.appId,
      endpoint: this.options.endpoint,
      authentication: this.options.authentication,
      environment: this.options.environment,
      customMappings: this.options.customMappings,
      throwOnError: false // Never throw, always fall back gracefully
    });
  }

  /**
   * Get configuration for the app with comprehensive fallback handling
   */
  async getConfiguration(): Promise<ApiConfigResponse> {
    const startTime = Date.now();
    this.resetDebugInfo();

    try {
      // Primary: Try app-scoped configuration (includes Azure + environment precedence)
      const config = await this.tryAppScopedConfiguration();
      if (config && Object.keys(config).length > 0) {
        this.debugInfo.sourcesUsed.push('app-scoped-provider');
        return this.buildSuccessResponse(config, 'app-scoped', startTime);
      }

      // Secondary: Try Azure environment loader with fallback
      const azureConfig = await this.tryAzureLoaderConfiguration();
      if (azureConfig && Object.keys(azureConfig).length > 0) {
        this.debugInfo.sourcesUsed.push('azure-loader');
        this.debugInfo.fallbackActivated = true;
        return this.buildSuccessResponse(azureConfig, 'azure-fallback', startTime);
      }

      // Tertiary: Try direct environment variable fallback
      if (this.options.enableLocalFallback) {
        const envConfig = this.getEnvironmentFallbackConfiguration();
        if (envConfig && Object.keys(envConfig).length > 0) {
          this.debugInfo.sourcesUsed.push('environment-fallback');
          this.debugInfo.fallbackActivated = true;
          return this.buildSuccessResponse(envConfig, 'environment-fallback', startTime);
        }
      }

      // If all sources return empty, log warning but return empty config
      logger.warn(`No configuration found for app "${this.options.appId}" from any source`);
      return this.buildSuccessResponse({}, 'empty', startTime);

    } catch (error) {
      logger.error(`Configuration loading failed for app "${this.options.appId}":`, error);
      this.debugInfo.errors.push(error instanceof Error ? error.message : String(error));
      
      // Last resort: try environment fallback even on error
      if (this.options.enableLocalFallback) {
        try {
          const envConfig = this.getEnvironmentFallbackConfiguration();
          this.debugInfo.sourcesUsed.push('error-fallback');
          this.debugInfo.fallbackActivated = true;
          return this.buildSuccessResponse(envConfig, 'error-fallback', Date.now());
        } catch (fallbackError) {
          this.debugInfo.errors.push(`Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }

      return this.buildErrorResponse(error, startTime);
    }
  }

  /**
   * Get specific configuration value
   */
  async getConfigurationValue(key: string): Promise<ApiConfigResponse> {
    const configResponse = await this.getConfiguration();
    
    if (!configResponse.success || !configResponse.data) {
      return configResponse;
    }

    const value = this.getNestedValue(configResponse.data, key);
    const singleValueConfig = { [key]: value };

    return {
      ...configResponse,
      data: singleValueConfig,
      config: singleValueConfig
    };
  }

  /**
   * Try loading configuration from app-scoped provider
   */
  private async tryAppScopedConfiguration(): Promise<ConfigurationValue | null> {
    try {
      logger.debug(`Attempting app-scoped configuration for app "${this.options.appId}"`);
      const config = await this.appScopedProvider.getAppConfiguration(this.options.appId);
      logger.debug(`App-scoped configuration loaded: ${Object.keys(config || {}).length} keys`);
      return config;
    } catch (error) {
      logger.debug(`App-scoped configuration failed for app "${this.options.appId}":`, error);
      this.debugInfo.errors.push(`AppScoped: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Try loading configuration from Azure loader
   */
  private async tryAzureLoaderConfiguration(): Promise<ConfigurationValue | null> {
    try {
      logger.debug(`Attempting Azure loader configuration for app "${this.options.appId}"`);
      const config = await this.azureLoader.getConfiguration();
      logger.debug(`Azure loader configuration loaded: ${Object.keys(config || {}).length} keys`);
      
      // Transform Azure config to match expected format
      return this.transformAzureConfigFormat(config);
    } catch (error) {
      logger.debug(`Azure loader configuration failed for app "${this.options.appId}":`, error);
      this.debugInfo.errors.push(`Azure: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get environment variable fallback configuration
   */
  private getEnvironmentFallbackConfiguration(): ConfigurationValue {
    const config: ConfigurationValue = {};
    const appIdUpper = this.options.appId.toUpperCase().replace(/-/g, '_');

    // Define patterns to search for environment variables
    const patterns = [
      // App-specific patterns
      `REACT_APP_${appIdUpper}_`,
      `${appIdUpper}_`,
      // Generic patterns  
      'REACT_APP_',
      // Standard patterns
      'NEXTAUTH_',
      'OKTA_',
      'AZURE_',
      'AUTH_',
      'API_',
      'DATABASE_'
    ];

    // Apply custom variable mappings if provided
    if (this.options.variableMappings) {
      for (const [targetKey, sourceKeys] of Object.entries(this.options.variableMappings)) {
        for (const sourceKey of sourceKeys) {
          const value = process.env[sourceKey];
          if (value !== undefined) {
            config[targetKey] = value;
            logger.debug(`Environment fallback mapping: ${sourceKey} -> ${targetKey}`);
            break; // Use first match
          }
        }
      }
    }

    // Search for variables matching patterns
    Object.keys(process.env).forEach(key => {
      const value = process.env[key];
      if (value !== undefined) {
        const matchesPattern = patterns.some(pattern => key.startsWith(pattern));
        if (matchesPattern) {
          // Transform key to nested format
          const transformedKey = this.transformEnvironmentKey(key);
          config[transformedKey] = value;
          config[key] = value; // Also keep original format
        }
      }
    });

    logger.debug(`Environment fallback configuration: ${Object.keys(config).length} keys for app "${this.options.appId}"`);
    return config;
  }

  /**
   * Transform environment variable key to nested format
   */
  private transformEnvironmentKey(key: string): string {
    // Remove common prefixes
    let transformed = key;
    
    const appIdUpper = this.options.appId.toUpperCase().replace(/-/g, '_');
    const prefixes = [
      `REACT_APP_${appIdUpper}_`,
      `${appIdUpper}_`,
      'REACT_APP_'
    ];

    for (const prefix of prefixes) {
      if (transformed.startsWith(prefix)) {
        transformed = transformed.substring(prefix.length);
        break;
      }
    }

    // Convert to lowercase and replace underscores with dots
    return transformed.toLowerCase().replace(/_/g, '.');
  }

  /**
   * Transform Azure config format to match environment variable format
   */
  private transformAzureConfigFormat(azureConfig: Record<string, any>): ConfigurationValue {
    const transformed: ConfigurationValue = {};

    Object.entries(azureConfig).forEach(([key, value]) => {
      // Keep original key
      transformed[key] = value;
      
      // Also create transformed version (dots to underscores, etc.)
      const envKey = key.replace(/\./g, '_').toUpperCase();
      transformed[envKey] = value;
      
      // Create nested version
      const nestedKey = key.toLowerCase();
      transformed[nestedKey] = value;
    });

    return transformed;
  }

  /**
   * Get nested value from configuration object
   */
  private getNestedValue(obj: ConfigurationValue, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Build successful API response
   */
  private buildSuccessResponse(config: ConfigurationValue, source: string, startTime: number): ApiConfigResponse {
    const response: ApiConfigResponse = {
      success: true,
      data: config,
      config: config, // Backward compatibility
      source,
      timestamp: Date.now(),
      appId: this.options.appId
    };

    if (this.options.includeDebugInfo) {
      response.debug = {
        sourcesUsed: this.debugInfo.sourcesUsed,
        fallbackActivated: this.debugInfo.fallbackActivated,
        variableCount: Object.keys(config).length,
        errors: this.debugInfo.errors.length > 0 ? this.debugInfo.errors : undefined
      };
    }

    logger.debug(`Configuration response for app "${this.options.appId}": ${JSON.stringify({
      source,
      variableCount: Object.keys(config).length,
      processingTime: Date.now() - startTime
    })}`);

    return response;
  }

  /**
   * Build error API response
   */
  private buildErrorResponse(error: unknown, startTime: number): ApiConfigResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    const response: ApiConfigResponse = {
      success: false,
      source: 'error',
      timestamp: Date.now(),
      appId: this.options.appId,
      error: errorMessage
    };

    if (this.options.includeDebugInfo) {
      response.debug = {
        sourcesUsed: this.debugInfo.sourcesUsed,
        fallbackActivated: this.debugInfo.fallbackActivated,
        variableCount: 0,
        errors: this.debugInfo.errors
      };
    }

    return response;
  }

  /**
   * Reset debug information for new request
   */
  private resetDebugInfo(): void {
    this.debugInfo = { errors: [], sourcesUsed: [], fallbackActivated: false };
  }

  /**
   * Refresh configuration cache
   */
  async refreshConfiguration(): Promise<void> {
    try {
      // Refresh app-scoped provider cache
      this.appScopedProvider.refreshAppConfiguration(this.options.appId);
      
      // Refresh Azure loader cache
      await this.azureLoader.refresh();
      
      logger.info(`Configuration cache refreshed for app "${this.options.appId}"`);
    } catch (error) {
      logger.error(`Failed to refresh configuration for app "${this.options.appId}":`, error);
      throw error;
    }
  }

  /**
   * Get debug information about configuration sources
   */
  async getDebugInfo(): Promise<any> {
    const azureInfo = this.appScopedProvider.getAzureConfigInfo(this.options.appId);
    const availableApps = this.appScopedProvider.getAvailableApps();
    
    return {
      appId: this.options.appId,
      availableApps,
      azure: azureInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAppSpecificVars: this.hasAppSpecificEnvironmentVars(),
        fallbackEnabled: this.options.enableLocalFallback
      },
      cache: this.appScopedProvider.getCacheStats(),
      options: {
        endpoint: this.options.endpoint,
        enableLocalFallback: this.options.enableLocalFallback,
        includeDebugInfo: this.options.includeDebugInfo
      }
    };
  }

  /**
   * Check if app has app-specific environment variables
   */
  private hasAppSpecificEnvironmentVars(): boolean {
    const appIdUpper = this.options.appId.toUpperCase().replace(/-/g, '_');
    const prefix = `REACT_APP_${appIdUpper}_`;
    
    return Object.keys(process.env).some(key => key.startsWith(prefix));
  }
}

/**
 * Factory function for creating API route configuration handlers
 */
export function createAppConfigHandler(options: ApiRouteHandlerOptions): ApiRouteConfigHandler {
  return new ApiRouteConfigHandler(options);
}

/**
 * Enhanced createAppAzureLoader that returns a handler suitable for API routes
 * This replaces the previous implementation that only returned AzureEnvironmentLoader
 */
export function createAppAzureLoader(options: ApiRouteHandlerOptions): ApiRouteConfigHandler {
  logger.debug(`Creating enhanced app Azure loader for app "${options.appId}"`);
  return new ApiRouteConfigHandler(options);
}

// Backward compatibility: also export the original AzureEnvironmentLoader factory
export { createAppAzureLoader as createAppAzureLoaderLegacy } from './azure-env-loader';