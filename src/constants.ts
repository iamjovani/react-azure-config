/**
 * Production-optimized constants with environment variable overrides
 * 
 * This module provides configurable constants that can be overridden via environment variables
 * for production deployments while maintaining sensible defaults for development.
 * 
 * @module constants
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const getEnvString = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvArray = (key: string, defaultValue: string[]): string[] => {
  const value = process.env[key];
  return value ? value.split(',').map(s => s.trim()) : defaultValue;
};

export const DEFAULT_CONSTANTS = {
  // Ports
  CONFIG_SERVER_PORT: getEnvNumber('CONFIG_SERVER_PORT', 3001),
  APP_SERVER_PORT: getEnvNumber('APP_SERVER_PORT', 3000),
  
  // Timeouts (in milliseconds) - Production optimized
  DEFAULT_TIMEOUT: getEnvNumber('DEFAULT_TIMEOUT', 30000),
  DEFAULT_CACHE_TTL: getEnvNumber('CACHE_TTL', 60 * 60 * 1000), // 1 hour
  LOCAL_CONFIG_TTL: getEnvNumber('LOCAL_CONFIG_TTL', 30000),
  
  // Cache settings - Production optimized
  DEFAULT_CACHE_SIZE: getEnvNumber('CACHE_MAX_SIZE', 1000),
  MEMORY_CACHE_SIZE: getEnvNumber('MEMORY_CACHE_SIZE', 100),
  MEMORY_CACHE_TTL: getEnvNumber('MEMORY_CACHE_TTL', 5 * 60 * 1000), // 5 minutes
  CACHE_CLEANUP_INTERVAL: getEnvNumber('CACHE_CLEANUP_INTERVAL', 60 * 1000), // 1 minute
  
  // Retry settings - Production hardened
  MAX_RETRIES: getEnvNumber('MAX_RETRIES', 3),
  RETRY_DELAY_MS: getEnvNumber('RETRY_DELAY_MS', 1000),
  
  // URLs and prefixes
  DEFAULT_BASE_URL: getEnvString('DEFAULT_BASE_URL', 'http://localhost:3000'),
  CACHE_KEY_PREFIX: getEnvString('CACHE_KEY_PREFIX', 'react-azure-config:'),
  ENV_VAR_PREFIX: getEnvString('ENV_VAR_PREFIX', 'REACT_APP_'),
  
  // Defaults
  DEFAULT_APPLICATION: getEnvString('DEFAULT_APPLICATION', 'react-app'),
  DEFAULT_ENVIRONMENT: getEnvString('NODE_ENV', 'local'),
  
  // Key Vault - Production optimized
  KV_SECRET_CACHE_TTL: getEnvNumber('AZURE_KEYVAULT_CACHE_TTL', 60 * 60 * 1000), // 1 hour
  KV_REFRESH_INTERVAL: getEnvNumber('AZURE_KEYVAULT_REFRESH_INTERVAL', 30 * 60 * 1000), // 30 minutes
  
  // Server - Production CORS
  DEFAULT_CORS_ORIGINS: getEnvArray('CONFIG_SERVER_CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:3001'])
} as const;

export const REFRESH_STRATEGIES = {
  LOAD_ONCE: 'load-once',
  PERIODIC: 'periodic',
  ON_DEMAND: 'on-demand'
} as const;

export const AUTH_TYPES = {
  SERVICE_PRINCIPAL: 'servicePrincipal',
  MANAGED_IDENTITY: 'managedIdentity',
  AZURE_CLI: 'azureCli'
} as const;

export const CONFIG_SOURCES = {
  AZURE: 'azure',
  ENVIRONMENT: 'environment',
  LOCAL: 'local',
  DEFAULTS: 'defaults'
} as const;

// Production environment detection
export const ENVIRONMENT = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  TEST: 'test',
  LOCAL: 'local'
} as const;

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === ENVIRONMENT.PRODUCTION;
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT;
};

export const isTest = (): boolean => {
  return process.env.NODE_ENV === ENVIRONMENT.TEST;
};