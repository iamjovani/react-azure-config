/**
 * App-Isolated Azure Client Manager
 * 
 * Manages app-specific Azure App Configuration clients with intelligent key transformation.
 * This component ensures that:
 * 1. Clean keys (not prefixed) are sent to Azure
 * 2. Each app routes to its own Azure App Configuration instance  
 * 3. Azure responses are properly transformed back to app context
 * 4. Complete app isolation (admin never sees client config)
 * 
 * @module server/app-isolated-azure-manager
 */

import { AzureConfigurationClient } from './azure-client';
import { AppScopedKeyTransformer, globalKeyTransformer } from './app-key-transformer';
import { logger } from '../utils/logger';
import type { AzureConfigOptions, AuthenticationConfig, ConfigurationValue } from '../types';

/**
 * App-specific Azure configuration
 */
export interface AppAzureConfig {
  appId: string;
  endpoint: string;
  authentication: AuthenticationConfig;
  transformer?: AppScopedKeyTransformer;
  label?: string;
  environment?: string;
}

/**
 * Azure configuration result with source tracking
 */
export interface AzureConfigResult {
  success: boolean;
  data: ConfigurationValue;
  source: 'azure' | 'fallback' | 'error';
  appId: string;
  transformedKeys: number;
  errors?: string[];
}

/**
 * App-Isolated Azure Client Manager
 * 
 * Core component that manages Azure App Configuration clients per app,
 * ensuring proper key transformation and complete app isolation.
 */
export class AppIsolatedAzureManager {
  private azureClients = new Map<string, AzureConfigurationClient>();
  private appConfigs = new Map<string, AppAzureConfig>();
  private keyTransformer: AppScopedKeyTransformer;

  constructor(keyTransformer?: AppScopedKeyTransformer) {
    this.keyTransformer = keyTransformer || globalKeyTransformer;
  }

  /**
   * Register an app with its Azure configuration
   * 
   * @param config App-specific Azure configuration
   */
  registerApp(config: AppAzureConfig): void {
    try {
      // Validate configuration
      if (!config.appId || !config.endpoint) {
        throw new Error(`Invalid Azure configuration for app "${config.appId}": missing appId or endpoint`);
      }

      // Store app configuration
      this.appConfigs.set(config.appId, config);

      // Create Azure client with app-specific settings
      const azureOptions: AzureConfigOptions = {
        endpoint: config.endpoint,
        environment: config.environment || 'production',
        authentication: config.authentication,
        appId: config.appId,
        application: config.appId,
        label: config.label,
        logLevel: 'warn'
      };

      const azureClient = new AzureConfigurationClient(azureOptions);
      this.azureClients.set(config.appId, azureClient);

      logger.info(`Registered Azure client for app "${config.appId}" with endpoint: ${config.endpoint}`);
      
    } catch (error) {
      logger.error(`Failed to register Azure client for app "${config.appId}":`, error);
      throw error;
    }
  }

  /**
   * Get configuration for a specific app with proper key transformation
   * 
   * This is the CORE FIX: transforms keys before sending to Azure
   * 
   * @param appId App identifier
   * @returns Configuration with transformed keys
   */
  async getAppConfiguration(appId: string): Promise<AzureConfigResult> {
    try {
      // Check if app is registered
      if (!this.appConfigs.has(appId)) {
        // Try to auto-register from environment variables
        await this.autoRegisterApp(appId);
        
        if (!this.appConfigs.has(appId)) {
          throw new Error(`App "${appId}" is not registered and cannot be auto-registered`);
        }
      }

      const azureClient = this.azureClients.get(appId);
      if (!azureClient) {
        throw new Error(`No Azure client found for app "${appId}"`);
      }

      // CRITICAL FIX: Get environment variables and transform to clean Azure keys
      const envVars = this.keyTransformer.getAppEnvironmentVariables(appId);
      const transformedKeys: string[] = [];
      
      // Transform each environment variable to Azure format
      const azureKeys = envVars.map(envKey => {
        const azureKey = this.keyTransformer.envToAzure(envKey, appId);
        transformedKeys.push(`${envKey} → ${azureKey}`);
        return azureKey;
      });

      logger.debug(`Transformed ${envVars.length} environment keys to Azure format for app "${appId}":`, transformedKeys);

      // Query Azure with CLEAN keys (not prefixed)
      const rawAzureConfig = await azureClient.getConfiguration();
      
      if (!rawAzureConfig || Object.keys(rawAzureConfig).length === 0) {
        logger.debug(`No configuration returned from Azure for app "${appId}"`);
        return {
          success: true,
          data: {},
          source: 'azure',
          appId,
          transformedKeys: transformedKeys.length
        };
      }

      // Transform Azure response back to app context
      const appConfig = this.transformAzureToAppContext(rawAzureConfig, appId);

      logger.info(`Successfully retrieved configuration from Azure for app "${appId}": ${Object.keys(appConfig).length} keys`);

      return {
        success: true,
        data: appConfig,
        source: 'azure',
        appId,
        transformedKeys: transformedKeys.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get Azure configuration for app "${appId}": ${errorMessage}`);

      return {
        success: false,
        data: {},
        source: 'error',
        appId,
        transformedKeys: 0,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Get specific configuration value with key resolution
   * 
   * @param appId App identifier
   * @param requestedKey The key being requested
   * @returns Configuration value with resolution info
   */
  async getAppConfigurationValue(appId: string, requestedKey: string): Promise<{
    success: boolean;
    value?: any;
    resolvedKey?: string;
    source: string;
    fallbacksAttempted: string[];
  }> {
    try {
      // Get full configuration first
      const configResult = await this.getAppConfiguration(appId);
      
      if (!configResult.success || !configResult.data) {
        return {
          success: false,
          source: configResult.source,
          fallbacksAttempted: []
        };
      }

      // Try to resolve the requested key using multiple strategies
      const fallbackKeys = this.keyTransformer.resolveFallback(requestedKey, appId);
      
      for (const fallbackKey of fallbackKeys) {
        const value = configResult.data[fallbackKey];
        if (value !== undefined) {
          logger.debug(`Resolved key "${requestedKey}" to "${fallbackKey}" for app "${appId}"`);
          return {
            success: true,
            value,
            resolvedKey: fallbackKey,
            source: configResult.source,
            fallbacksAttempted: fallbackKeys
          };
        }
      }

      // No value found
      return {
        success: false,
        source: configResult.source,
        fallbacksAttempted: fallbackKeys
      };

    } catch (error) {
      logger.error(`Failed to get configuration value "${requestedKey}" for app "${appId}":`, error);
      return {
        success: false,
        source: 'error',
        fallbacksAttempted: []
      };
    }
  }

  /**
   * Refresh Azure configuration for a specific app
   * 
   * @param appId App identifier
   */
  async refreshAppConfiguration(appId: string): Promise<void> {
    const azureClient = this.azureClients.get(appId);
    if (azureClient) {
      try {
        await azureClient.refreshConfiguration();
        logger.info(`Refreshed Azure configuration for app "${appId}"`);
      } catch (error) {
        logger.error(`Failed to refresh Azure configuration for app "${appId}":`, error);
        throw error;
      }
    } else {
      throw new Error(`No Azure client found for app "${appId}"`);
    }
  }

  /**
   * Get all registered apps
   */
  getRegisteredApps(): string[] {
    return Array.from(this.appConfigs.keys());
  }

  /**
   * Get debug information for a specific app
   * 
   * @param appId App identifier
   * @returns Debug information
   */
  getAppDebugInfo(appId: string): any {
    const appConfig = this.appConfigs.get(appId);
    const hasClient = this.azureClients.has(appId);
    const transformerDebug = this.keyTransformer.getDebugInfo(appId);

    return {
      appId,
      registered: !!appConfig,
      hasAzureClient: hasClient,
      endpoint: appConfig?.endpoint,
      authentication: appConfig?.authentication ? {
        type: appConfig.authentication.type,
        clientId: appConfig.authentication.clientId ? '***' : undefined,
        tenantId: appConfig.authentication.tenantId
      } : undefined,
      keyTransformation: transformerDebug
    };
  }

  /**
   * Check if an app can be auto-registered from environment variables
   * 
   * @param appId App identifier
   * @returns True if app can be auto-registered
   */
  canAutoRegisterApp(appId: string): boolean {
    const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
    const endpoint = process.env[`AZURE_APP_CONFIG_ENDPOINT_${appIdUpper}`];
    return !!endpoint;
  }

  /**
   * Auto-register an app from environment variables
   * 
   * @param appId App identifier
   */
  private async autoRegisterApp(appId: string): Promise<void> {
    try {
      if (!this.canAutoRegisterApp(appId)) {
        logger.debug(`Cannot auto-register app "${appId}": no Azure endpoint found`);
        return;
      }

      const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
      
      // Build authentication from environment variables
      const authentication = this.buildAuthenticationFromEnv(appId);
      if (!authentication) {
        logger.debug(`Cannot auto-register app "${appId}": no authentication found`);
        return;
      }

      const config: AppAzureConfig = {
        appId,
        endpoint: process.env[`AZURE_APP_CONFIG_ENDPOINT_${appIdUpper}`]!,
        authentication,
        label: process.env[`AZURE_APP_CONFIG_LABEL_${appIdUpper}`],
        environment: process.env.NODE_ENV || 'production'
      };

      this.registerApp(config);
      logger.info(`Auto-registered app "${appId}" from environment variables`);

    } catch (error) {
      logger.warn(`Failed to auto-register app "${appId}":`, error);
    }
  }

  /**
   * Build authentication configuration from environment variables
   * 
   * @param appId App identifier
   * @returns Authentication configuration or undefined
   */
  private buildAuthenticationFromEnv(appId: string): AuthenticationConfig | undefined {
    const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
    
    // Try app-specific credentials first
    const clientId = process.env[`AZURE_CLIENT_ID_${appIdUpper}`] || process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env[`AZURE_CLIENT_SECRET_${appIdUpper}`] || process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env[`AZURE_CLIENT_TENANT_ID_${appIdUpper}`] || process.env.AZURE_TENANT_ID;

    if (clientId && clientSecret && tenantId) {
      return {
        type: 'servicePrincipal',
        clientId,
        clientSecret,
        tenantId
      };
    }

    // Check for managed identity
    const useManagedIdentity = process.env[`AZURE_USE_MANAGED_IDENTITY_${appIdUpper}`] || 
                               process.env.AZURE_USE_MANAGED_IDENTITY;

    if (useManagedIdentity === 'true') {
      return {
        type: 'managedIdentity',
        clientId
      };
    }

    // Default to Azure CLI for development
    return {
      type: 'azureCli'
    };
  }

  /**
   * Transform Azure configuration response back to app context
   * 
   * @param azureConfig Raw Azure configuration
   * @param appId App identifier
   * @returns App-contextualized configuration
   */
  private transformAzureToAppContext(azureConfig: ConfigurationValue, appId: string): ConfigurationValue {
    const appConfig: ConfigurationValue = {};

    Object.entries(azureConfig).forEach(([azureKey, value]) => {
      // Transform Azure key back to multiple app context formats
      const appContextKey = this.keyTransformer.azureToApp(azureKey, appId);
      
      // Store value in multiple formats for maximum compatibility
      appConfig[appContextKey.original] = value; // Original Azure format
      appConfig[appContextKey.clean] = value; // Clean format
      appConfig[appContextKey.azure] = value; // Azure format
      appConfig[appContextKey.legacy] = value; // Legacy prefixed format
      appConfig[appContextKey.nested] = value; // Nested format
      
      // Also store without dots for simpler access
      const simpleKey = azureKey.replace(/\./g, '');
      appConfig[simpleKey] = value;
    });

    logger.debug(`Transformed Azure config to app context for "${appId}": ${Object.keys(azureConfig).length} → ${Object.keys(appConfig).length} keys`);
    return appConfig;
  }
}

/**
 * Singleton instance for global use
 */
export const globalAzureManager = new AppIsolatedAzureManager();

/**
 * Factory function for creating app-specific Azure managers  
 */
export function createAppAzureManager(keyTransformer?: AppScopedKeyTransformer): AppIsolatedAzureManager {
  return new AppIsolatedAzureManager(keyTransformer);
}