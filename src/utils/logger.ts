/**
 * Logger Utility
 * 
 * Configurable logging system with level-based filtering, timestamps,
 * and color support for development environments.
 * SSR-safe: Uses environment detection utilities to prevent hydration issues.
 * 
 * @module utils/logger
 */

// Import SSR-safe environment utilities
// We need to do a try-catch import since this might be called from different contexts
let getEnvVar: (key: string, defaultValue?: string) => string;
let environment: any;

try {
  // Try importing from client utilities
  const clientUtils = require('../client/ClientOnly');
  getEnvVar = clientUtils.getEnvVar;
  environment = clientUtils.environment;
} catch {
  // Fallback for server-side or environments where client utils aren't available
  getEnvVar = (key: string, defaultValue: string = '') => {
    try {
      return process.env[key] || defaultValue;
    } catch {
      return defaultValue;
    }
  };
  environment = {
    isServer: typeof window === 'undefined',
    isClient: typeof window !== 'undefined',
    isBrowser: typeof window !== 'undefined' && typeof window.document !== 'undefined',
    isDevelopment: false,
    isProduction: true,
    isTest: false
  };
  
  // Update environment flags based on available data
  try {
    environment.isDevelopment = process.env.NODE_ENV === 'development';
    environment.isProduction = process.env.NODE_ENV === 'production';
    environment.isTest = process.env.NODE_ENV === 'test';
  } catch {
    // Keep defaults
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enableTimestamp?: boolean;
  enableColors?: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    const defaultLevel = this.getDefaultLogLevel();
    const defaultPrefix = getEnvVar('LOG_PREFIX', '[ReactAzureConfig]');
    
    this.config = {
      level: (getEnvVar('LOG_LEVEL') as LogLevel) || defaultLevel,
      prefix: defaultPrefix,
      enableTimestamp: environment.isProduction,
      enableColors: !environment.isProduction,
      ...config
    };
  }
  
  private getDefaultLogLevel(): LogLevel {
    if (environment.isProduction) return 'warn';
    if (environment.isTest) return 'silent';
    return 'debug';
  }
  
  private formatMessage(level: LogLevel, message: string): string {
    let formatted = `${this.config.prefix} ${message}`;
    
    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      formatted = `[${timestamp}] ${formatted}`;
    }
    
    if (this.config.enableColors && typeof window === 'undefined') {
      // Node.js color codes
      const colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
        silent: ''
      };
      const reset = '\x1b[0m';
      formatted = `${colors[level]}${formatted}${reset}`;
    }
    
    return formatted;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex && this.config.level !== 'silent';
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

export const logger = new Logger();
export { Logger };
export type { LogLevel };