/**
 * React Context Provider
 * 
 * Provides React context for configuration management with automatic server startup,
 * client initialization, and configuration state management.
 * 
 * @module context
 */

// External dependencies
import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';

// Internal modules
import { RuntimeConfigurationClient } from './runtime-config-client';
import { ConfigurationServer } from './config-server';
import { DEFAULT_CONSTANTS } from './constants';
import type { AzureConfigOptions } from './types';

interface ConfigContextValue {
  client: RuntimeConfigurationClient | null;
  environment: string;
  server: ConfigurationServer | undefined;
  isServerRunning: boolean;
  serverError: string | undefined;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

interface ConfigProviderProps {
  children: ReactNode;
  client?: RuntimeConfigurationClient;
  options?: AzureConfigOptions;
  autoStartServer?: boolean;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ 
  children, 
  client: providedClient,
  options,
  autoStartServer = true
}) => {
  const [client, setClient] = useState<RuntimeConfigurationClient | null>(null);
  const [server, setServer] = useState<ConfigurationServer | undefined>();
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  useEffect(() => {
    let configClient: RuntimeConfigurationClient;
    let configServer: ConfigurationServer | undefined;

    if (providedClient) {
      configClient = providedClient;
    } else if (options) {
      configClient = new RuntimeConfigurationClient(options);
    } else {
      throw new Error('ConfigProvider requires either a client or options');
    }

    setClient(configClient);

    if (autoStartServer && (!options || options.useEmbeddedService !== false)) {
      const serverOptions = {
        ...options,
        port: options?.port || DEFAULT_CONSTANTS.CONFIG_SERVER_PORT,
        environment: options?.environment || DEFAULT_CONSTANTS.DEFAULT_ENVIRONMENT
      };

      try {
        configServer = new ConfigurationServer(serverOptions);
        setServer(configServer);

        configServer.start().then(() => {
          setIsServerRunning(true);
          setServerError(undefined);
          console.log(`Configuration server started on port ${configServer!.getPort()}`);
        }).catch((error) => {
          console.error('Failed to start configuration server:', error);
          setServerError(error.message);
          setIsServerRunning(false);
        });
      } catch (error) {
        console.error('Failed to create configuration server:', error);
        setServerError(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return () => {
      if (configServer && typeof configServer.stop === 'function') {
        const stopPromise = configServer.stop();
        if (stopPromise && typeof stopPromise.catch === 'function') {
          stopPromise.catch(console.error);
        }
      }
    };
  }, [providedClient, options, autoStartServer]);

  const value: ConfigContextValue = {
    client,
    environment: client?.getEnvironment() || 'unknown',
    server,
    isServerRunning,
    serverError
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


// Hook for config provider info and control
export const useConfigProvider = () => {
  const { server, isServerRunning, serverError, environment } = useConfigContext();

  const restartServer = async (): Promise<void> => {
    if (server) {
      await server.stop();
      await server.start();
    }
  };

  const stopServer = async (): Promise<void> => {
    if (server) {
      await server.stop();
    }
  };

  const getServerHealth = async () => {
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
  };

  return {
    server,
    isServerRunning,
    serverError,
    environment,
    restartServer,
    stopServer,
    getServerHealth
  };
};