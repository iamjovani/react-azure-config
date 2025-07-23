/**
 * Application Insights Types
 * 
 * Type definitions for Azure Application Insights integration.
 * Defines configuration interfaces and telemetry tracking types.
 * 
 * @module client/insights/types
 */

// Conditional imports to handle optional peer dependencies
type ReactPlugin = any;
type ApplicationInsights = any;
type IConfiguration = any;

// If packages are available, these types will be overridden at runtime

/**
 * Application Insights configuration options
 */
export interface AppInsightsConfig {
  /** Application Insights connection string (can be Key Vault reference) */
  connectionString?: string;
  
  /** Auto-initialize Application Insights when connection string is found */
  autoInitialize?: boolean;
  
  /** Enable React plugin for enhanced React tracking */
  enableReactPlugin?: boolean;
  
  /** Enable automatic route change tracking */
  enableAutoRouteTracking?: boolean;
  
  /** Enable cookies usage for user tracking */
  enableCookiesUsage?: boolean;
  
  /** Enable request header tracking */
  enableRequestHeaderTracking?: boolean;
  
  /** Enable response header tracking */
  enableResponseHeaderTracking?: boolean;
  
  /** Additional Application Insights configuration options */
  additionalConfig?: Partial<IConfiguration>;
}

/**
 * Application Insights context value provided to React components
 */
export interface AppInsightsContextValue {
  /** Application Insights instance */
  appInsights: ApplicationInsights | null;
  
  /** React plugin instance */
  reactPlugin: ReactPlugin | null;
  
  /** Whether Application Insights is initialized and ready */
  isInitialized: boolean;
  
  /** Current configuration */
  config: AppInsightsConfig | null;
  
  /** Initialization error if any */
  error: string | null;
  
  /** Connection string currently in use */
  connectionString: string | null;
}

/**
 * Custom event data for telemetry tracking
 */
export interface CustomEventData {
  /** Event name */
  name: string;
  
  /** Custom properties associated with the event */
  properties?: { [key: string]: any };
  
  /** Custom measurements/metrics associated with the event */
  measurements?: { [key: string]: number };
}

/**
 * Custom exception data for error tracking
 */
export interface CustomExceptionData {
  /** Error or exception object */
  exception: Error;
  
  /** Severity level of the exception */
  severityLevel?: number;
  
  /** Custom properties associated with the exception */
  properties?: { [key: string]: any };
  
  /** Custom measurements associated with the exception */
  measurements?: { [key: string]: number };
}

/**
 * Page view telemetry data
 */
export interface PageViewData {
  /** Page name */
  name?: string;
  
  /** Page URL */
  url?: string;
  
  /** Custom properties associated with the page view */
  properties?: { [key: string]: any };
  
  /** Custom measurements associated with the page view */
  measurements?: { [key: string]: number };
}

/**
 * Application Insights provider props
 */
export interface AppInsightsProviderProps {
  /** Child components */
  children: React.ReactNode;
  
  /** Application Insights configuration */
  config?: AppInsightsConfig;
  
  /** Override connection string (for testing/development) */
  connectionString?: string;
}

/**
 * Telemetry context for tracking user actions
 */
export interface TelemetryContext {
  /** Current user ID */
  userId?: string;
  
  /** Current session ID */
  sessionId?: string;
  
  /** Application version */
  appVersion?: string;
  
  /** Environment (dev/staging/production) */
  environment?: string;
  
  /** Additional context properties */
  properties?: { [key: string]: any };
}

/**
 * Hook return type for useAppInsights
 */
export interface UseAppInsightsReturn {
  /** Application Insights instance */
  appInsights: ApplicationInsights | null;
  
  /** Track custom event */
  trackEvent: (event: CustomEventData) => void;
  
  /** Track exception/error */
  trackException: (exception: CustomExceptionData) => void;
  
  /** Track page view */
  trackPageView: (pageView?: PageViewData) => void;
  
  /** Track custom metric */
  trackMetric: (name: string, value: number, properties?: { [key: string]: any }) => void;
  
  /** Set telemetry context */
  setContext: (context: TelemetryContext) => void;
  
  /** Whether Application Insights is ready for tracking */
  isReady: boolean;
  
  /** Current connection string */
  connectionString: string | null;
}

/**
 * Configuration keys for Application Insights in Azure App Configuration
 */
export const APP_INSIGHTS_CONFIG_KEYS = {
  CONNECTION_STRING: 'ApplicationInsights:ConnectionString',
  ENABLE_AUTO_ROUTE_TRACKING: 'ApplicationInsights:EnableAutoRouteTracking',
  ENABLE_COOKIES_USAGE: 'ApplicationInsights:EnableCookiesUsage',
  ENABLE_REQUEST_HEADER_TRACKING: 'ApplicationInsights:EnableRequestHeaderTracking',
  ENABLE_RESPONSE_HEADER_TRACKING: 'ApplicationInsights:EnableResponseHeaderTracking',
} as const;