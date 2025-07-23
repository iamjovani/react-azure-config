/**
 * Server-only exports
 * Use these in Node.js environments (Next.js API routes, Express servers, etc.)
 */

// Core server classes
export { AzureConfigurationClient } from './server/azure-client';
export { ConfigurationServer } from './server/config-server';

// Factory functions for server use
export { createConfigServer } from './server/config-server';

// Types needed for server configuration
export type {
  AzureConfigOptions,
  AuthenticationConfig,
  KeyVaultConfig
} from './types';

export type { ConfigServerOptions } from './server/config-server';

// Utilities that work on server
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';