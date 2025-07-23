/**
 * Client-only React Context Provider
 * 
 * Provides React context for configuration management by fetching from API endpoints.
 * NO server dependencies - works in browser environments only.
 * 
 * @module client/context
 */

// External dependencies
import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';

// Internal modules - client-safe only
import { RuntimeConfigurationClient } from '../runtime-config-client';
import type { ConfigurationValue } from '../types';

interface ConfigContextValue {
  client: RuntimeConfigurationClient | null;
  environment: string;
  config: ConfigurationValue | null;
  loading: boolean;
  error: string | undefined;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

interface ConfigProviderProps {
  children: ReactNode;
  client?: RuntimeConfigurationClient;
  apiUrl?: string;
  fetchOnMount?: boolean;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ 
  children, 
  client: providedClient,
  apiUrl = '/api/config',
  fetchOnMount = true
}) => {
  // Initialize client immediately - works on both server and client
  const [client] = useState<RuntimeConfigurationClient>(() => {
    // SSR-safe environment variable access
    const getEnvironment = (): string => {
      try {
        return process.env.NODE_ENV || 'production';
      } catch {
        return 'production';
      }
    };

    return providedClient || new RuntimeConfigurationClient({
      useEmbeddedService: true,
      configServiceUrl: apiUrl,
      environment: getEnvironment()
    });
  });

  const [config, setConfig] = useState<ConfigurationValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Fetch configuration (only runs on client due to useEffect)
  useEffect(() => {
    if (!fetchOnMount) return;

    setLoading(true);
    client.getConfiguration()
      .then((configData) => {
        setConfig(configData);
        setError(undefined);
      })
      .catch((err) => {
        console.error('Failed to load configuration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [client, fetchOnMount]);

  const value: ConfigContextValue = {
    client,
    environment: client?.getEnvironment() || 'unknown',
    config,
    loading,
    error
  };

  return React.createElement(
    ConfigContext.Provider,
    { value },
    children
  );
};

export const useConfigContext = (): ConfigContextValue => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  return context;
};

// Simplified hook for config provider (no server management)
export const useConfigProvider = () => {
  const { client, config, loading, error, environment } = useConfigContext();

  const refreshConfig = async (): Promise<void> => {
    if (client) {
      try {
        // Refresh the configuration
        await client.refreshConfiguration();
      } catch (err) {
        console.error('Failed to refresh configuration:', err);
        throw err;
      }
    }
  };

  return {
    config,
    loading,
    error,
    environment,
    refreshConfig,
    client
  };
};