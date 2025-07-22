/**
 * Local Configuration Provider
 * 
 * Handles local configuration loading from environment variables, process.env,
 * and browser environments with automatic transformation and caching.
 * 
 * @module local-config
 */

// Internal modules
import type { ConfigurationValue } from './types';
import { logger } from './utils/logger';
import { setNestedProperty, getDefaultConfiguration, getDefaultBrowserConfiguration, transformEnvKeyToConfigPath, parseValue } from './utils/config-utils';
import { DEFAULT_CONSTANTS } from './constants';

export class LocalConfigurationProvider {
  private config: ConfigurationValue = {};
  private lastLoaded: number = 0;
  private cacheTtl: number = DEFAULT_CONSTANTS.LOCAL_CONFIG_TTL;

  constructor() {
    this.loadLocalConfig();
  }

  private loadLocalConfig(): void {
    const now = Date.now();
    
    if (now - this.lastLoaded < this.cacheTtl && Object.keys(this.config).length > 0) {
      return;
    }

    this.config = this.detectAndLoadConfiguration();

    this.lastLoaded = now;
  }

  private detectAndLoadConfiguration(): ConfigurationValue {
    if (this.isNodeEnvironment()) {
      const config = this.transformEnvToConfig(process.env);
      logger.debug('Loaded configuration from process.env');
      return config;
    }
    
    if (this.isBrowserEnvironment()) {
      const windowAny = window as any;
      
      if (windowAny.ENV) {
        logger.debug('Loaded configuration from window.ENV');
        return windowAny.ENV;
      }
      
      if (windowAny.process?.env) {
        const config = this.transformEnvToConfig(windowAny.process.env);
        logger.debug('Loaded configuration from window.process.env');
        return config;
      }
      
      logger.debug('No local configuration source found in browser');
      return getDefaultBrowserConfiguration();
    }
    
    logger.debug('No local configuration source found');
    return getDefaultConfiguration();
  }

  private isNodeEnvironment(): boolean {
    return typeof process !== 'undefined' && !!process.env;
  }

  private isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined';
  }

  private transformEnvToConfig(env: NodeJS.ProcessEnv | Record<string, unknown>): ConfigurationValue {
    const config: ConfigurationValue = {};
    
    Object.entries(env).forEach(([key, value]) => {
      if (key.startsWith(DEFAULT_CONSTANTS.ENV_VAR_PREFIX)) {
        const configKey = transformEnvKeyToConfigPath(key);
        setNestedProperty(config, configKey, parseValue(value));
      }
      else if (['NODE_ENV', 'ENVIRONMENT', 'ENV'].includes(key)) {
        config.environment = value;
      }
      else if (key.startsWith('AZURE_')) {
        const azureKey = key.toLowerCase().replace('azure_', '');
        if (!config.azure) config.azure = {};
        (config.azure as Record<string, unknown>)[azureKey] = value;
      }
    });

    if (!config.environment) {
      config.environment = (env as Record<string, unknown>).NODE_ENV || 'local';
    }

    return config;
  }






  getConfiguration(): ConfigurationValue {
    this.loadLocalConfig();
    return { ...this.config }; // Return a copy to prevent mutations
  }

  getValue<T = unknown>(key: string): T | undefined {
    this.loadLocalConfig();
    
    const keys = key.split('.');
    let current: unknown = this.config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && current !== null && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    
    return current as T;
  }




}