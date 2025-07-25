/**
 * Server-only exports
 * Use these in Node.js environments (Next.js API routes, Express servers, etc.)
 */

// Core server classes
export { AzureConfigurationClient } from './server/azure-client';
export { ConfigurationServer } from './server/config-server';
export { AppScopedConfigurationProvider } from './app-scoped-config';

// Azure environment loading utilities
export { AzureEnvironmentLoader, loadAzureToProcessEnv, createNextAuthAzureLoader } from './server/azure-env-loader';

// API route integration utilities (enhanced createAppAzureLoader)
export { ApiRouteConfigHandler, createAppConfigHandler, createAppAzureLoaderLegacy } from './server/api-route-helpers';

// Enhanced App Azure Loader (NEW - fixes critical prefix bug)
export { EnhancedAppAzureLoader, createEnhancedAppAzureLoader, createAppAzureLoader } from './server/enhanced-app-azure-loader';

// New architectural components for advanced use cases
export { AppIsolatedAzureManager, globalAzureManager } from './server/app-isolated-azure-manager';
export { BulletproofFallbackSystem, globalFallbackSystem } from './server/bulletproof-fallback-system';
export { AppScopedKeyTransformer, globalKeyTransformer } from './server/app-key-transformer';
export { AppAwareClientResolver, globalClientResolver } from './client/app-aware-resolver';

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

// API route helper types
export type {
  ApiRouteHandlerOptions,
  ApiConfigResponse
} from './server/api-route-helpers';

// Enhanced App Azure Loader types
export type {
  EnhancedAppAzureOptions,
  EnhancedConfigResponse
} from './server/enhanced-app-azure-loader';

// New architectural component types
export type {
  AppAzureConfig,
  AzureConfigResult
} from './server/app-isolated-azure-manager';

export type {
  FallbackResult,
  FallbackSource
} from './server/bulletproof-fallback-system';

export type {
  AppContextKey,
  AppKeyMappings
} from './server/app-key-transformer';

export type {
  ResolutionResult,
  ResolutionStrategy
} from './client/app-aware-resolver';

export type { ConfigServerOptions } from './server/config-server';

// Utilities that work on server
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';