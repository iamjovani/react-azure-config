/**
 * Bulletproof Fallback System
 * 
 * Ensures environment variables work identically to Azure configuration when Azure is unavailable.
 * This component addresses the critical bug where fallback data wasn't properly propagated
 * to React components, despite being captured correctly on the server side.
 * 
 * Key Features:
 * 1. Seamless fallback activation when Azure fails
 * 2. Environment variables processed with same format as Azure responses
 * 3. Complete app isolation maintained in fallback mode
 * 4. Multiple resolution strategies for maximum compatibility
 * 5. Transparent switching between Azure and fallback data
 * 
 * @module server/bulletproof-fallback-system
 */

import { AppScopedKeyTransformer, globalKeyTransformer } from './app-key-transformer';
import { AppAwareClientResolver, globalClientResolver } from '../client/app-aware-resolver';
import { logger } from '../utils/logger';
import type { ConfigurationValue, AzureConfigOptions } from '../types';

/**
 * Fallback data source configuration
 */
export interface FallbackSource {
  name: string;
  priority: number;
  getData: (appId: string) => ConfigurationValue;
  isAvailable: (appId: string) => boolean;
}

/**
 * Fallback resolution result with comprehensive tracking
 */
export interface FallbackResult {
  success: boolean;
  data: ConfigurationValue;
  source: string;
  appId: string;
  sourcesAttempted: string[];
  variablesFound: number;
  transformedKeys: number;
  resolutionStrategies: string[];
  fallbackActivated: boolean;
  errors?: string[];
  debug?: {
    environmentVariables: string[];
    transformations: Array<{ env: string; azure: string; app: string }>;
    resolutionAttempts: Array<{ key: string; strategy: string; success: boolean }>;
    fallbackSources: Array<{ name: string; available: boolean; variableCount: number }>;
  };
}

/**
 * Bulletproof Fallback System
 * 
 * Core component that provides seamless fallback functionality when Azure App Configuration
 * is unavailable. Ensures environment variables are processed and delivered with the same
 * format and behavior as Azure configuration.
 */
export class BulletproofFallbackSystem {
  private keyTransformer: AppScopedKeyTransformer;
  private clientResolver: AppAwareClientResolver;
  private fallbackSources: FallbackSource[] = [];
  private debugMode: boolean = false;

  constructor(
    keyTransformer?: AppScopedKeyTransformer,
    clientResolver?: AppAwareClientResolver
  ) {
    this.keyTransformer = keyTransformer || globalKeyTransformer;
    this.clientResolver = clientResolver || globalClientResolver;
    this.initializeDefaultFallbackSources();
  }

  /**
   * Enable debug mode for detailed logging
   */
  enableDebugMode(): void {
    this.debugMode = true;
    logger.info('Bulletproof Fallback System: Debug mode enabled');
  }

  /**
   * Initialize default fallback sources in priority order
   */
  private initializeDefaultFallbackSources(): void {
    // Priority 1: App-specific environment variables (highest priority)
    this.addFallbackSource({
      name: 'app-environment-variables',
      priority: 1,
      getData: (appId: string) => this.getAppEnvironmentVariables(appId),
      isAvailable: (appId: string) => this.hasAppEnvironmentVariables(appId)
    });

    // Priority 2: Global environment variables with app context
    this.addFallbackSource({
      name: 'global-environment-variables',
      priority: 2,
      getData: (appId: string) => this.getGlobalEnvironmentVariables(appId),
      isAvailable: () => true // Always available
    });

    // Priority 3: Default configuration values
    this.addFallbackSource({
      name: 'default-configuration',
      priority: 3,
      getData: (appId: string) => this.getDefaultConfiguration(appId),
      isAvailable: () => true // Always available
    });

    logger.debug(`Initialized ${this.fallbackSources.length} fallback sources`);
  }

  /**
   * Add a custom fallback source
   */
  addFallbackSource(source: FallbackSource): void {
    this.fallbackSources.push(source);
    this.fallbackSources.sort((a, b) => a.priority - b.priority);
    logger.debug(`Added fallback source "${source.name}" with priority ${source.priority}`);
  }

  /**
   * Get comprehensive fallback configuration for an app
   * 
   * This is the CORE FIX: provides Azure-equivalent data from environment variables
   * 
   * @param appId App identifier
   * @param includeDebugInfo Whether to include debug information
   * @returns Complete fallback configuration result
   */
  async getFallbackConfiguration(
    appId: string,
    includeDebugInfo: boolean = false
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const sourcesAttempted: string[] = [];
    const errors: string[] = [];
    const transformations: Array<{ env: string; azure: string; app: string }> = [];
    const resolutionAttempts: Array<{ key: string; strategy: string; success: boolean }> = [];
    const sourcesInfo: Array<{ name: string; available: boolean; variableCount: number }> = [];

    try {
      logger.info(`Getting fallback configuration for app "${appId}"`);

      // Combined configuration from all sources
      let combinedConfig: ConfigurationValue = {};
      let totalVariablesFound = 0;
      let transformedKeysCount = 0;

      // Try each fallback source in priority order
      for (const source of this.fallbackSources) {
        sourcesAttempted.push(source.name);
        
        try {
          const isAvailable = source.isAvailable(appId);
          const sourceData = isAvailable ? source.getData(appId) : {};
          const variableCount = Object.keys(sourceData).length;
          
          sourcesInfo.push({
            name: source.name,
            available: isAvailable,
            variableCount
          });

          if (isAvailable && variableCount > 0) {
            // Transform and merge source data
            const transformedData = await this.transformSourceData(sourceData, appId, transformations);
            combinedConfig = { ...combinedConfig, ...transformedData };
            totalVariablesFound += variableCount;
            transformedKeysCount += transformations.length;

            logger.debug(`Fallback source "${source.name}" contributed ${variableCount} variables`);
          }
        } catch (sourceError) {
          const errorMessage = `Failed to get data from fallback source "${source.name}": ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`;
          errors.push(errorMessage);
          logger.warn(errorMessage);
        }
      }

      // Apply client-side resolution strategies to ensure maximum compatibility
      const finalConfig = await this.applyResolutionStrategies(
        combinedConfig,
        appId,
        resolutionAttempts
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      logger.info(`Fallback configuration complete for app "${appId}": ${Object.keys(finalConfig).length} keys in ${processingTime}ms`);

      const result: FallbackResult = {
        success: true,
        data: finalConfig,
        source: 'fallback',
        appId,
        sourcesAttempted,
        variablesFound: totalVariablesFound,
        transformedKeys: transformedKeysCount,
        resolutionStrategies: [...new Set(resolutionAttempts.map(a => a.strategy))],
        fallbackActivated: true,
        errors: errors.length > 0 ? errors : undefined
      };

      // Add debug information if requested
      if (includeDebugInfo || this.debugMode) {
        result.debug = {
          environmentVariables: this.keyTransformer.getAppEnvironmentVariables(appId),
          transformations,
          resolutionAttempts,
          fallbackSources: sourcesInfo
        };
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get fallback configuration for app "${appId}": ${errorMessage}`);

      return {
        success: false,
        data: {},
        source: 'fallback-error',
        appId,
        sourcesAttempted,
        variablesFound: 0,
        transformedKeys: 0,
        resolutionStrategies: [],
        fallbackActivated: true,
        errors: [errorMessage, ...errors]
      };
    }
  }

  /**
   * Get specific configuration value with fallback resolution
   * 
   * @param appId App identifier
   * @param requestedKey The key being requested
   * @returns Configuration value with resolution details
   */
  async getFallbackConfigurationValue(
    appId: string,
    requestedKey: string
  ): Promise<{
    success: boolean;
    value?: any;
    resolvedKey?: string;
    strategy?: string;
    source: string;
    fallbacksAttempted: string[];
  }> {
    try {
      // Get full fallback configuration
      const fallbackResult = await this.getFallbackConfiguration(appId);
      
      if (!fallbackResult.success || !fallbackResult.data) {
        return {
          success: false,
          source: 'fallback-error',
          fallbacksAttempted: []
        };
      }

      // Use client resolver to find the requested value
      const resolution = this.clientResolver.resolve(requestedKey, fallbackResult.data, appId);
      
      if (resolution.found && resolution.value !== undefined) {
        logger.debug(`Resolved fallback value for "${requestedKey}" using strategy "${resolution.strategy}"`);
        return {
          success: true,
          value: resolution.value,
          resolvedKey: resolution.resolvedKey,
          strategy: resolution.strategy,
          source: 'fallback',
          fallbacksAttempted: resolution.attemptedKeys
        };
      }

      // Try additional fallback key resolution
      const fallbackKeys = this.keyTransformer.resolveFallback(requestedKey, appId);
      for (const fallbackKey of fallbackKeys) {
        const value = fallbackResult.data[fallbackKey];
        if (value !== undefined) {
          logger.debug(`Found fallback value for "${requestedKey}" using key "${fallbackKey}"`);
          return {
            success: true,
            value,
            resolvedKey: fallbackKey,
            strategy: 'transformer-fallback',
            source: 'fallback',
            fallbacksAttempted: fallbackKeys
          };
        }
      }

      return {
        success: false,
        source: 'fallback',
        fallbacksAttempted: [...resolution.attemptedKeys, ...fallbackKeys]
      };

    } catch (error) {
      logger.error(`Failed to get fallback value for "${requestedKey}" in app "${appId}":`, error);
      return {
        success: false,
        source: 'fallback-error',
        fallbacksAttempted: []
      };
    }
  }

  /**
   * Check if fallback is available for an app
   * 
   * @param appId App identifier
   * @returns True if fallback data is available
   */
  isFallbackAvailable(appId: string): boolean {
    return this.fallbackSources.some(source => source.isAvailable(appId));
  }

  /**
   * Get app-specific environment variables with proper transformation
   */
  private getAppEnvironmentVariables(appId: string): ConfigurationValue {
    const config: ConfigurationValue = {};
    const appVars = this.keyTransformer.getAppEnvironmentVariables(appId);
    
    appVars.forEach(envKey => {
      const value = process.env[envKey];
      if (value !== undefined) {
        // Create comprehensive key mapping for maximum compatibility
        const mapping = this.keyTransformer.createKeyMapping(envKey, appId);
        Object.assign(config, mapping);
      }
    });

    return config;
  }

  /**
   * Check if app has specific environment variables
   */
  private hasAppEnvironmentVariables(appId: string): boolean {
    const appVars = this.keyTransformer.getAppEnvironmentVariables(appId);
    return appVars.length > 0;
  }

  /**
   * Get global environment variables with app context
   */
  private getGlobalEnvironmentVariables(appId: string): ConfigurationValue {
    const config: ConfigurationValue = {};
    
    // Common environment variables that should be available to all apps
    const globalVars = [
      'NODE_ENV',
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
      'AZURE_TENANT_ID',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'OKTA_CLIENT_ID',
      'OKTA_CLIENT_SECRET',
      'OKTA_ISSUER'
    ];

    globalVars.forEach(envKey => {
      const value = process.env[envKey];
      if (value !== undefined) {
        // Transform global variables to app-specific format
        const azureKey = this.keyTransformer.envToAzure(envKey, appId);
        const appContext = this.keyTransformer.azureToApp(azureKey, appId);
        
        // Store in multiple formats
        config[envKey] = value;
        config[azureKey] = value;
        config[appContext.clean] = value;
        config[appContext.nested] = value;
      }
    });

    return config;
  }

  /**
   * Get default configuration values for an app
   */
  private getDefaultConfiguration(appId: string): ConfigurationValue {
    const defaults: ConfigurationValue = {
      'environment': process.env.NODE_ENV || 'development',
      'app.id': appId,
      'app.name': appId,
      'fallback.enabled': 'true',
      'fallback.source': 'environment'
    };

    return defaults;
  }

  /**
   * Transform source data with proper key mapping
   */
  private async transformSourceData(
    sourceData: ConfigurationValue,
    appId: string,
    transformations: Array<{ env: string; azure: string; app: string }>
  ): Promise<ConfigurationValue> {
    const transformed: ConfigurationValue = {};

    Object.entries(sourceData).forEach(([key, value]) => {
      // Track transformation
      const azureKey = this.keyTransformer.envToAzure(key, appId);
      const appContext = this.keyTransformer.azureToApp(azureKey, appId);
      
      transformations.push({
        env: key,
        azure: azureKey,
        app: appContext.clean
      });

      // Store value in multiple formats for maximum compatibility
      transformed[key] = value; // Original format
      transformed[azureKey] = value; // Azure format
      transformed[appContext.original] = value; // Original Azure format
      transformed[appContext.clean] = value; // Clean format
      transformed[appContext.legacy] = value; // Legacy format
      transformed[appContext.nested] = value; // Nested format
    });

    return transformed;
  }

  /**
   * Apply client-side resolution strategies to configuration
   */
  private async applyResolutionStrategies(
    config: ConfigurationValue,
    appId: string,
    resolutionAttempts: Array<{ key: string; strategy: string; success: boolean }>
  ): Promise<ConfigurationValue> {
    const enhancedConfig = { ...config };
    const configKeys = Object.keys(config);

    // For each key in the configuration, try to resolve it using all strategies
    // This ensures maximum compatibility with different client-side requests
    for (const key of configKeys) {
      const resolution = this.clientResolver.resolve(key, config, appId);
      
      resolutionAttempts.push({
        key,
        strategy: resolution.strategy,
        success: resolution.found
      });

      // If resolution found additional mappings, add them
      if (resolution.found && resolution.resolvedKey && resolution.resolvedKey !== key) {
        enhancedConfig[resolution.resolvedKey] = config[key];
      }
    }

    return enhancedConfig;
  }

  /**
   * Get comprehensive debug information about fallback system
   */
  getDebugInfo(appId: string): any {
    const sourcesInfo = this.fallbackSources.map(source => ({
      name: source.name,
      priority: source.priority,
      available: source.isAvailable(appId),
      variableCount: source.isAvailable(appId) ? Object.keys(source.getData(appId)).length : 0
    }));

    return {
      appId,
      debugMode: this.debugMode,
      fallbackAvailable: this.isFallbackAvailable(appId),
      fallbackSources: sourcesInfo,
      keyTransformer: this.keyTransformer.getDebugInfo(appId),
      environmentVariables: this.keyTransformer.getAppEnvironmentVariables(appId)
    };
  }
}

/**
 * Singleton instance for global use
 */
export const globalFallbackSystem = new BulletproofFallbackSystem();

/**
 * Factory function for creating app-specific fallback systems
 */
export function createBulletproofFallbackSystem(
  keyTransformer?: AppScopedKeyTransformer,
  clientResolver?: AppAwareClientResolver
): BulletproofFallbackSystem {
  return new BulletproofFallbackSystem(keyTransformer, clientResolver);
}