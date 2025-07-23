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

  // Use the config from context if available, otherwise maintain local state
  const [localState, setLocalState] = useState<ConfigResult<T>>({
    data: null,
    loading: true,
    error: null,
    source: null,
    lastUpdated: null,
    refresh: async () => {} // Will be overridden by actual refresh function
  });

  // Update local state when context changes
  useEffect(() => {
    setLocalState({
      data: config as T,
      loading,
      error: error || null,
      source: client?.isUsingEmbeddedService() ? 'api' : 'azure',
      lastUpdated: config ? Date.now() : null,
      refresh: async () => {} // Will be overridden by actual refresh function
    });
  }, [config, loading, error, client]);

  return {
    ...localState,
    refresh
  } as ConfigResult<T> & { refresh: () => Promise<void> };
};

export const useConfigValue = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  const { client } = useConfigContext();
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    const loadValue = async () => {
      try {
        setLoading(true);
        const configValue = await client.getValue<T>(key);
        setValue(configValue ?? defaultValue);
      } catch (error) {
        console.error(`Failed to load config value for key "${key}":`, error);
        setValue(defaultValue);
      } finally {
        setLoading(false);
      }
    };

    loadValue();
  }, [client, key, defaultValue]);

  return loading ? defaultValue : value;
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