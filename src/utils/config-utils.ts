/**
 * Configuration Utilities
 * 
 * Utility functions for configuration manipulation, environment variable transformation,
 * default value generation, and nested property operations.
 * 
 * @module utils/config-utils
 */

// Internal modules
import type { ConfigurationValue } from '../types';
import { DEFAULT_CONSTANTS } from '../constants';

/**
 * Sets a nested property in an object using dot notation
 */
export const setNestedProperty = (obj: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[keys[keys.length - 1]] = value;
};

/**
 * Gets a nested property from an object using dot notation
 */
export const getNestedProperty = <T = unknown>(obj: unknown, path: string): T | undefined => {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && current !== null && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  
  return current as T;
};

/**
 * Transforms REACT_APP_ environment variable names to config path notation
 */
export const transformEnvKeyToConfigPath = (envKey: string): string => {
  return envKey
    .replace(DEFAULT_CONSTANTS.ENV_VAR_PREFIX, '')
    .toLowerCase()
    .split('_')
    .reduce((acc, part, index) => {
      if (index === 0) return part;
      
      if (part === 'url' || part === 'uri') {
        return acc + '.url';
      }
      if (part === 'id') {
        return acc + '.id';
      }
      if (part === 'key' || part === 'secret') {
        return acc + '.' + part;
      }
      
      return acc + '.' + part;
    }, '');
};

/**
 * Creates a default configuration object
 */
export const getDefaultConfiguration = (environment?: string): ConfigurationValue => {
  return {
    api: {
      baseUrl: DEFAULT_CONSTANTS.DEFAULT_BASE_URL,
      timeout: DEFAULT_CONSTANTS.DEFAULT_TIMEOUT
    },
    auth: {
      domain: 'localhost'
    },
    features: {},
    environment: environment || DEFAULT_CONSTANTS.DEFAULT_ENVIRONMENT
  };
};

/**
 * Creates a default browser configuration object
 */
export const getDefaultBrowserConfiguration = (): ConfigurationValue => {
  return {
    api: {
      baseUrl: typeof window !== 'undefined' ? window.location.origin : DEFAULT_CONSTANTS.DEFAULT_BASE_URL,
      timeout: DEFAULT_CONSTANTS.DEFAULT_TIMEOUT
    },
    environment: 'browser',
    features: {}
  };
};

/**
 * Creates a cache key with the standard prefix
 */
export const createCacheKey = (key: string): string => {
  return `${DEFAULT_CONSTANTS.CACHE_KEY_PREFIX}${key}`;
};

/**
 * Checks if a string value is a Key Vault reference
 */
export const isKeyVaultReference = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  
  try {
    const parsed = JSON.parse(value) as { uri?: string };
    return !!(parsed.uri && parsed.uri.includes('vault.azure.net'));
  } catch {
    return false;
  }
};

/**
 * Promise-based delay utility
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Parses string values to appropriate types (boolean, number, JSON, or string)
 */
export const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^\d*\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  if ((value.startsWith('[') && value.endsWith(']')) || 
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      // Fall through to return string
    }
  }

  return value;
};