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
import type { AppInsightsConfig } from './insights/types';
import { useIsClient, getEnvVar } from './ClientOnly';

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
  /** Application Insights configuration (optional) */
  applicationInsights?: AppInsightsConfig;
  /** Enable automatic Application Insights initialization when connection string is detected */
  enableAutoInsights?: boolean;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ 
  children, 
  client: providedClient,
  apiUrl = '/api/config',
  fetchOnMount = true,
  applicationInsights,
  enableAutoInsights = true
}) => {
  const [client, setClient] = useState<RuntimeConfigurationClient | null>(null);
  const [config, setConfig] = useState<ConfigurationValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  
  // Use SSR-safe client detection
  const isClient = useIsClient();
  
  // State for Application Insights provider - only load on client
  const [AppInsightsProvider, setAppInsightsProvider] = useState<React.ComponentType<any> | null>(null);

  // Load Application Insights provider dynamically - only on client side
  useEffect(() => {
    if (!enableAutoInsights || !isClient) {
      return;
    }

    const loadAppInsightsProvider = async () => {
      try {
        // Use dynamic import to load the provider
        const module = await import('./insights/provider');
        setAppInsightsProvider(() => module.AppInsightsProvider);
      } catch (err) {
        // Provider not available - this is fine, just continue without it
        console.debug('Application Insights provider not available:', err);
        setAppInsightsProvider(null);
      }
    };

    loadAppInsightsProvider();
  }, [enableAutoInsights, isClient]);

  useEffect(() => {
    // Use SSR-safe environment variable access
    const environment = getEnvVar('NODE_ENV', 'production');
    
    // Use provided client or create a simple runtime client
    const configClient = providedClient || new RuntimeConfigurationClient({
      useEmbeddedService: true,
      configServiceUrl: apiUrl,
      environment
    });
    
    setClient(configClient);

    // Only fetch on client side to prevent hydration mismatches
    if (fetchOnMount && isClient) {
      setLoading(true);
      configClient.getConfiguration()
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
    }
  }, [providedClient, apiUrl, fetchOnMount, isClient]);

  const value: ConfigContextValue = {
    client,
    environment: client?.getEnvironment() || 'unknown',
    config,
    loading,
    error
  };

  // Auto-wrap with Application Insights provider when enabled
  const renderChildren = () => {
    if (!enableAutoInsights || !AppInsightsProvider) {
      return children;
    }

    // Use dynamically loaded AppInsightsProvider component
    return React.createElement(
      AppInsightsProvider,
      { 
        config: applicationInsights,
        children 
      }
    );
  };

  return React.createElement(
    ConfigContext.Provider,
    { value },
    renderChildren()
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