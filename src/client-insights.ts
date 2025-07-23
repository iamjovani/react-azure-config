/**
 * Application Insights integration for React Azure Config
 * 
 * Optional integration that requires:
 * - @microsoft/applicationinsights-web
 * - @microsoft/applicationinsights-react-js
 * 
 * Only import this if you need Application Insights telemetry.
 * The main package will work without these dependencies.
 */

// Application Insights components and hooks
export { AppInsightsProvider, useAppInsightsAvailable } from './client/insights/provider';
export {
  useAppInsights,
  useTrackEvent,
  useTrackException,
  useTrackPageView,
  useInsightsConfig,
  useTrackPerformance
} from './client/insights/hooks';

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