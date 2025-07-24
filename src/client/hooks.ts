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
  const { config, loading } = useConfigContext();
  
  // If still loading, return defaultValue
  if (loading) {
    return defaultValue;
  }
  
  // If we have config data, extract the value
  if (config) {
    // Try direct key access first
    let value = config[key] as T;
    
    // If not found, try nested property access (e.g., 'okta.client.id')
    if (value === undefined) {
      const nestedKey = key.toLowerCase().replace(/_/g, '.');
      value = getNestedProperty<T>(config, nestedKey);
    }
    
    // If still not found, try with app-specific prefix removal
    if (value === undefined) {
      const cleanKey = key.replace(/^REACT_APP_/, '').toLowerCase().replace(/_/g, '.');
      value = getNestedProperty<T>(config, cleanKey);
    }
    
    return value !== undefined ? value : defaultValue;
  }
  
  // Return default if no config available
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