/**
 * Logger Utility
 * 
 * Configurable logging system with level-based filtering, timestamps,
 * and color support for development environments.
 * 
 * @module utils/logger
 */

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
    const defaultPrefix = process.env.LOG_PREFIX || '[ReactAzureConfig]';
    
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || defaultLevel,
      prefix: defaultPrefix,
      enableTimestamp: process.env.NODE_ENV === 'production',
      enableColors: process.env.NODE_ENV !== 'production',
      ...config
    };
  }
  
  private getDefaultLogLevel(): LogLevel {
    if (process.env.NODE_ENV === 'production') return 'warn';
    if (process.env.NODE_ENV === 'test') return 'silent';
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