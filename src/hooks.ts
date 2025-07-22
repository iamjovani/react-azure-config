/**
 * React Hooks
 * 
 * Custom React hooks for configuration management, including useConfig for full configuration,
 * useConfigValue for specific values, useFeature for feature flags, and useEnv for environment variables.
 * 
 * @module hooks
 */

// External dependencies
import { useState, useEffect, useCallback } from 'react';

// Internal modules
import { useConfigContext } from './context';
import { logger } from './utils/logger';
import { transformEnvKeyToConfigPath } from './utils/config-utils';
import { DEFAULT_CONSTANTS } from './constants';
import type { ConfigurationValue, ConfigResult } from './types';

export const useConfig = <T = ConfigurationValue>(): ConfigResult<T> => {
  const { client } = useConfigContext();
  const [state, setState] = useState<ConfigResult<T>>({
    data: null,
    loading: true,
    error: null,
    source: null,
    lastUpdated: null
  });

  const loadConfig = useCallback(async () => {
    if (!client) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const config = await client.getConfiguration();
      
      setState({
        data: config as T,
        loading: false,
        error: null,
        source: client.isUsingEmbeddedService() ? 'api' : 'azure',
        lastUpdated: Date.now()
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: null,
        lastUpdated: null
      });
    }
  }, [client]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const refresh = useCallback(async () => {
    if (client) {
      await client.refreshConfiguration();
      await loadConfig();
    }
  }, [client, loadConfig]);

  return {
    ...state,
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
        logger.error(`Failed to load config value for key "${key}":`, error);
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
  const configKey = key.startsWith(DEFAULT_CONSTANTS.ENV_VAR_PREFIX) 
    ? transformEnvKeyToConfigPath(key)
    : key;

  return useConfigValue<T>(configKey, defaultValue);
};

// Re-export useConfigContext from context for convenience
export { useConfigContext } from './context';

// Add useConfigProvider hook
export const useConfigProvider = () => {
  const { server, isServerRunning, serverError, environment } = useConfigContext();
  
  return {
    server,
    isServerRunning,
    serverError,
    environment,
    restartServer: async () => {
      if (server) {
        await server.stop();
        await server.start();
      }
    },
    stopServer: async () => {
      if (server) {
        await server.stop();
      }
    },
    getServerHealth: async () => {
      if (!server || !isServerRunning) {
        return { status: 'not-running' };
      }
      
      try {
        const response = await fetch(`http://localhost:${server.getPort()}/health`);
        return await response.json();
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };
};