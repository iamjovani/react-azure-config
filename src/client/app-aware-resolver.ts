/**
 * App-Aware Client-Side Configuration Resolver
 * 
 * Provides intelligent multi-strategy resolution for configuration values
 * on the client side. Works with the enhanced key formats provided by
 * the App-Isolated Azure Manager to ensure React hooks always find values.
 * 
 * @module client/app-aware-resolver
 */

import type { ConfigurationValue } from '../types';

/**
 * Resolution strategy result
 */
export interface ResolutionResult<T = unknown> {
  found: boolean;
  value?: T;
  resolvedKey?: string;
  strategy: string;
  attemptedKeys: string[];
}

/**
 * Resolution strategy function
 */
export type ResolutionStrategy<T = unknown> = (
  requestedKey: string,
  config: ConfigurationValue,
  appId?: string
) => ResolutionResult<T>;

/**
 * App-Aware Client-Side Configuration Resolver
 * 
 * Uses multiple strategies to resolve configuration values, ensuring
 * that React hooks always find values regardless of key format.
 */
export class AppAwareClientResolver {
  private strategies: Array<{ name: string; fn: ResolutionStrategy }> = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default resolution strategies
   */
  private initializeDefaultStrategies(): void {
    this.addStrategy('direct', this.directMatch);
    this.addStrategy('lowercase', this.lowercaseMatch);
    this.addStrategy('nested', this.nestedPropertyMatch);
    this.addStrategy('app-prefix-removal', this.appPrefixRemovalMatch);
    this.addStrategy('underscore-to-dot', this.underscoreToDotMatch);
    this.addStrategy('transformation-variants', this.transformationVariantsMatch);
    this.addStrategy('partial-match', this.partialMatch);
    this.addStrategy('fuzzy-match', this.fuzzyMatch);
  }

  /**
   * Add a custom resolution strategy
   * 
   * @param name Strategy name
   * @param strategyFn Strategy function
   */
  addStrategy(name: string, strategyFn: ResolutionStrategy): void {
    this.strategies.push({ name, fn: strategyFn });
  }

  /**
   * Resolve a configuration value using all available strategies
   * 
   * @param requestedKey The key being requested
   * @param config Configuration object to search in
   * @param appId App identifier (optional)
   * @returns Resolution result with value if found
   */
  resolve<T = unknown>(
    requestedKey: string,
    config: ConfigurationValue,
    appId?: string
  ): ResolutionResult<T> {
    if (!config || Object.keys(config).length === 0) {
      return {
        found: false,
        strategy: 'no-config',
        attemptedKeys: []
      };
    }

    console.debug(`[AppAwareResolver] Resolving "${requestedKey}" in config with ${Object.keys(config).length} keys for app "${appId}"`);

    // Try each strategy until we find a value
    for (const strategy of this.strategies) {
      try {
        const result = strategy.fn(requestedKey, config, appId);
        if (result.found && result.value !== undefined) {
          console.debug(`[AppAwareResolver] Found value using strategy "${strategy.name}": ${requestedKey} → ${result.resolvedKey}`);
          return { ...result, strategy: strategy.name };
        }
      } catch (error) {
        console.debug(`[AppAwareResolver] Strategy "${strategy.name}" failed for key "${requestedKey}":`, error);
      }
    }

    // Log detailed information if no value found
    console.debug(`[AppAwareResolver] No value found for "${requestedKey}". Available keys:`, Object.keys(config).slice(0, 10));

    return {
      found: false,
      strategy: 'none',
      attemptedKeys: this.getAllAttemptedKeys(requestedKey, config, appId)
    };
  }

  /**
   * Strategy 1: Direct key match
   */
  private directMatch: ResolutionStrategy = (requestedKey, config) => {
    const value = config[requestedKey];
    return {
      found: value !== undefined,
      value,
      resolvedKey: requestedKey,
      strategy: 'direct',
      attemptedKeys: [requestedKey]
    };
  };

  /**
   * Strategy 2: Lowercase match
   */
  private lowercaseMatch: ResolutionStrategy = (requestedKey, config) => {
    const lowerKey = requestedKey.toLowerCase();
    const value = config[lowerKey];
    return {
      found: value !== undefined,
      value,
      resolvedKey: lowerKey,
      strategy: 'lowercase',
      attemptedKeys: [lowerKey]
    };
  };

  /**
   * Strategy 3: Nested property access (e.g., 'okta.client.id')
   */
  private nestedPropertyMatch: ResolutionStrategy = (requestedKey, config) => {
    const nestedKey = requestedKey.toLowerCase().replace(/_/g, '.');
    const value = this.getNestedProperty(config, nestedKey);
    return {
      found: value !== undefined,
      value,
      resolvedKey: nestedKey,
      strategy: 'nested',
      attemptedKeys: [nestedKey]
    };
  };

  /**
   * Strategy 4: App prefix removal
   */
  private appPrefixRemovalMatch: ResolutionStrategy = (requestedKey, config, appId) => {
    const attemptedKeys: string[] = [];

    // Try removing REACT_APP prefix
    if (requestedKey.startsWith('REACT_APP_')) {
      const withoutReactApp = requestedKey.substring('REACT_APP_'.length);
      attemptedKeys.push(withoutReactApp);
      
      let value = config[withoutReactApp];
      if (value !== undefined) {
        return { found: true, value, resolvedKey: withoutReactApp, strategy: 'app-prefix-removal', attemptedKeys };
      }

      // Try lowercase version
      const lowerWithoutReactApp = withoutReactApp.toLowerCase();
      attemptedKeys.push(lowerWithoutReactApp);
      value = config[lowerWithoutReactApp];
      if (value !== undefined) {
        return { found: true, value, resolvedKey: lowerWithoutReactApp, strategy: 'app-prefix-removal', attemptedKeys };
      }

      // Try dotted version
      const dottedWithoutReactApp = lowerWithoutReactApp.replace(/_/g, '.');
      attemptedKeys.push(dottedWithoutReactApp);
      value = config[dottedWithoutReactApp];
      if (value !== undefined) {
        return { found: true, value, resolvedKey: dottedWithoutReactApp, strategy: 'app-prefix-removal', attemptedKeys };
      }
    }

    // Try removing app-specific prefix if appId is provided
    if (appId) {
      const appPrefix = `REACT_APP_${appId.toUpperCase().replace(/-/g, '_')}_`;
      if (requestedKey.startsWith(appPrefix)) {
        const withoutAppPrefix = requestedKey.substring(appPrefix.length);
        attemptedKeys.push(withoutAppPrefix);
        
        const value = config[withoutAppPrefix];
        if (value !== undefined) {
          return { found: true, value, resolvedKey: withoutAppPrefix, strategy: 'app-prefix-removal', attemptedKeys };
        }
      }
    }

    return { found: false, strategy: 'app-prefix-removal', attemptedKeys };
  };

  /**
   * Strategy 5: Underscore to dot transformation
   */
  private underscoreToDotMatch: ResolutionStrategy = (requestedKey, config) => {
    const attemptedKeys: string[] = [];
    
    // Try replacing underscores with dots
    const dottedKey = requestedKey.toLowerCase().replace(/_/g, '.');
    attemptedKeys.push(dottedKey);
    
    let value = config[dottedKey];
    if (value !== undefined) {
      return { found: true, value, resolvedKey: dottedKey, strategy: 'underscore-to-dot', attemptedKeys };
    }

    // Try nested property access
    value = this.getNestedProperty(config, dottedKey);
    if (value !== undefined) {
      return { found: true, value, resolvedKey: dottedKey, strategy: 'underscore-to-dot', attemptedKeys };
    }

    return { found: false, strategy: 'underscore-to-dot', attemptedKeys };
  };

  /**
   * Strategy 6: Common transformation variants
   */
  private transformationVariantsMatch: ResolutionStrategy = (requestedKey, config) => {
    const attemptedKeys: string[] = [];
    
    const transformations = [
      requestedKey.toLowerCase(),
      requestedKey.toLowerCase().replace(/_/g, ''),
      requestedKey.toLowerCase().replace(/_/g, '.'),
      requestedKey.replace(/^REACT_APP_[A-Z_]+_/, '').toLowerCase(),
      requestedKey.replace(/^[A-Z_]+_/, '').toLowerCase(),
      requestedKey.replace(/^REACT_APP_/, '').toLowerCase().replace(/_/g, '.'),
      requestedKey.replace(/([A-Z])/g, '.$1').toLowerCase().replace(/^\./, ''), // camelCase to dot notation
    ];

    for (const transformed of transformations) {
      if (transformed && transformed !== requestedKey) {
        attemptedKeys.push(transformed);
        const value = config[transformed];
        if (value !== undefined) {
          return { found: true, value, resolvedKey: transformed, strategy: 'transformation-variants', attemptedKeys };
        }

        // Also try nested access for dotted keys
        if (transformed.includes('.')) {
          const nestedValue = this.getNestedProperty(config, transformed);
          if (nestedValue !== undefined) {
            return { found: true, value: nestedValue, resolvedKey: transformed, strategy: 'transformation-variants', attemptedKeys };
          }
        }
      }
    }

    return { found: false, strategy: 'transformation-variants', attemptedKeys };
  };

  /**
   * Strategy 7: Partial key matching
   */
  private partialMatch: ResolutionStrategy = (requestedKey, config) => {
    const lowerRequestedKey = requestedKey.toLowerCase();
    const configKeys = Object.keys(config);
    
    // Find keys that contain the search term or vice versa
    const matchingKey = configKeys.find(configKey => {
      const lowerConfigKey = configKey.toLowerCase();
      return lowerConfigKey.includes(lowerRequestedKey) || 
             lowerRequestedKey.includes(lowerConfigKey) ||
             this.similarityScore(lowerRequestedKey, lowerConfigKey) > 0.7;
    });

    if (matchingKey) {
      const value = config[matchingKey];
      return {
        found: value !== undefined,
        value,
        resolvedKey: matchingKey,
        strategy: 'partial-match',
        attemptedKeys: [matchingKey]
      };
    }

    return { found: false, strategy: 'partial-match', attemptedKeys: [] };
  };

  /**
   * Strategy 8: Fuzzy matching (last resort)
   */
  private fuzzyMatch: ResolutionStrategy = (requestedKey, config) => {
    const lowerRequestedKey = requestedKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const configKeys = Object.keys(config);
    
    let bestMatch: { key: string; score: number } | null = null;
    
    for (const configKey of configKeys) {
      const lowerConfigKey = configKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      const score = this.similarityScore(lowerRequestedKey, lowerConfigKey);
      
      if (score > 0.8 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { key: configKey, score };
      }
    }

    if (bestMatch) {
      const value = config[bestMatch.key];
      return {
        found: value !== undefined,
        value,
        resolvedKey: bestMatch.key,
        strategy: 'fuzzy-match',
        attemptedKeys: [bestMatch.key]
      };
    }

    return { found: false, strategy: 'fuzzy-match', attemptedKeys: [] };
  };

  /**
   * Get nested property from object using dot notation
   */
  private getNestedProperty(obj: ConfigurationValue, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Calculate similarity score between two strings (0-1)
   */
  private similarityScore(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple Levenshtein distance based similarity
    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get all keys that would be attempted for debugging
   */
  private getAllAttemptedKeys(requestedKey: string, config: ConfigurationValue, appId?: string): string[] {
    const allKeys: string[] = [];
    
    for (const strategy of this.strategies) {
      try {
        const result = strategy.fn(requestedKey, config, appId);
        allKeys.push(...result.attemptedKeys);
      } catch (error) {
        // Ignore strategy errors for debugging
      }
    }
    
    return [...new Set(allKeys)]; // Remove duplicates
  }

  /**
   * Get debug information about resolution attempts
   */
  getDebugInfo<T>(requestedKey: string, config: ConfigurationValue, appId?: string): {
    requestedKey: string;
    configKeys: string[];
    strategies: Array<{
      name: string;
      result: ResolutionResult<T>;
    }>;
  } {
    const strategies = this.strategies.map(strategy => ({
      name: strategy.name,
      result: strategy.fn(requestedKey, config, appId)
    }));

    return {
      requestedKey,
      configKeys: Object.keys(config),
      strategies
    };
  }
}

/**
 * Singleton instance for global use
 */
export const globalClientResolver = new AppAwareClientResolver();

/**
 * Factory function for creating custom resolvers
 */
export function createAppAwareResolver(): AppAwareClientResolver {
  return new AppAwareClientResolver();
}