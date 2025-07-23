/**
 * Application Insights Hooks
 * 
 * React hooks for Azure Application Insights telemetry tracking.
 * Provides simple interfaces for custom event tracking, exception logging,
 * and performance monitoring.
 * 
 * @module client/insights/hooks
 */

import { useCallback, useEffect, useState } from 'react';
import { useAppInsightsContext, useAppInsightsAvailable } from './provider';
import { logger } from '../../utils/logger';
import type { 
  UseAppInsightsReturn, 
  CustomEventData, 
  CustomExceptionData, 
  PageViewData, 
  TelemetryContext,
  AppInsightsConfig,
  AppInsightsContextValue
} from './types';

/**
 * Safe wrapper for useAppInsightsContext that handles SSR and missing context gracefully
 */
const useSafeAppInsightsContext = (): AppInsightsContextValue => {
  try {
    return useAppInsightsContext();
  } catch (error) {
    // Context not available - this is fine during SSR or when not wrapped in provider
    return {
      appInsights: null,
      reactPlugin: null,
      isInitialized: false,
      config: null,
      error: null,
      connectionString: null
    };
  }
};

/**
 * Primary hook for Application Insights integration
 * 
 * Provides methods for tracking custom events, exceptions, and metrics.
 * Gracefully handles cases where Application Insights is not initialized.
 * 
 * This hook is SSR-safe and handles conditional context access properly.
 */
export const useAppInsights = (): UseAppInsightsReturn => {
  const context = useSafeAppInsightsContext();

  const { appInsights, isInitialized, connectionString } = context;

  /**
   * Track custom event with properties and measurements
   */
  const trackEvent = useCallback((event: CustomEventData): void => {
    if (!appInsights || !isInitialized) {
      logger.debug('Application Insights not ready, skipping event tracking', { eventName: event.name });
      return;
    }

    try {
      appInsights.trackEvent(event, event.properties);
      logger.debug('Event tracked successfully', { eventName: event.name });
    } catch (error) {
      logger.error('Failed to track event', error);
    }
  }, [appInsights, isInitialized]);

  /**
   * Track exception with context and properties
   */
  const trackException = useCallback((exceptionData: CustomExceptionData): void => {
    if (!appInsights || !isInitialized) {
      logger.debug('Application Insights not ready, skipping exception tracking', { 
        error: exceptionData.exception.message 
      });
      return;
    }

    try {
      appInsights.trackException({
        exception: exceptionData.exception,
        severityLevel: exceptionData.severityLevel,
        properties: exceptionData.properties,
        measurements: exceptionData.measurements
      });
      logger.debug('Exception tracked successfully', { 
        error: exceptionData.exception.message 
      });
    } catch (error) {
      logger.error('Failed to track exception', error);
    }
  }, [appInsights, isInitialized]);

  /**
   * Track page view with custom properties
   */
  const trackPageView = useCallback((pageViewData?: PageViewData): void => {
    if (!appInsights || !isInitialized) {
      logger.debug('Application Insights not ready, skipping page view tracking');
      return;
    }

    try {
      if (pageViewData) {
        appInsights.trackPageView({
          name: pageViewData.name,
          uri: pageViewData.url,
          properties: pageViewData.properties,
          measurements: pageViewData.measurements
        });
      } else {
        appInsights.trackPageView();
      }
      logger.debug('Page view tracked successfully');
    } catch (error) {
      logger.error('Failed to track page view', error);
    }
  }, [appInsights, isInitialized]);

  /**
   * Track custom metric
   */
  const trackMetric = useCallback((
    name: string, 
    value: number, 
    properties?: { [key: string]: any }
  ): void => {
    if (!appInsights || !isInitialized) {
      logger.debug('Application Insights not ready, skipping metric tracking', { metricName: name });
      return;
    }

    try {
      appInsights.trackMetric({ name, average: value }, properties);
      logger.debug('Metric tracked successfully', { metricName: name, value });
    } catch (error) {
      logger.error('Failed to track metric', error);
    }
  }, [appInsights, isInitialized]);

  /**
   * Set telemetry context for all future telemetry
   */
  const setContext = useCallback((telemetryContext: TelemetryContext): void => {
    if (!appInsights || !isInitialized) {
      logger.debug('Application Insights not ready, skipping context setup');
      return;
    }

    try {
      // Set user context
      if (telemetryContext.userId) {
        appInsights.setAuthenticatedUserContext(telemetryContext.userId);
      }

      // Set global properties
      if (telemetryContext.properties) {
        Object.entries(telemetryContext.properties).forEach(([key, value]) => {
          appInsights.addTelemetryInitializer((envelope: any) => {
            envelope.data = envelope.data || {};
            envelope.data.baseData = envelope.data.baseData || {};
            envelope.data.baseData.properties = envelope.data.baseData.properties || {};
            envelope.data.baseData.properties[key] = value;
            return true;
          });
        });
      }

      // Set application version
      if (telemetryContext.appVersion) {
        appInsights.addTelemetryInitializer((envelope: any) => {
          envelope.tags = envelope.tags || {};
          envelope.tags['ai.application.ver'] = telemetryContext.appVersion;
          return true;
        });
      }

      // Set environment
      if (telemetryContext.environment) {
        appInsights.addTelemetryInitializer((envelope: any) => {
          envelope.tags = envelope.tags || {};
          envelope.tags['ai.cloud.role'] = telemetryContext.environment;
          return true;
        });
      }

      logger.debug('Telemetry context set successfully');
    } catch (error) {
      logger.error('Failed to set telemetry context', error);
    }
  }, [appInsights, isInitialized]);

  return {
    appInsights,
    trackEvent,
    trackException,
    trackPageView,
    trackMetric,
    setContext,
    isReady: isInitialized,
    connectionString
  };
};

/**
 * Hook for tracking user interactions automatically
 * 
 * Provides simplified methods for common user action tracking.
 */
export const useTrackEvent = () => {
  const { trackEvent, isReady } = useAppInsights();

  return useCallback((eventName: string, properties?: { [key: string]: any }) => {
    if (!isReady) return;
    
    trackEvent({
      name: eventName,
      properties: {
        timestamp: new Date().toISOString(),
        ...properties
      }
    });
  }, [trackEvent, isReady]);
};

/**
 * Hook for tracking exceptions with automatic error boundary integration
 */
export const useTrackException = () => {
  const { trackException, isReady } = useAppInsights();

  return useCallback((error: Error, context?: { [key: string]: any }) => {
    if (!isReady) return;
    
    trackException({
      exception: error,
      severityLevel: 3, // Error level
      properties: {
        timestamp: new Date().toISOString(),
        stack: error.stack,
        ...context
      }
    });
  }, [trackException, isReady]);
};

/**
 * Hook for tracking page views with automatic route detection
 */
export const useTrackPageView = () => {
  const { trackPageView, isReady } = useAppInsights();

  // Auto-track page view on component mount
  useEffect(() => {
    if (isReady) {
      trackPageView({
        name: document.title,
        url: window.location.href,
        properties: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      });
    }
  }, [trackPageView, isReady]);

  // Return manual tracking function
  return useCallback((pageName?: string, additionalProperties?: { [key: string]: any }) => {
    if (!isReady) return;
    
    trackPageView({
      name: pageName || document.title,
      url: window.location.href,
      properties: {
        timestamp: new Date().toISOString(),
        ...additionalProperties
      }
    });
  }, [trackPageView, isReady]);
};

/**
 * Hook to get current Application Insights configuration
 * 
 * Returns the current configuration including connection string status.
 */
export const useInsightsConfig = (): AppInsightsConfig & { 
  isConfigured: boolean; 
  isInitialized: boolean; 
  error: string | null;
} => {
  const isAvailable = useAppInsightsAvailable();
  const [defaultConfig] = useState<AppInsightsConfig>({
    autoInitialize: false,
    enableReactPlugin: false,
    enableAutoRouteTracking: false,
    enableCookiesUsage: false,
    enableRequestHeaderTracking: false,
    enableResponseHeaderTracking: false
  });

  // Use safe context access instead of conditional hook calls
  const context = useSafeAppInsightsContext();
  
  if (!isAvailable) {
    return {
      ...defaultConfig,
      isConfigured: false,
      isInitialized: false,
      error: 'Application Insights packages not installed'
    };
  }

  const { config, isInitialized, error, connectionString } = context;

  return {
    ...(config || defaultConfig),
    isConfigured: !!connectionString,
    isInitialized,
    error
  };
};

/**
 * Hook for tracking performance metrics
 * 
 * Provides utilities for measuring and tracking custom performance metrics.
 */
export const useTrackPerformance = () => {
  const { trackMetric, isReady } = useAppInsights();

  /**
   * Track timing metric
   */
  const trackTiming = useCallback((name: string, duration: number, properties?: { [key: string]: any }) => {
    if (!isReady) return;
    
    trackMetric(`${name}_duration_ms`, duration, {
      timestamp: new Date().toISOString(),
      ...properties
    });
  }, [trackMetric, isReady]);

  /**
   * Create a performance timer
   */
  const createTimer = useCallback((name: string) => {
    const startTime = Date.now();
    
    return {
      stop: (properties?: { [key: string]: any }) => {
        const duration = Date.now() - startTime;
        trackTiming(name, duration, properties);
        return duration;
      }
    };
  }, [trackTiming]);

  /**
   * Track custom counter metric
   */
  const trackCounter = useCallback((name: string, value: number = 1, properties?: { [key: string]: any }) => {
    if (!isReady) return;
    
    trackMetric(`${name}_count`, value, {
      timestamp: new Date().toISOString(),
      ...properties
    });
  }, [trackMetric, isReady]);

  return {
    trackTiming,
    createTimer,
    trackCounter,
    isReady
  };
};