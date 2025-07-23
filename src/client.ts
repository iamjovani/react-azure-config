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

// Application Insights integration is optional
// Import from 'react-azure-config/client/insights' if needed

// Types needed for client
export type {
  ConfigurationValue,
  TypedConfigurationValue,
  ConfigResult,
  CachedValue,
  ConfigApiResponse
} from './types';

// Application Insights types are in 'react-azure-config/client/insights'