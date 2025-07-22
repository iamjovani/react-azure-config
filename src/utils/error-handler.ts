/**
 * Error Handling Utilities
 * 
 * Standardized error handling patterns for consistent error processing,
 * logging, and user-friendly error messages across the library.
 * 
 * @module utils/error-handler
 */

import { logger } from './logger';

/**
 * Standard error types used throughout the library
 */
export enum ErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AZURE_CLIENT_ERROR = 'AZURE_CLIENT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  KEYVAULT_ERROR = 'KEYVAULT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR'
}

/**
 * Enhanced error class with type information and context
 */
export class ConfigurationError extends Error {
  public readonly type: ErrorType;
  public readonly context: Record<string, unknown> | undefined;
  public readonly originalError: Error | undefined;

  constructor(
    type: ErrorType,
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ConfigurationError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }

  /**
   * Convert to JSON for logging and serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }
}

/**
 * Handles errors consistently with logging and optional transformation
 */
export const handleError = (
  error: unknown,
  type: ErrorType,
  context?: Record<string, unknown>,
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error'
): ConfigurationError => {
  const originalError = error instanceof Error ? error : undefined;
  const message = error instanceof Error ? error.message : String(error);
  
  const configError = new ConfigurationError(type, message, context, originalError);
  
  // Log the error with appropriate level
  logger[logLevel](`${type}: ${message}`, { context, originalError: originalError?.stack });
  
  return configError;
};

/**
 * Safely extracts error message from unknown error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
};

/**
 * Checks if error is a specific Azure SDK error code
 */
export const isAzureError = (error: unknown, code?: string): boolean => {
  if (!error || typeof error !== 'object') return false;
  
  const azureError = error as any;
  if (code) {
    return azureError.code === code || azureError.statusCode?.toString() === code;
  }
  
  return !!(azureError.code || azureError.statusCode);
};

/**
 * Checks if error is a network/connectivity issue
 */
export const isNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  
  const err = error as any;
  return !!(
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.message?.includes('network') ||
    err.message?.includes('timeout') ||
    err.message?.includes('connection')
  );
};

/**
 * Checks if error is recoverable (should retry)
 */
export const isRecoverableError = (error: unknown): boolean => {
  if (isNetworkError(error)) return true;
  
  if (!error || typeof error !== 'object') return false;
  
  const err = error as any;
  const statusCode = err.statusCode || err.status;
  
  // HTTP status codes that indicate transient errors
  return !!(
    statusCode === 429 || // Too Many Requests
    statusCode === 502 || // Bad Gateway
    statusCode === 503 || // Service Unavailable
    statusCode === 504    // Gateway Timeout
  );
};

/**
 * Creates a user-friendly error message from technical errors
 */
export const createUserMessage = (error: ConfigurationError): string => {
  switch (error.type) {
    case ErrorType.AZURE_CLIENT_ERROR:
      return 'Unable to connect to Azure App Configuration. Please check your connection settings.';
    
    case ErrorType.KEYVAULT_ERROR:
      return 'Unable to access Azure Key Vault. Please verify your permissions.';
    
    case ErrorType.NETWORK_ERROR:
      return 'Network connection failed. Please check your internet connection.';
    
    case ErrorType.CONFIGURATION_ERROR:
      return 'Configuration loading failed. Using default values.';
    
    case ErrorType.VALIDATION_ERROR:
      return 'Invalid configuration provided. Please check your settings.';
    
    case ErrorType.SERVER_ERROR:
      return 'Configuration server error. Please try again.';
    
    case ErrorType.CACHE_ERROR:
      return 'Cache operation failed. Configuration may be slower.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};