/**
 * Type Definitions
 * 
 * Core TypeScript interfaces and type definitions for the React Azure Configuration Library.
 * Defines configuration values, authentication options, cache settings, and API responses.
 * 
 * @module types
 */

export interface ConfigurationValue {
  [key: string]: unknown;
}

export type TypedConfigurationValue<T = Record<string, unknown>> = {
  [K in keyof T]: T[K];
}

export interface AuthenticationConfig {
  type: 'servicePrincipal' | 'managedIdentity' | 'azureCli';
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  storage: ('memory' | 'localStorage')[];
  refreshStrategy?: 'load-once' | 'periodic' | 'on-demand'; // Default: 'on-demand'
  refreshInterval?: number; // Auto-refresh interval in milliseconds (for 'periodic' strategy)
}

export interface KeyVaultConfig {
  enableKeyVaultReferences?: boolean; // Default: true for seamless experience
  secretCacheTtl?: number; // Cache TTL for resolved secrets (default: 1 hour)
  maxRetries?: number; // Max retries for Key Vault access (default: 3)
  retryDelayMs?: number; // Delay between retries (default: 1000ms)
  refreshStrategy?: 'load-once' | 'periodic' | 'on-demand'; // Default: 'on-demand'
  refreshInterval?: number; // Auto-refresh interval for secrets (for 'periodic' strategy)
}

export interface AzureConfigOptions {
  endpoint?: string;
  environment: string;
  application?: string;
  label?: string;
  authentication?: AuthenticationConfig;
  cache?: Partial<CacheConfig>;
  enableLocalFallback?: boolean;
  sources?: string[];
  precedence?: 'first-wins' | 'merge-deep';
  configServiceUrl?: string;
  useEmbeddedService?: boolean;
  port?: number;
  keyVault?: KeyVaultConfig;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export interface ConfigResult<T = ConfigurationValue> {
  data: T | null;
  loading: boolean;
  error: string | null;
  source: 'azure' | 'cache' | 'local' | 'environment' | 'api' | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

export interface CachedValue<T = unknown> {
  value: T;
  timestamp: number;
  expires: number;
  source: string;
}

export interface ConfigSourceHierarchy {
  sources: string[];
  precedence: 'first-wins' | 'merge-deep';
  fallbackEnabled: boolean;
}

export interface ConfigApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
  timestamp: number;
  key?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'not-running';
  checks?: Record<string, 'healthy' | 'unhealthy' | 'empty'>;
  timestamp: number;
  error?: string;
}

export interface ServerInfo {
  sources: string[];
  activeSource: string;
  environment: string;
  port: number;
  uptime: number;
  timestamp: number;
}