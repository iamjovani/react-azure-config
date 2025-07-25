/**
 * Application Insights Provider
 * 
 * React provider for Azure Application Insights integration.
 * Automatically initializes when connection string is found in configuration.
 * Follows the same pattern as .NET DefaultAzureCredential approach.
 * 
 * @module client/insights/provider
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { logger } from '../../utils/logger';
import type { 
  AppInsightsContextValue, 
  AppInsightsProviderProps, 
  AppInsightsConfig
} from './types';

// Type definitions for optional peer dependencies
type ApplicationInsights = any;
type ReactPlugin = any;

// Conditional import type helper for dynamic imports
type OptionalWebModule = { ApplicationInsights?: any } | { default?: { ApplicationInsights?: any } } | null;
type OptionalReactModule = { ReactPlugin?: any } | { default?: { ReactPlugin?: any } } | null;

// Application Insights context
const AppInsightsContext = createContext<AppInsightsContextValue | null>(null);

/**
 * Application Insights Provider Component
 * 
 * Automatically initializes Application Insights when connection string is detected
 * in configuration, following the same pattern as service principal Key Vault integration.
 */
export function AppInsightsProvider({ 
  children, 
  config: providedConfig,
  connectionString: overrideConnectionString 
}: AppInsightsProviderProps) {
  // SSR-safe environment detection
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // State for Application Insights instances
  const [appInsights, setAppInsights] = useState<ApplicationInsights | null>(null);
  const [reactPlugin, setReactPlugin] = useState<ReactPlugin | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AppInsightsConfig | null>(null);

  // Use the provided connection string (configuration loading is handled by parent components)
  const connectionString = overrideConnectionString || providedConfig?.connectionString;

  /**
   * Initialize Application Insights with connection string
   * Only runs on client side to prevent SSR issues
   */
  const initializeAppInsights = useCallback(async (connString: string, config: AppInsightsConfig) => {
    // SSR Guard: Only initialize on client side
    if (typeof window === 'undefined') {
      logger.debug('Skipping Application Insights initialization during SSR');
      return;
    }

    try {
      logger.info('Initializing Application Insights', { 
        hasConnectionString: !!connString,
        enableAutoRouteTracking: config.enableAutoRouteTracking 
      });

      // Dynamic imports to avoid bundle size issues for users who don't use App Insights
      const [
        webModule,
        reactModule
      ] = await Promise.all([
        // @ts-expect-error - Optional peer dependency
        import('@microsoft/applicationinsights-web').catch(() => null) as Promise<OptionalWebModule>,
        // @ts-expect-error - Optional peer dependency
        import('@microsoft/applicationinsights-react-js').catch(() => null) as Promise<OptionalReactModule>
      ]);
      
      const ApplicationInsights = webModule && ('ApplicationInsights' in webModule) 
        ? webModule.ApplicationInsights 
        : webModule && ('default' in webModule) 
          ? webModule.default?.ApplicationInsights 
          : null;
          
      const ReactPlugin = reactModule && ('ReactPlugin' in reactModule)
        ? reactModule.ReactPlugin
        : reactModule && ('default' in reactModule)
          ? reactModule.default?.ReactPlugin
          : null;

      if (!ApplicationInsights) {
        const errorMsg = 'Application Insights packages not installed. Install @microsoft/applicationinsights-web and @microsoft/applicationinsights-react-js';
        setError(errorMsg); 
        logger.debug(errorMsg);
        return; // Gracefully exit instead of throwing
      }

      // Create React plugin if enabled
      let plugin: ReactPlugin | null = null;
      if (config.enableReactPlugin !== false && ReactPlugin) {
        plugin = new ReactPlugin();
        setReactPlugin(plugin);
      }

      // Create Application Insights configuration
      const appInsightsConfig: any = {
        connectionString: connString,
        enableAutoRouteTracking: config.enableAutoRouteTracking,
        enableCookiesUsage: config.enableCookiesUsage,
        enableRequestHeaderTracking: config.enableRequestHeaderTracking,
        enableResponseHeaderTracking: config.enableResponseHeaderTracking,
        extensions: plugin ? [plugin] : undefined,
        ...config.additionalConfig
      };

      // Initialize Application Insights
      const appInsightsInstance = new ApplicationInsights({
        config: appInsightsConfig
      });

      appInsightsInstance.loadAppInsights();
      
      // SSR Guard: Only track page view if we have window object
      if (typeof window !== 'undefined') {
        appInsightsInstance.trackPageView();
      }

      setAppInsights(appInsightsInstance);
      setIsInitialized(true);
      setError(null);
      
      logger.info('Application Insights initialized successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Application Insights';
      setError(errorMessage);
      setIsInitialized(false);
      
      logger.error('Failed to initialize Application Insights', err);
    }
  }, []);

  /**
   * Auto-initialize Application Insights when connection string becomes available
   * Only runs on client side to prevent SSR issues
   */
  useEffect(() => {
    // SSR Guard: Only initialize on client side
    if (!isClient) {
      logger.debug('Skipping Application Insights initialization during SSR');
      return;
    }

    if (!connectionString) {
      logger.debug('No Application Insights connection string found, skipping initialization');
      return;
    }

    // Create configuration from provided config with sensible defaults
    const config: AppInsightsConfig = {
      connectionString,
      autoInitialize: true,
      enableReactPlugin: true,
      enableAutoRouteTracking: true,
      enableCookiesUsage: false,
      enableRequestHeaderTracking: false,
      enableResponseHeaderTracking: false,
      ...providedConfig
    };

    setCurrentConfig(config);

    // Only initialize if auto-initialize is enabled (default: true)
    if (config.autoInitialize !== false && !isInitialized && !appInsights) {
      logger.debug('Auto-initializing Application Insights with provided configuration');
      initializeAppInsights(connectionString, config);
    }

  }, [
    isClient,
    connectionString,
    providedConfig,
    initializeAppInsights,
    isInitialized,
    appInsights
  ]);

  // Context value
  const contextValue: AppInsightsContextValue = {
    appInsights,
    reactPlugin,
    isInitialized,
    config: currentConfig,
    error,
    connectionString: connectionString || null
  };

  return (
    <AppInsightsContext.Provider value={contextValue}>
      {children}
    </AppInsightsContext.Provider>
  );
}

/**
 * Hook to access Application Insights context
 */
export const useAppInsightsContext = (): AppInsightsContextValue => {
  const context = useContext(AppInsightsContext);
  
  if (!context) {
    throw new Error('useAppInsightsContext must be used within an AppInsightsProvider');
  }
  
  return context;
};

/**
 * Hook to check if Application Insights is available
 * 
 * Returns null if Application Insights packages are not installed,
 * avoiding runtime errors when used without peer dependencies.
 * SSR-safe: only checks availability on client side.
 */
export const useAppInsightsAvailable = (): boolean => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);

  useEffect(() => {
    // SSR Guard: Only check availability on client side  
    if (typeof window === 'undefined') {
      return;
    }

    const checkAvailability = async () => {
      try {
        // Try to import Application Insights packages
        const [webModule, reactModule] = await Promise.all([
          // @ts-expect-error - Optional peer dependency
          import('@microsoft/applicationinsights-web').catch(() => null) as Promise<OptionalWebModule>,
          // @ts-expect-error - Optional peer dependency
          import('@microsoft/applicationinsights-react-js').catch(() => null) as Promise<OptionalReactModule>
        ]);
        
        const hasWebModule = !!(webModule && (
          ('ApplicationInsights' in webModule && webModule.ApplicationInsights) ||
          ('default' in webModule && webModule.default?.ApplicationInsights)
        ));
        
        const hasReactModule = !!(reactModule && (
          ('ReactPlugin' in reactModule && reactModule.ReactPlugin) ||
          ('default' in reactModule && reactModule.default?.ReactPlugin)
        ));
        
        setIsAvailable(hasWebModule && hasReactModule);
      } catch {
        setIsAvailable(false);
        logger.debug('Application Insights packages not available - install @microsoft/applicationinsights-web and @microsoft/applicationinsights-react-js to enable telemetry');
      }
    };

    checkAvailability();
  }, []);

  return isAvailable;
};