/**
 * React Azure Configuration Library - Main Entry (Client-Safe)
 * 
 * This is the main entry point that exports client-safe components and utilities.
 * For server-side functionality, import from 'react-azure-config/server'
 * 
 * @version 0.3.0
 */

// Export everything from client entry point
export * from './client';

// Export shared utilities that work in both environments
export { LocalConfigurationProvider } from './local-config';
export { ConfigurationCache } from './cache';

// Export shared types
export type * from './types';

// Default export for backward compatibility
export { RuntimeConfigurationClient as default } from './runtime-config-client';