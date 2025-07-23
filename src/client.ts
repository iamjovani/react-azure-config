/**
 * Client-only exports (browser-safe)
 * Use these in React components and browser environments
 */

// React components and hooks - NO server dependencies
export { ConfigProvider } from './client/context';
export {
  useConfig,
  useConfigValue,
  useConfigContext,
  useConfigProvider,
  useFeature,
  useEnv
} from './client/hooks';

// Runtime client that fetches from API endpoints (no embedded server)
export { RuntimeConfigurationClient } from './runtime-config-client';

// Factory for runtime client
export { createRuntimeConfigClient } from './runtime-config-client';

// Application Insights integration (optional peer dependencies)
export { AppInsightsProvider, useAppInsightsAvailable } from './client/insights/provider';
export {
  useAppInsights,
  useTrackEvent,
  useTrackException,
  useTrackPageView,
  useInsightsConfig,
  useTrackPerformance
} from './client/insights/hooks';

// Types needed for client
export type {
  ConfigurationValue,
  TypedConfigurationValue,
  ConfigResult,
  CachedValue,
  ConfigApiResponse
} from './types';

// Application Insights types
export type {
  AppInsightsConfig,
  AppInsightsContextValue,
  AppInsightsProviderProps,
  CustomEventData,
  CustomExceptionData,
  PageViewData,
  TelemetryContext,
  UseAppInsightsReturn
} from './client/insights/types';