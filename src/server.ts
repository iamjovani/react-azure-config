/**
 * Server-only exports
 * Use these in Node.js environments (Next.js API routes, Express servers, etc.)
 */

// Core server classes
export { AzureConfigurationClient } from './server/azure-client';
export { ConfigurationServer } from './server/config-server';
export { AppScopedConfigurationProvider } from './app-scoped-config';

// Azure environment loading utilities
export { AzureEnvironmentLoader, loadAzureToProcessEnv, createAppAzureLoader, createNextAuthAzureLoader } from './server/azure-env-loader';

// Factory functions for server use
export { createConfigServer } from './server/config-server';

// Types needed for server configuration
export type {
  AzureConfigOptions,
  AuthenticationConfig,
  KeyVaultConfig
} from './types';

// Azure environment loader types
export type {
  AzureEnvLoaderOptions,
  NextAuthAzureMapping
} from './server/azure-env-loader';

export type { ConfigServerOptions } from './server/config-server';

// Utilities that work on server
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';