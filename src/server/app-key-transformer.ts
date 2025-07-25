/**
 * App-Aware Key Transformation Engine
 * 
 * Solves the critical issue where prefixed environment keys (REACT_APP_ADMIN_NEXTAUTH_SECRET)
 * were being sent directly to Azure instead of clean keys (nextauth.secret).
 * 
 * This bidirectional transformer ensures:
 * 1. Environment → Azure: Strip app prefixes before Azure queries
 * 2. Azure → App: Add proper app context for client resolution
 * 3. Fallback: Map environment variables to proper key formats
 * 
 * @module server/app-key-transformer
 */

import { logger } from '../utils/logger';

/**
 * App context key with multiple formats for maximum compatibility
 */
export interface AppContextKey {
  /** Original key format */
  original: string;
  /** Clean format for app context (no prefixes) */
  clean: string;
  /** Azure format (dotted notation) */
  azure: string;
  /** Legacy prefixed format */
  legacy: string;
  /** Nested object path format */
  nested: string;
}

/**
 * Key transformation configuration per app
 */
export interface AppKeyMappings {
  appId: string;
  /** Common variable mappings for this app */
  mappings: Record<string, {
    azureKey: string;
    fallbackKeys: string[];
    description?: string;
  }>;
}

/**
 * App-Aware Key Transformation Engine
 * 
 * Core component that handles bidirectional key transformation between
 * environment variables, Azure App Configuration, and client applications.
 */
export class AppScopedKeyTransformer {
  private appMappings = new Map<string, AppKeyMappings>();

  constructor() {
    this.initializeDefaultMappings();
  }

  /**
   * Initialize default mappings for common configuration patterns
   */
  private initializeDefaultMappings(): void {
    // Common patterns that work across all apps
    const commonMappings = {
      'NEXTAUTH_SECRET': { azureKey: 'nextauth.secret', fallbackKeys: ['NEXTAUTH_SECRET'] },
      'NEXTAUTH_URL': { azureKey: 'nextauth.url', fallbackKeys: ['NEXTAUTH_URL'] },
      'OKTA_CLIENT_ID': { azureKey: 'okta.client.id', fallbackKeys: ['OKTA_CLIENT_ID'] },
      'OKTA_CLIENT_SECRET': { azureKey: 'okta.client.secret', fallbackKeys: ['OKTA_CLIENT_SECRET'] },
      'OKTA_ISSUER': { azureKey: 'okta.issuer', fallbackKeys: ['OKTA_ISSUER'] },
      'API_URL': { azureKey: 'api.url', fallbackKeys: ['API_URL', 'API_BASE_URL'] },
      'DATABASE_URL': { azureKey: 'database.url', fallbackKeys: ['DATABASE_URL'] },
      'SGJ_INVESTMENT_BASE_URL': { azureKey: 'sgj.investment.base.url', fallbackKeys: ['SGJ_INVESTMENT_BASE_URL'] }
    };

    // Register for common apps
    ['admin', 'client', 'analytics', 'user-portal'].forEach(appId => {
      this.registerAppMappings({
        appId,
        mappings: commonMappings
      });
    });
  }

  /**
   * Register custom key mappings for a specific app
   */
  registerAppMappings(mappings: AppKeyMappings): void {
    this.appMappings.set(mappings.appId, mappings);
    logger.debug(`Registered key mappings for app "${mappings.appId}": ${Object.keys(mappings.mappings).length} mappings`);
  }

  /**
   * Transform environment key to Azure format (CRITICAL FIX)
   * 
   * This is the core fix: strip app prefixes before sending to Azure
   * 
   * @param envKey Environment variable key (e.g., REACT_APP_ADMIN_NEXTAUTH_SECRET)
   * @param appId App identifier (e.g., admin)
   * @returns Clean Azure key (e.g., nextauth.secret)
   */
  envToAzure(envKey: string, appId: string): string {
    try {
      // Step 1: Remove app-specific prefixes
      let cleanKey = this.stripAppPrefixes(envKey, appId);
      
      // Step 2: Check if we have a specific mapping for this key
      const appMappings = this.appMappings.get(appId);
      if (appMappings && appMappings.mappings[cleanKey]) {
        const azureKey = appMappings.mappings[cleanKey].azureKey;
        logger.debug(`Transformed environment key for Azure: ${envKey} → ${azureKey} (via mapping)`);
        return azureKey;
      }
      
      // Step 3: Apply standard transformation rules
      const azureKey = this.standardizeToAzureFormat(cleanKey);
      
      logger.debug(`Transformed environment key for Azure: ${envKey} → ${azureKey} (via rules)`);
      return azureKey;
      
    } catch (error) {
      logger.warn(`Failed to transform environment key to Azure format: ${envKey}`, error);
      return this.standardizeToAzureFormat(envKey);
    }
  }

  /**
   * Transform Azure key back to app context format
   * 
   * @param azureKey Azure key (e.g., nextauth.secret)
   * @param appId App identifier (e.g., admin)
   * @returns App context key with multiple formats
   */
  azureToApp(azureKey: string, appId: string): AppContextKey {
    try {
      const cleanKey = azureKey.replace(/\./g, '_').toUpperCase();
      const appPrefix = `REACT_APP_${appId.toUpperCase().replace(/-/g, '_')}_`;
      
      const contextKey: AppContextKey = {
        original: azureKey,
        clean: cleanKey.toLowerCase().replace(/_/g, '.'),
        azure: azureKey,
        legacy: `${appPrefix}${cleanKey}`,
        nested: azureKey
      };
      
      logger.debug(`Transformed Azure key to app context for "${appId}": ${azureKey} → multiple formats`);
      return contextKey;
      
    } catch (error) {
      logger.warn(`Failed to transform Azure key to app context: ${azureKey}`, error);
      return {
        original: azureKey,
        clean: azureKey,
        azure: azureKey,
        legacy: azureKey,
        nested: azureKey
      };
    }
  }

  /**
   * Resolve fallback keys for a requested key
   * 
   * @param requestedKey The key being requested by the client
   * @param appId App identifier
   * @returns Array of potential fallback keys to try
   */
  resolveFallback(requestedKey: string, appId: string): string[] {
    const fallbackKeys: string[] = [];
    
    try {
      // Add the original requested key
      fallbackKeys.push(requestedKey);
      
      // If it's an app-prefixed key, add the clean version
      const cleanKey = this.stripAppPrefixes(requestedKey, appId);
      if (cleanKey !== requestedKey) {
        fallbackKeys.push(cleanKey);
      }
      
      // Add Azure format
      const azureKey = this.standardizeToAzureFormat(cleanKey);
      fallbackKeys.push(azureKey);
      
      // Add variations based on common patterns
      fallbackKeys.push(cleanKey.toLowerCase());
      fallbackKeys.push(cleanKey.toLowerCase().replace(/_/g, '.'));
      fallbackKeys.push(cleanKey.toLowerCase().replace(/_/g, ''));
      
      // Check app-specific mappings for additional fallback keys
      const appMappings = this.appMappings.get(appId);
      if (appMappings) {
        Object.entries(appMappings.mappings).forEach(([key, mapping]) => {
          if (key === cleanKey || mapping.azureKey === azureKey || mapping.azureKey === requestedKey) {
            fallbackKeys.push(...mapping.fallbackKeys);
          }
        });
      }
      
      // Remove duplicates and return
      const uniqueKeys = [...new Set(fallbackKeys)];
      logger.debug(`Resolved ${uniqueKeys.length} fallback keys for "${requestedKey}" in app "${appId}"`);
      return uniqueKeys;
      
    } catch (error) {
      logger.warn(`Failed to resolve fallback keys for: ${requestedKey}`, error);
      return [requestedKey];
    }
  }

  /**
   * Get all environment variables for a specific app
   * 
   * @param appId App identifier
   * @returns Array of environment variable keys for this app
   */
  getAppEnvironmentVariables(appId: string): string[] {
    const appPrefix = `REACT_APP_${appId.toUpperCase().replace(/-/g, '_')}_`;
    const appVars = Object.keys(process.env).filter(key => key.startsWith(appPrefix));
    
    logger.debug(`Found ${appVars.length} environment variables for app "${appId}"`);
    return appVars;
  }

  /**
   * Create a comprehensive key mapping for an environment variable
   * 
   * @param envKey Environment variable key
   * @param appId App identifier
   * @returns Object with all possible key formats
   */
  createKeyMapping(envKey: string, appId: string): Record<string, string> {
    const value = process.env[envKey];
    if (!value) return {};
    
    const cleanKey = this.stripAppPrefixes(envKey, appId);
    const azureKey = this.standardizeToAzureFormat(cleanKey);
    const appContext = this.azureToApp(azureKey, appId);
    
    return {
      [envKey]: value, // Original format
      [cleanKey]: value, // Clean format  
      [azureKey]: value, // Azure format
      [appContext.clean]: value, // App clean format
      [appContext.nested]: value, // Nested format
      [cleanKey.toLowerCase()]: value, // Lowercase
      [cleanKey.toLowerCase().replace(/_/g, '')]: value // No underscores
    };
  }

  /**
   * Strip app-specific prefixes from environment variable keys
   * 
   * @param envKey Environment variable key
   * @param appId App identifier
   * @returns Key without app-specific prefixes
   */
  private stripAppPrefixes(envKey: string, appId: string): string {
    const appIdUpper = appId.toUpperCase().replace(/-/g, '_');
    
    // Prefixes to try in order (most specific first)
    const prefixes = [
      `REACT_APP_${appIdUpper}_`,
      `${appIdUpper}_`,
      'REACT_APP_'
    ];
    
    for (const prefix of prefixes) {
      if (envKey.startsWith(prefix)) {
        return envKey.substring(prefix.length);
      }
    }
    
    return envKey;
  }

  /**
   * Standardize key to Azure format (dotted notation)
   * 
   * @param key Input key
   * @returns Azure-compatible key
   */
  private standardizeToAzureFormat(key: string): string {
    return key
      .toLowerCase()
      .replace(/_+/g, '.') // Replace underscores with dots
      .replace(/\.+/g, '.') // Collapse multiple dots
      .replace(/^\.+|\.+$/g, ''); // Remove leading/trailing dots
  }

  /**
   * Get debug information about key transformations for an app
   * 
   * @param appId App identifier
   * @returns Debug information object
   */
  getDebugInfo(appId: string): any {
    const appVars = this.getAppEnvironmentVariables(appId);
    const appMappings = this.appMappings.get(appId);
    
    const transformations = appVars.map(envKey => ({
      environment: envKey,
      clean: this.stripAppPrefixes(envKey, appId),
      azure: this.envToAzure(envKey, appId),
      fallbacks: this.resolveFallback(envKey, appId)
    }));
    
    return {
      appId,
      environmentVariables: appVars.length,
      registeredMappings: appMappings ? Object.keys(appMappings.mappings).length : 0,
      transformations
    };
  }
}

/**
 * Singleton instance for global use
 */
export const globalKeyTransformer = new AppScopedKeyTransformer();

/**
 * Factory function for creating app-specific transformers
 */
export function createAppKeyTransformer(customMappings?: AppKeyMappings[]): AppScopedKeyTransformer {
  const transformer = new AppScopedKeyTransformer();
  
  if (customMappings) {
    customMappings.forEach(mapping => {
      transformer.registerAppMappings(mapping);
    });
  }
  
  return transformer;
}