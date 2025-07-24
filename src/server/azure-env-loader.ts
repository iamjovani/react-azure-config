/**
 * Azure Environment Pre-Population Utility
 * 
 * Loads Azure App Configuration values and populates process.env before NextAuth 
 * and other server-side components initialize. This bridges the gap between 
 * NextAuth's static environment variable requirements and Azure's dynamic configuration.
 * 
 * @module server/azure-env-loader
 */

import { AzureConfigurationClient } from './azure-client';
import { AppScopedConfigurationProvider } from '../app-scoped-config';
import { logger } from '../utils/logger';
import type { AzureConfigOptions, AuthenticationConfig } from '../types';

/**
 * Configuration mapping for NextAuth environment variables
 */
export interface NextAuthAzureMapping {
  /** Azure config key to NextAuth environment variable mappings */
  mappings: Record<string, string>;
  /** App ID for multi-app scenarios */
  appId?: string;
  /** Prefix for Azure configuration keys */
  keyPrefix?: string;
}

/**
 * Options for Azure environment loading
 */
export interface AzureEnvLoaderOptions {
  /** Azure App Configuration endpoint */
  endpoint?: string;
  /** Authentication configuration */
  authentication?: AuthenticationConfig;
  /** Environment (dev/staging/production) */
  environment?: string;
  /** App ID for multi-app support */
  appId?: string;
  /** NextAuth specific mappings */
  nextAuth?: NextAuthAzureMapping;
  /** Custom key mappings */
  customMappings?: Record<string, string>;
  /** Whether to throw on errors or fail silently */
  throwOnError?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Default NextAuth environment variable mappings
 */
const DEFAULT_NEXTAUTH_MAPPINGS: Record<string, string> = {
  'auth.nextauth.secret': 'NEXTAUTH_SECRET',
  'auth.nextauth.url': 'NEXTAUTH_URL',
  'auth.okta.clientId': 'OKTA_CLIENT_ID',
  'auth.okta.clientSecret': 'OKTA_CLIENT_SECRET',
  'auth.okta.issuer': 'OKTA_ISSUER',
  'auth.oauth.clientId': 'OAUTH_CLIENT_ID',
  'auth.oauth.clientSecret': 'OAUTH_CLIENT_SECRET',
  'auth.azure.clientId': 'AZURE_AD_CLIENT_ID',
  'auth.azure.clientSecret': 'AZURE_AD_CLIENT_SECRET',
  'auth.azure.tenantId': 'AZURE_AD_TENANT_ID'
};

/**
 * Azure Environment Loader Class
 * 
 * Loads configuration from Azure App Configuration and populates process.env
 * before NextAuth and other server components initialize.
 */
export class AzureEnvironmentLoader {
  private client: AzureConfigurationClient | null = null;
  private appScopedProvider: AppScopedConfigurationProvider | null = null;
  private options: AzureEnvLoaderOptions;
  private lastLoaded: number = 0;

  constructor(options: AzureEnvLoaderOptions = {}) {
    this.options = {
      environment: process.env.NODE_ENV || 'production',
      throwOnError: false,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      ...options
    };
  }

  /**
   * Initialize Azure client for configuration loading
   */
  private async initializeClient(): Promise<boolean> {
    try {
      // If app ID is specified, use app-scoped provider
      if (this.options.appId) {
        this.appScopedProvider = new AppScopedConfigurationProvider();
        return true;
      }

      // Otherwise use direct Azure client
      const azureOptions: AzureConfigOptions = {
        endpoint: this.options.endpoint || process.env.AZURE_APP_CONFIG_ENDPOINT,
        environment: this.options.environment!,
        authentication: this.options.authentication || this.buildDefaultAuthentication(),
        logLevel: 'warn'
      };

      if (!azureOptions.endpoint) {
        logger.debug('No Azure App Configuration endpoint found, skipping Azure env loading');
        return false;
      }

      this.client = new AzureConfigurationClient(azureOptions);
      return true;
    } catch (error) {
      logger.error('Failed to initialize Azure client for environment loading:', error);
      if (this.options.throwOnError) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Build default authentication from environment variables
   */
  private buildDefaultAuthentication(): AuthenticationConfig | undefined {
    const appId = this.options.appId;
    const appIdUpper = appId ? appId.toUpperCase().replace(/-/g, '_') : '';

    // Try app-specific credentials first, then fall back to global
    const clientId = appId 
      ? (process.env[`AZURE_CLIENT_ID_${appIdUpper}`] || process.env.AZURE_CLIENT_ID)
      : process.env.AZURE_CLIENT_ID;
      
    const clientSecret = appId
      ? (process.env[`AZURE_CLIENT_SECRET_${appIdUpper}`] || process.env.AZURE_CLIENT_SECRET)
      : process.env.AZURE_CLIENT_SECRET;
      
    const tenantId = appId
      ? (process.env[`AZURE_CLIENT_TENANT_ID_${appIdUpper}`] || process.env.AZURE_TENANT_ID)
      : process.env.AZURE_TENANT_ID;

    if (clientId && clientSecret && tenantId) {
      return {
        type: 'servicePrincipal',
        clientId,
        clientSecret,
        tenantId
      };
    }

    // Check for managed identity
    const useManagedIdentity = appId
      ? process.env[`AZURE_USE_MANAGED_IDENTITY_${appIdUpper}`]
      : process.env.AZURE_USE_MANAGED_IDENTITY;

    if (useManagedIdentity === 'true') {
      return {
        type: 'managedIdentity',
        clientId // Optional for user-assigned managed identity
      };
    }

    return undefined;
  }

  /**
   * Load configuration from Azure and populate process.env
   */
  async loadToProcessEnv(): Promise<void> {
    // Check cache TTL
    const now = Date.now();
    if (this.lastLoaded && (now - this.lastLoaded) < (this.options.cacheTtl || 0)) {
      logger.debug('Using cached Azure environment values');
      return;
    }

    try {
      // Initialize client if needed
      const clientReady = await this.initializeClient();
      if (!clientReady) {
        logger.debug('Azure client not available, skipping environment loading');
        return;
      }

      // Load configuration
      let config: Record<string, any> = {};
      
      if (this.appScopedProvider && this.options.appId) {
        config = await this.appScopedProvider.getAppConfiguration(this.options.appId);
      } else if (this.client) {
        config = await this.client.getConfiguration();
      }

      if (!config || Object.keys(config).length === 0) {
        logger.debug('No configuration loaded from Azure App Configuration');
        return;
      }

      // Apply mappings and populate process.env
      this.applyMappings(config);
      
      this.lastLoaded = now;
      logger.info(`Loaded ${Object.keys(config).length} configuration values from Azure to process.env`);
      
    } catch (error) {
      logger.error('Failed to load Azure configuration to process.env:', error);
      if (this.options.throwOnError) {
        throw error;
      }
    }
  }

  /**
   * Apply configuration mappings to process.env
   */
  private applyMappings(config: Record<string, any>): void {
    // Apply NextAuth mappings
    const nextAuthMappings = {
      ...DEFAULT_NEXTAUTH_MAPPINGS,
      ...this.options.nextAuth?.mappings
    };

    for (const [azureKey, envKey] of Object.entries(nextAuthMappings)) {
      const value = this.getNestedValue(config, azureKey);
      if (value !== undefined && value !== null) {
        process.env[envKey] = String(value);
        logger.debug(`Mapped ${azureKey} -> ${envKey}`);
      }
    }

    // Apply custom mappings
    if (this.options.customMappings) {
      for (const [azureKey, envKey] of Object.entries(this.options.customMappings)) {
        const value = this.getNestedValue(config, azureKey);
        if (value !== undefined && value !== null) {
          process.env[envKey] = String(value);
          logger.debug(`Custom mapping ${azureKey} -> ${envKey}`);
        }
      }
    }

    // Apply app-specific prefix if provided
    const keyPrefix = this.options.nextAuth?.keyPrefix;
    if (keyPrefix) {
      for (const [key, value] of Object.entries(config)) {
        if (key.startsWith(keyPrefix)) {
          const envKey = key.replace(keyPrefix, '').toUpperCase().replace(/[.-]/g, '_');
          process.env[envKey] = String(value);
          logger.debug(`Prefixed mapping ${key} -> ${envKey}`);
        }
      }
    }
  }

  /**
   * Get nested value from configuration object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Refresh configuration from Azure
   */
  async refresh(): Promise<void> {
    this.lastLoaded = 0; // Reset cache
    await this.loadToProcessEnv();
  }

  /**
   * Get current configuration without modifying process.env
   */
  async getConfiguration(): Promise<Record<string, any>> {
    const clientReady = await this.initializeClient();
    if (!clientReady) {
      return {};
    }

    if (this.appScopedProvider && this.options.appId) {
      return await this.appScopedProvider.getAppConfiguration(this.options.appId);
    } else if (this.client) {
      return await this.client.getConfiguration();
    }

    return {};
  }
}

/**
 * Convenience function to load Azure configuration to process.env
 * 
 * Use this in your application startup (next.config.js, server.js, etc.)
 * before NextAuth or other components that require environment variables.
 */
export async function loadAzureToProcessEnv(options: AzureEnvLoaderOptions = {}): Promise<void> {
  const loader = new AzureEnvironmentLoader(options);
  await loader.loadToProcessEnv();
}

/**
 * Create an Azure environment loader for a specific app
 */
export function createAppAzureLoader(appId: string, options: Omit<AzureEnvLoaderOptions, 'appId'> = {}): AzureEnvironmentLoader {
  return new AzureEnvironmentLoader({
    ...options,
    appId
  });
}

/**
 * Pre-configured NextAuth Azure loader
 */
export function createNextAuthAzureLoader(options: AzureEnvLoaderOptions = {}): AzureEnvironmentLoader {
  return new AzureEnvironmentLoader({
    ...options,
    nextAuth: {
      mappings: DEFAULT_NEXTAUTH_MAPPINGS,
      ...options.nextAuth
    }
  });
}