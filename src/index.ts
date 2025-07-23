/**
 * React Azure Configuration Library - Main Entry (Server-Safe)
 * 
 * This is the main entry point that exports server-safe utilities and types.
 * For client-side React hooks, import from 'react-azure-config/client'
 * For server-side functionality, import from 'react-azure-config/server'
 * 
 * @version 0.3.4
 */

// Export shared utilities that work in both environments
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';

// Export shared types
export type * from './types';

// Default export for backward compatibility
export { RuntimeConfigurationClient as default } from './runtime-config-client';