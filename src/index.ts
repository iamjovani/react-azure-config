/**
 * React Azure Configuration Library
 * 
 * A high-performance React configuration library with Azure App Configuration integration,
 * embedded config service, Key Vault reference resolution, and Docker deployment focus.
 * 
 * @package @yourorg/react-azure-config
 * @version 0.1.0
 */

// ============================================================================
// Core Types
// ============================================================================
export type {
  ConfigurationValue,
  TypedConfigurationValue,
  AuthenticationConfig,
  CacheConfig,
  KeyVaultConfig,
  AzureConfigOptions,
  ConfigResult,
  CachedValue,
  ConfigSourceHierarchy,
  ConfigApiResponse,
  HealthCheckResponse,
  ServerInfo
} from './types';

// ============================================================================
// Core Clients and Services
// ============================================================================
export { AzureConfigurationClient } from './azure-client';
export { RuntimeConfigurationClient } from './runtime-config-client';
export { ConfigurationServer } from './config-server';
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';

// ============================================================================
// React Integration
// ============================================================================
export { ConfigProvider } from './context';
export {
  useConfig,
  useConfigValue,
  useConfigContext,
  useConfigProvider,
  useFeature,
  useEnv
} from './hooks';

// ============================================================================
// Factory Functions
// ============================================================================
import type { AzureConfigOptions } from './types';
import { RuntimeConfigurationClient } from './runtime-config-client';
import { ConfigurationServer, type ConfigServerOptions } from './config-server';

/**
 * Creates a new Azure configuration client for React applications
 */
export const createAzureConfigClient = (options: AzureConfigOptions): RuntimeConfigurationClient => {
  return new RuntimeConfigurationClient(options);
};

/**
 * Creates a new runtime configuration client (alias for createAzureConfigClient)
 */
export const createRuntimeConfigClient = (options: AzureConfigOptions): RuntimeConfigurationClient => {
  return new RuntimeConfigurationClient(options);
};

/**
 * Creates a new configuration server for embedded deployments
 */
export const createConfigServer = (options: ConfigServerOptions): ConfigurationServer => {
  return new ConfigurationServer(options);
};

// ============================================================================
// Default Export
// ============================================================================
/**
 * Default export for backward compatibility
 * @deprecated Use createRuntimeConfigClient instead
 */
export { RuntimeConfigurationClient as default } from './runtime-config-client';