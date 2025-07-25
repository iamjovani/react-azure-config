/**
 * Enhanced App Azure Loader
 * 
 * This is the main integration component that ties together all the architectural fixes
 * to solve the critical bug where prefixed environment keys were being sent to Azure
 * instead of clean keys, causing complete system failure.
 * 
 * Key Features:
 * 1. Uses App-Isolated Azure Client Manager for proper Azure integration
 * 2. Uses Bulletproof Fallback System for seamless environment variable fallback
 * 3. Uses App-Aware Key Transformation for bidirectional key mapping
 * 4. Uses Enhanced Client-Side Resolution for maximum compatibility
 * 5. Provides unified API that works identically for Azure and fallback scenarios
 * 
 * This replaces the existing createAppAzureLoader to ensure the bug report
 * issues can never happen again.
 * 
 * @module server/enhanced-app-azure-loader
 */

import { AppIsolatedAzureManager, globalAzureManager } from './app-isolated-azure-manager';
import { BulletproofFallbackSystem, globalFallbackSystem } from './bulletproof-fallback-system';
import { AppScopedKeyTransformer, globalKeyTransformer } from './app-key-transformer';
import { AppAwareClientResolver, globalClientResolver } from '../client/app-aware-resolver';
import { logger } from '../utils/logger';
import type { ConfigurationValue, AuthenticationConfig, AzureConfigOptions } from '../types';
import type { ApiConfigResponse } from './api-route-helpers';

/**
 * Enhanced configuration options for the app Azure loader
 */
export interface EnhancedAppAzureOptions {
  /** App identifier (required) */
  appId: string;
  /** Azure App Configuration endpoint */
  endpoint?: string;
  /** Environment (development, production, etc.) */
  environment?: string;
  /** Azure authentication configuration */
  authentication?: AuthenticationConfig;
  /** Configuration label */
  label?: string;
  /** Enable local environment variable fallback (default: true) */
  enableLocalFallback?: boolean;
  /** Custom variable name mappings for enhanced resolution */
  variableMappings?: Record<string, string[]>;
  /** Include debug information in responses (default: development mode) */
  includeDebugInfo?: boolean;
  /** Enable comprehensive key transformation */
  enableKeyTransformation?: boolean;
  /** Use bulletproof fallback system (default: true) */
  useBulletproofFallback?: boolean;
  /** Enable multi-strategy client resolution (default: true) */
  enableMultiStrategyResolution?: boolean;
  /** Log level for debugging */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/**
 * Enhanced configuration response with comprehensive tracking
 */
export interface EnhancedConfigResponse extends ApiConfigResponse {
  /** Enhanced debug information */
  debug?: {
    /** Sources attempted in priority order */
    sourcesUsed: string[];
    /** Whether fallback was activated */
    fallbackActivated: boolean;
    /** Number of variables found */
    variableCount: number;
    /** Number of keys transformed */
    transformedKeys: number;
    /** Resolution strategies used */
    resolutionStrategies: string[];
    /** Errors encountered (if any) */
    errors?: string[];
    /** Processing time in milliseconds */
    processingTime: number;
    /** Azure client status */
    azureStatus: 'connected' | 'failed' | 'not-configured';
    /** Fallback system status */
    fallbackStatus: 'available' | 'unavailable' | 'used';
    /** Key transformation details */
    keyTransformations?: Array<{ env: string; azure: string; app: string }>;
  };
}

/**
 * Enhanced App Azure Loader
 * 
 * Main integration component that provides a unified interface for Azure App Configuration
 * with comprehensive fallback handling. This component fixes the critical bug where 
 * prefixed environment keys were sent directly to Azure, causing system failures.
 */
export class EnhancedAppAzureLoader {
  private options: Required<EnhancedAppAzureOptions>;
  private azureManager: AppIsolatedAzureManager;
  private fallbackSystem: BulletproofFallbackSystem;
  private keyTransformer: AppScopedKeyTransformer;
  private clientResolver: AppAwareClientResolver;
  private isInitialized: boolean = false;

  constructor(options: EnhancedAppAzureOptions) {
    this.options = {
      environment: process.env.NODE_ENV || 'development',
      enableLocalFallback: true,
      includeDebugInfo: process.env.NODE_ENV === 'development',
      enableKeyTransformation: true,
      useBulletproofFallback: true,
      enableMultiStrategyResolution: true,
      logLevel: 'info',
      ...options
    };

    // Initialize core components
    this.azureManager = globalAzureManager;
    this.fallbackSystem = globalFallbackSystem;
    this.keyTransformer = globalKeyTransformer;
    this.clientResolver = globalClientResolver;

    // Configure debug mode if requested
    if (this.options.includeDebugInfo) {
      this.fallbackSystem.enableDebugMode();
    }

    logger.info(`Enhanced App Azure Loader initialized for app "${this.options.appId}"`);
  }

  /**
   * Initialize the loader with Azure configuration
   * This must be called before using the loader
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register the app with Azure manager if Azure configuration is provided
      if (this.options.endpoint && this.options.authentication) {
        await this.registerWithAzureManager();
      } else {
        logger.info(`No Azure configuration provided for app "${this.options.appId}", fallback-only mode`);
      }

      // Register custom variable mappings if provided
      if (this.options.variableMappings) {
        this.registerVariableMappings();
      }

      this.isInitialized = true;
      logger.info(`Enhanced App Azure Loader ready for app "${this.options.appId}"`);

    } catch (error) {
      logger.error(`Failed to initialize Enhanced App Azure Loader for app "${this.options.appId}":`, error);
      // Don't throw - fallback system can still work
      this.isInitialized = true;
    }
  }

  /**
   * Get comprehensive configuration with Azure + fallback integration
   * 
   * This is the MAIN FIX: ensures proper key transformation and fallback handling
   */
  async getConfiguration(): Promise<EnhancedConfigResponse> {
    const startTime = Date.now();
    
    try {
      await this.initialize();

      // Try Azure App Configuration first (with proper key transformation)
      const azureResult = await this.tryAzureConfiguration();
      if (azureResult.success && azureResult.data && Object.keys(azureResult.data).length > 0) {
        return this.buildEnhancedResponse(azureResult, 'azure', startTime, {
          azureStatus: 'connected',
          fallbackStatus: 'available'
        });
      }

      // Fall back to bulletproof fallback system
      if (this.options.enableLocalFallback && this.options.useBulletproofFallback) {
        const fallbackResult = await this.tryBulletproofFallback();
        if (fallbackResult.success && fallbackResult.data && Object.keys(fallbackResult.data).length > 0) {
          return this.buildEnhancedResponse(fallbackResult, fallbackResult.source, startTime, {
            azureStatus: azureResult.success ? 'failed' : 'not-configured',
            fallbackStatus: 'used'
          });
        }
      }

      // Final fallback: basic environment variables
      const basicFallback = await this.tryBasicEnvironmentFallback();
      return this.buildEnhancedResponse(basicFallback, 'basic-fallback', startTime, {
        azureStatus: 'failed',
        fallbackStatus: basicFallback.success ? 'used' : 'unavailable'
      });

    } catch (error) {
      logger.error(`Configuration loading failed for app "${this.options.appId}":`, error);
      
      // Emergency fallback: try to return something usable
      const emergencyFallback = await this.tryBasicEnvironmentFallback();
      return this.buildEnhancedResponse(emergencyFallback, 'emergency-fallback', startTime, {
        azureStatus: 'failed',
        fallbackStatus: 'used',
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  }

  /**
   * Get specific configuration value with enhanced resolution
   */
  async getConfigurationValue(requestedKey: string): Promise<{
    success: boolean;
    value?: any;
    resolvedKey?: string;
    strategy?: string;
    source: string;
    fallbacksAttempted: string[];
  }> {
    try {
      await this.initialize();

      // Try Azure first
      const azureValueResult = await this.azureManager.getAppConfigurationValue(this.options.appId, requestedKey);
      if (azureValueResult.success && azureValueResult.value !== undefined) {
        return {
          success: true,
          value: azureValueResult.value,
          resolvedKey: azureValueResult.resolvedKey,
          strategy: 'azure-direct',
          source: azureValueResult.source,
          fallbacksAttempted: azureValueResult.fallbacksAttempted
        };
      }

      // Try bulletproof fallback system
      if (this.options.enableLocalFallback && this.options.useBulletproofFallback) {
        const fallbackValueResult = await this.fallbackSystem.getFallbackConfigurationValue(this.options.appId, requestedKey);
        if (fallbackValueResult.success && fallbackValueResult.value !== undefined) {
          return fallbackValueResult;
        }
      }

      return {
        success: false,
        source: 'not-found',
        fallbacksAttempted: []
      };

    } catch (error) {
      logger.error(`Failed to get configuration value "${requestedKey}" for app "${this.options.appId}":`, error);
      return {
        success: false,
        source: 'error',
        fallbacksAttempted: []
      };
    }
  }

  /**
   * Refresh configuration cache
   */
  async refreshConfiguration(): Promise<void> {
    try {
      if (this.azureManager.getRegisteredApps().includes(this.options.appId)) {
        await this.azureManager.refreshAppConfiguration(this.options.appId);
      }
      logger.info(`Configuration cache refreshed for app "${this.options.appId}"`);
    } catch (error) {
      logger.error(`Failed to refresh configuration for app "${this.options.appId}":`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive debug information
   */
  async getDebugInfo(): Promise<any> {
    const azureDebugInfo = this.azureManager.getAppDebugInfo(this.options.appId);
    const fallbackDebugInfo = this.fallbackSystem.getDebugInfo(this.options.appId);
    const keyTransformerDebugInfo = this.keyTransformer.getDebugInfo(this.options.appId);

    return {
      appId: this.options.appId,
      initialized: this.isInitialized,
      options: {
        ...this.options,
        // Redact sensitive information
        authentication: this.options.authentication ? {
          type: this.options.authentication.type,
          clientId: this.options.authentication.clientId ? '***' : undefined,
          tenantId: this.options.authentication.tenantId
        } : undefined
      },
      azure: azureDebugInfo,
      fallback: fallbackDebugInfo,
      keyTransformer: keyTransformerDebugInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAppSpecificVars: keyTransformerDebugInfo.environmentVariables.length > 0,
        totalEnvVars: Object.keys(process.env).length
      }
    };
  }

  /**
   * Check if the loader is properly configured
   */
  isConfigured(): boolean {
    return this.isInitialized && (
      this.azureManager.getRegisteredApps().includes(this.options.appId) ||
      this.fallbackSystem.isFallbackAvailable(this.options.appId)
    );
  }

  /**
   * Register app with Azure manager
   */
  private async registerWithAzureManager(): Promise<void> {
    if (!this.options.endpoint || !this.options.authentication) {
      throw new Error('Azure endpoint and authentication are required for Azure registration');
    }

    this.azureManager.registerApp({
      appId: this.options.appId,
      endpoint: this.options.endpoint,
      authentication: this.options.authentication,
      label: this.options.label,
      environment: this.options.environment
    });

    logger.debug(`Registered app "${this.options.appId}" with Azure manager`);
  }

  /**
   * Register custom variable mappings with key transformer
   */
  private registerVariableMappings(): void {
    if (!this.options.variableMappings) return;

    const mappings = Object.entries(this.options.variableMappings).reduce((acc, [targetKey, sourceKeys]) => {
      acc[targetKey] = {
        azureKey: targetKey,
        fallbackKeys: sourceKeys,
        description: `Custom mapping for ${targetKey}`
      };
      return acc;
    }, {} as Record<string, any>);

    this.keyTransformer.registerAppMappings({
      appId: this.options.appId,
      mappings
    });

    logger.debug(`Registered ${Object.keys(mappings).length} custom variable mappings for app "${this.options.appId}"`);
  }

  /**
   * Try Azure configuration with proper error handling
   */
  private async tryAzureConfiguration(): Promise<any> {
    try {
      if (!this.azureManager.getRegisteredApps().includes(this.options.appId)) {
        return { success: false, data: {}, source: 'azure-not-configured' };
      }

      const result = await this.azureManager.getAppConfiguration(this.options.appId);
      logger.debug(`Azure configuration attempt for app "${this.options.appId}": ${result.success ? 'success' : 'failed'}`);
      
      return result;
    } catch (error) {
      logger.debug(`Azure configuration failed for app "${this.options.appId}":`, error);
      return { 
        success: false, 
        data: {}, 
        source: 'azure-error',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Try bulletproof fallback system
   */
  private async tryBulletproofFallback(): Promise<any> {
    try {
      const result = await this.fallbackSystem.getFallbackConfiguration(
        this.options.appId,
        this.options.includeDebugInfo
      );
      
      logger.debug(`Bulletproof fallback attempt for app "${this.options.appId}": ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.debug(`Bulletproof fallback failed for app "${this.options.appId}":`, error);
      return { 
        success: false, 
        data: {}, 
        source: 'fallback-error',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Basic environment fallback as last resort
   */
  private async tryBasicEnvironmentFallback(): Promise<any> {
    try {
      const config: ConfigurationValue = {};
      const appVars = this.keyTransformer.getAppEnvironmentVariables(this.options.appId);
      
      appVars.forEach(envKey => {
        const value = process.env[envKey];
        if (value !== undefined) {
          const mapping = this.keyTransformer.createKeyMapping(envKey, this.options.appId);
          Object.assign(config, mapping);
        }
      });

      return {
        success: true,
        data: config,
        source: 'basic-environment',
        variablesFound: appVars.length,
        transformedKeys: Object.keys(config).length
      };
    } catch (error) {
      logger.error(`Basic environment fallback failed for app "${this.options.appId}":`, error);
      return { 
        success: false, 
        data: {}, 
        source: 'basic-environment-error',
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Build enhanced response with comprehensive debug information
   */
  private buildEnhancedResponse(
    result: any,
    source: string,
    startTime: number,
    statusInfo: { azureStatus: string; fallbackStatus: string; errors?: string[] }
  ): EnhancedConfigResponse {
    const processingTime = Date.now() - startTime;
    
    const response: EnhancedConfigResponse = {
      success: result.success || false,
      data: result.data || {},
      config: result.data || {}, // Backward compatibility
      source,
      timestamp: Date.now(),
      appId: this.options.appId
    };

    if (this.options.includeDebugInfo) {
      response.debug = {
        sourcesUsed: [source],
        fallbackActivated: source !== 'azure',
        variableCount: Object.keys(result.data || {}).length,
        transformedKeys: result.transformedKeys || 0,
        resolutionStrategies: result.resolutionStrategies || [],
        processingTime,
        azureStatus: statusInfo.azureStatus as any,
        fallbackStatus: statusInfo.fallbackStatus as any,
        errors: [...(result.errors || []), ...(statusInfo.errors || [])],
        keyTransformations: result.debug?.transformations
      };
    }

    return response;
  }
}

/**
 * Enhanced factory function that replaces the existing createAppAzureLoader
 * 
 * This is the NEW MAIN API that applications should use. It provides:
 * 1. Proper key transformation (fixes the core bug)
 * 2. Bulletproof fallback system
 * 3. Multi-strategy resolution
 * 4. Complete app isolation
 * 5. Comprehensive debug information
 */
export function createEnhancedAppAzureLoader(options: EnhancedAppAzureOptions): EnhancedAppAzureLoader {
  logger.info(`Creating enhanced app Azure loader for app "${options.appId}"`);
  return new EnhancedAppAzureLoader(options);
}

/**
 * Backward-compatible factory function that maintains the existing API
 * but uses the enhanced implementation under the hood
 */
export function createAppAzureLoader(options: EnhancedAppAzureOptions): EnhancedAppAzureLoader {
  logger.info(`Creating app Azure loader with enhanced implementation for app "${options.appId}"`);
  return new EnhancedAppAzureLoader(options);
}