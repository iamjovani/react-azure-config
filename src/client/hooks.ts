/**
 * Client-only React Hooks
 * 
 * Custom React hooks for configuration management in browser environments.
 * NO server dependencies - works with API endpoints only.
 * 
 * @module client/hooks
 */

// External dependencies
import { useState, useEffect, useCallback } from 'react';

// Internal modules - client-safe only
import { useConfigContext } from './context';
import { getNestedProperty } from '../utils/config-utils';
import type { ConfigurationValue, ConfigResult } from '../types';

// Re-export useConfigContext and useConfigProvider from context for convenience
export { useConfigContext, useConfigProvider } from './context';

export const useConfig = <T = ConfigurationValue>(): ConfigResult<T> => {
  const { client, config, loading, error } = useConfigContext();
  
  const refresh = useCallback(async () => {
    if (client) {
      await client.refreshConfiguration();
    }
  }, [client]);

  return {
    data: config as T,
    loading,
    error: error || null,
    source: client?.isUsingEmbeddedService() ? 'api' : 'azure',
    lastUpdated: config ? Date.now() : null,
    refresh
  } as ConfigResult<T> & { refresh: () => Promise<void> };
};

export const useConfigValue = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  const { config, loading, appId } = useConfigContext();
  
  // If still loading, return defaultValue
  if (loading) {
    return defaultValue;
  }
  
  // If we have config data, extract the value with enhanced resolution
  if (config) {
    console.debug(`[react-azure-config] Looking for key "${key}" in config with ${Object.keys(config).length} total keys`);
    
    // Try multiple resolution strategies
    const strategies = [
      // Strategy 1: Direct key access
      () => config[key] as T,
      
      // Strategy 2: Nested property access (okta.client.id)
      () => {
        const nestedKey = key.toLowerCase().replace(/_/g, '.');
        return getNestedProperty<T>(config, nestedKey);
      },
      
      // Strategy 3: Remove REACT_APP prefix and try nested
      () => {
        const cleanKey = key.replace(/^REACT_APP_/, '').toLowerCase().replace(/_/g, '.');
        return getNestedProperty<T>(config, cleanKey);
      },
      
      // Strategy 4: Remove app-specific prefix and try nested
      () => {
        if (appId) {
          const appPrefix = `${appId.toUpperCase().replace(/-/g, '_')}_`;
          if (key.startsWith(appPrefix)) {
            const cleanKey = key.substring(appPrefix.length).toLowerCase().replace(/_/g, '.');
            return getNestedProperty<T>(config, cleanKey);
          }
        }
        return undefined;
      },
      
      // Strategy 5: Try common key transformations
      () => {
        const transformations = [
          key.toLowerCase(),
          key.toLowerCase().replace(/_/g, ''),
          key.toLowerCase().replace(/_/g, '.'),
          key.replace(/^REACT_APP_[A-Z_]+_/, '').toLowerCase(),
          key.replace(/^[A-Z_]+_/, '').toLowerCase()
        ];
        
        for (const transformed of transformations) {
          const value = config[transformed] as T;
          if (value !== undefined) {
            return value;
          }
          // Also try nested access
          const nested = getNestedProperty<T>(config, transformed);
          if (nested !== undefined) {
            return nested;
          }
        }
        return undefined;
      },
      
      // Strategy 6: Partial key matching (last resort)
      () => {
        const lowerKey = key.toLowerCase();
        const configKeys = Object.keys(config);
        
        // Find keys that contain the search term
        const matchingKey = configKeys.find(configKey => {
          const lowerConfigKey = configKey.toLowerCase();
          return lowerConfigKey.includes(lowerKey) || lowerKey.includes(lowerConfigKey);
        });
        
        if (matchingKey) {
          console.debug(`[react-azure-config] Found partial match: "${key}" -> "${matchingKey}"`);
          return config[matchingKey] as T;
        }
        return undefined;
      }
    ];
    
    // Try each strategy until we find a value
    for (let i = 0; i < strategies.length; i++) {
      try {
        const value = strategies[i]();
        if (value !== undefined) {
          if (i > 0) {
            console.debug(`[react-azure-config] Found value for "${key}" using strategy ${i + 1}`);
          }
          return value;
        }
      } catch (error) {
        console.debug(`[react-azure-config] Strategy ${i + 1} failed for key "${key}":`, error);
      }
    }
    
    console.debug(`[react-azure-config] No value found for "${key}" in config. Available keys:`, Object.keys(config));
  }
  
  // Return default if no config available or no value found
  return defaultValue;
};


export const useFeature = (featureName: string): boolean => {
  const featureValue = useConfigValue<boolean>(`features.${featureName}`, false);
  return featureValue || false;
};

export const useEnv = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  // Simple transformation for environment variables
  const configKey = key.startsWith('REACT_APP_') 
    ? key.replace('REACT_APP_', '').toLowerCase().replace(/_/g, '.')
    : key;

  return useConfigValue<T>(configKey, defaultValue);
};