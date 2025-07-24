/**
 * Client-only React Context Provider
 * 
 * Provides React context for configuration management by fetching from API endpoints.
 * NO server dependencies - works in browser environments only.
 * 
 * @module client/context
 */

// External dependencies
import { createContext, useContext, ReactNode, useEffect, useState, createElement } from 'react';

// Internal modules - client-safe only
import { RuntimeConfigurationClient } from '../runtime-config-client';
import type { ConfigurationValue } from '../types';

interface ConfigContextValue {
  client: RuntimeConfigurationClient | null;
  environment: string;
  appId: string | undefined;
  config: ConfigurationValue | null;
  loading: boolean;
  error: string | undefined;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

interface ConfigProviderProps {
  children: ReactNode;
  client?: RuntimeConfigurationClient;
  apiUrl?: string;
  appId?: string;
  fetchOnMount?: boolean;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ 
  children, 
  client: providedClient,
  apiUrl,
  appId,
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

    // Construct API URL based on appId
    const constructApiUrl = (): string => {
      if (apiUrl) {
        return apiUrl; // Use provided apiUrl as-is
      }
      
      if (appId) {
        return `/api/config/${appId}`; // App-specific endpoint
      }
      
      return '/api/config'; // Default endpoint (backward compatibility)
    };

    return providedClient || new RuntimeConfigurationClient({
      useEmbeddedService: true,
      configServiceUrl: constructApiUrl(),
      environment: getEnvironment(),
      appId // Pass appId to the client
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
    appId,
    config,
    loading,
    error
  };

  return createElement(
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
  const { client, config, loading, error, environment, appId } = useConfigContext();

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
    appId,
    refreshConfig,
    client
  };
};