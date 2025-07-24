/**
 * Configuration Server
 * 
 * Embedded Express server providing REST API endpoints for configuration access,
 * health checks, and configuration refresh with CORS support.
 * 
 * @module config-server
 */

// External dependencies
import express from 'express';
import cors from 'cors';

// Internal modules
import { AzureConfigurationClient } from './azure-client';
import { LocalConfigurationProvider } from '../local-config';
import { AppScopedConfigurationProvider } from '../app-scoped-config';
import { ConfigurationCache } from '../cache';
import { getDefaultConfiguration, getNestedProperty } from '../utils/config-utils';
import { logger } from '../utils/logger';
import { DEFAULT_CONSTANTS, CONFIG_SOURCES } from '../constants';
import type { AzureConfigOptions, ConfigurationValue, ConfigApiResponse } from '../types';

export interface ConfigServerOptions extends AzureConfigOptions {
  port?: number;
  corsOrigin?: string | string[];
  sources?: string[];
  enableHealthCheck?: boolean;
  enableCaching?: boolean;
  cacheTtl?: number;
  envVarPrefix?: string;
}

export class ConfigurationServer {
  private app: express.Application;
  private server: import('http').Server | null = null;
  private azureClient: AzureConfigurationClient | null = null;
  private localProvider: LocalConfigurationProvider | null = null;
  private appScopedProvider: AppScopedConfigurationProvider;
  private cache: ConfigurationCache | null = null;
  private options: ConfigServerOptions;
  private isRunning = false;

  constructor(options: ConfigServerOptions) {
    this.options = {
      port: DEFAULT_CONSTANTS.CONFIG_SERVER_PORT,
      corsOrigin: DEFAULT_CONSTANTS.DEFAULT_CORS_ORIGINS,
      sources: [CONFIG_SOURCES.AZURE, CONFIG_SOURCES.ENVIRONMENT, CONFIG_SOURCES.LOCAL, CONFIG_SOURCES.DEFAULTS],
      enableHealthCheck: true,
      enableCaching: true,
      cacheTtl: DEFAULT_CONSTANTS.MEMORY_CACHE_TTL,
      ...options
    };

    this.app = express();
    this.appScopedProvider = new AppScopedConfigurationProvider();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeClients();
    this.initializeCache();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: this.options.corsOrigin,
      credentials: true
    }));
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // App-specific configuration endpoints (must come before generic /config/:key route)
    this.app.get('/config/:appId([a-zA-Z0-9][a-zA-Z0-9-_]*)', async (req, res) => {
      try {
        const { appId } = req.params;
        const config = await this.appScopedProvider.getAppConfiguration(appId);
        const response: ConfigApiResponse<ConfigurationValue> = {
          success: true,
          data: config,
          source: 'app-scoped',
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`App config endpoint error for app "${req.params.appId}":`, error);
        const errorResponse: ConfigApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        };
        res.status(500).json(errorResponse);
      }
    });

    this.app.get('/config/:appId([a-zA-Z0-9][a-zA-Z0-9-_]*)/:key(*)', async (req, res) => {
      try {
        const { appId, key } = req.params;
        const value = await this.appScopedProvider.getAppConfigValue(appId, key);
        
        const response: ConfigApiResponse<unknown> = {
          success: true,
          data: value,
          key,
          source: 'app-scoped',
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`App config value error for app "${req.params.appId}" and key "${req.params.key}":`, error);
        const errorResponse: ConfigApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          key: req.params.key,
          timestamp: Date.now()
        };
        res.status(500).json(errorResponse);
      }
    });

    // Default configuration endpoint (backward compatibility)
    this.app.get('/config', async (_req, res) => {
      try {
        const config = await this.getConfiguration();
        const response: ConfigApiResponse<ConfigurationValue> = {
          success: true,
          data: config,
          source: this.getActiveSource(),
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error('Config endpoint error:', error);
        const errorResponse: ConfigApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        };
        res.status(500).json(errorResponse);
      }
    });

    this.app.get('/config/:key(*)', async (req, res) => {
      try {
        const { key } = req.params;
        const value = await this.getConfigValue(key);
        
        const response: ConfigApiResponse<unknown> = {
          success: true,
          data: value,
          key,
          source: this.getActiveSource(),
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`Config value error for key "${req.params.key}":`, error);
        const errorResponse: ConfigApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          key: req.params.key,
          timestamp: Date.now()
        };
        res.status(500).json(errorResponse);
      }
    });

    // Refresh endpoints
    this.app.post('/refresh', async (_req, res) => {
      try {
        await this.refreshConfiguration();
        const response: ConfigApiResponse<{ message: string }> = {
          success: true,
          data: { message: 'Configuration cache refreshed' },
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error('Refresh endpoint error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    this.app.post('/refresh/:appId([a-zA-Z0-9][a-zA-Z0-9-_]*)', async (req, res) => {
      try {
        const { appId } = req.params;
        this.appScopedProvider.refreshAppConfiguration(appId);
        const response: ConfigApiResponse<{ message: string }> = {
          success: true,
          data: { message: `Configuration cache refreshed for app: ${appId}` },
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`Refresh endpoint error for app "${req.params.appId}":`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Apps endpoint - list available apps
    this.app.get('/apps', (_req, res) => {
      try {
        const availableApps = this.appScopedProvider.getAvailableApps();
        const response: ConfigApiResponse<string[]> = {
          success: true,
          data: availableApps,
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error('Apps endpoint error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    // Diagnostic endpoints for debugging
    this.app.get('/config-sources/:appId([a-zA-Z0-9][a-zA-Z0-9-_]*)', async (req, res) => {
      try {
        const { appId } = req.params;
        const sourceInfo = await this.getConfigurationSources(appId);
        const response: ConfigApiResponse<any> = {
          success: true,
          data: sourceInfo,
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`Config sources endpoint error for app "${req.params.appId}":`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    this.app.get('/config-debug/:appId([a-zA-Z0-9][a-zA-Z0-9-_]*)', async (req, res) => {
      try {
        const { appId } = req.params;
        const debugInfo = await this.getConfigurationDebugInfo(appId);
        const response: ConfigApiResponse<any> = {
          success: true,
          data: debugInfo,
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error(`Config debug endpoint error for app "${req.params.appId}":`, error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    this.app.get('/apps/discovered', (_req, res) => {
      try {
        const discoveryInfo = this.getAppDiscoveryInfo();
        const response: ConfigApiResponse<any> = {
          success: true,
          data: discoveryInfo,
          timestamp: Date.now()
        };
        res.json(response);
      } catch (error) {
        logger.error('App discovery endpoint error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });

    if (this.options.enableHealthCheck) {
      this.app.get('/health', async (_req, res) => {
        try {
          const health = await this.getHealthStatus();
          const statusCode = health.status === 'healthy' ? 200 : 503;
          res.status(statusCode).json(health);
        } catch (error) {
          res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          });
        }
      });
    }

    // Info endpoint - shows active sources and configuration
    this.app.get('/info', (_req, res) => {
      res.json({
        sources: this.options.sources,
        activeSource: this.getActiveSource(),
        environment: this.options.environment,
        port: this.options.port,
        availableApps: this.appScopedProvider.getAvailableApps(),
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });
  }

  private initializeClients(): void {
    if (this.options.sources?.includes('azure') && this.options.endpoint) {
      try {
        this.azureClient = new AzureConfigurationClient(this.options);
      } catch (error) {
        logger.warn('Failed to initialize Azure client:', error);
      }
    }

    if (this.options.sources?.includes('local') || this.options.sources?.includes('environment')) {
      this.localProvider = new LocalConfigurationProvider();
    }
  }

  private initializeCache(): void {
    if (this.options.enableCaching) {
      this.cache = new ConfigurationCache({
        ttl: this.options.cacheTtl || DEFAULT_CONSTANTS.MEMORY_CACHE_TTL,
        storage: ['memory'] // Server-side caching uses memory only
      });
      logger.info('Configuration caching enabled', { ttl: this.options.cacheTtl });
    }
  }

  private async getConfiguration(): Promise<ConfigurationValue> {
    const cacheKey = 'full-configuration';
    
    // Try cache first
    if (this.cache) {
      const cached = this.cache.get<ConfigurationValue>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const sources = this.options.sources || ['local'];
    
    for (const source of sources) {
      try {
        switch (source) {
          case CONFIG_SOURCES.AZURE:
            if (this.azureClient) {
              const config = await this.azureClient.getConfiguration();
              if (config && Object.keys(config).length > 0) {
                // Cache the result
                if (this.cache) {
                  this.cache.set(cacheKey, config);
                }
                return config;
              }
            }
            break;
            
          case CONFIG_SOURCES.ENVIRONMENT:
          case CONFIG_SOURCES.LOCAL:
            if (this.localProvider) {
              const config = this.localProvider.getConfiguration();
              if (config && Object.keys(config).length > 0) {
                // Cache the result
                if (this.cache) {
                  this.cache.set(cacheKey, config);
                }
                return config;
              }
            }
            break;
            
          case CONFIG_SOURCES.DEFAULTS:
            const defaultConfig = getDefaultConfiguration(this.options.environment);
            // Cache the result
            if (this.cache) {
              this.cache.set(cacheKey, defaultConfig);
            }
            return defaultConfig;
        }
      } catch (error) {
        logger.warn(`Failed to load configuration from ${source}:`, error);
        continue;
      }
    }

    const fallbackConfig = getDefaultConfiguration(this.options.environment);
    // Cache the fallback result
    if (this.cache) {
      this.cache.set(cacheKey, fallbackConfig);
    }
    return fallbackConfig;
  }

  private async getConfigValue(key: string): Promise<any> {
    const cacheKey = `config-value:${key}`;
    
    // Try cache first
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const config = await this.getConfiguration();
    const value = getNestedProperty(config, key);
    
    // Cache the individual value
    if (this.cache) {
      this.cache.set(cacheKey, value);
    }
    
    return value;
  }

  private async refreshConfiguration(): Promise<void> {
    // Clear cache first
    if (this.cache) {
      this.cache.clear();
      logger.info('Configuration cache cleared');
    }

    if (this.azureClient) {
      await this.azureClient.refreshConfiguration();
    }
    
    if (this.localProvider) {
      // Reinitialize local provider to pick up changes
      this.localProvider = new LocalConfigurationProvider();
    }

    // Refresh all app configurations
    this.appScopedProvider.refreshAllConfigurations();
    
    logger.info('Configuration refreshed from all sources and all apps');
  }

  private getActiveSource(): string {
    // Simple heuristic to determine which source is likely active
    if (this.options.environment === DEFAULT_CONSTANTS.DEFAULT_ENVIRONMENT) return CONFIG_SOURCES.LOCAL;
    if (this.azureClient && this.options.endpoint) return CONFIG_SOURCES.AZURE;
    return CONFIG_SOURCES.ENVIRONMENT;
  }

  private async getHealthStatus(): Promise<any> {
    const health: any = {
      status: 'healthy',
      checks: {},
      cache: {
        enabled: !!this.cache,
        size: 0
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };

    // Check cache health
    if (this.cache) {
      try {
        // Test cache functionality
        const testKey = '_health_check_test';
        this.cache.set(testKey, 'test');
        const testValue = this.cache.get(testKey);
        health.checks.cache = testValue === 'test' ? 'healthy' : 'unhealthy';
        // Get cache info (size is not publicly available)
      } catch (error) {
        health.checks.cache = 'unhealthy';
        health.status = 'degraded';
      }
    }

    // Check Azure client
    if (this.azureClient) {
      try {
        await this.azureClient.getConfiguration();
        health.checks.azure = 'healthy';
      } catch (error) {
        health.checks.azure = 'unhealthy';
        health.status = 'degraded';
      }
    }

    // Check local provider
    if (this.localProvider) {
      try {
        const localConfig = this.localProvider.getConfiguration();
        health.checks.local = Object.keys(localConfig).length > 0 ? 'healthy' : 'empty';
      } catch (error) {
        health.checks.local = 'unhealthy';
        health.status = 'degraded';
      }
    }

    return health;
  }

  /**
   * Get configuration sources information for debugging
   */
  private async getConfigurationSources(appId: string): Promise<any> {
    try {
      const azureInfo = this.appScopedProvider.getAzureConfigInfo(appId);
      
      return {
        appId,
        precedenceChain: [
          {
            priority: 5,
            source: 'azure',
            description: 'Azure App Configuration',
            configured: !!azureInfo.endpoint,
            endpoint: azureInfo.endpoint,
            hasClient: azureInfo.hasClient,
            authentication: azureInfo.authentication
          },
          {
            priority: 4,
            source: 'app-env-vars',
            description: `App-specific environment variables (${this.options.envVarPrefix || 'REACT_APP'}_${appId.toUpperCase().replace(/-/g, '_')}_*)`,
            configured: this.hasAppSpecificEnvVars(appId),
            variables: this.getAppSpecificEnvVarNames(appId)
          },
          {
            priority: 3,
            source: 'generic-env-vars',
            description: `Generic environment variables (${this.options.envVarPrefix || 'REACT_APP'}_*)`,
            configured: this.hasGenericEnvVars(),
            variables: this.getGenericEnvVarNames()
          },
          {
            priority: 2,
            source: 'app-env-file',
            description: `App-specific .env file (apps/${appId}/.env)`,
            configured: this.hasAppEnvFile(appId),
            filePath: `apps/${appId}/.env`
          },
          {
            priority: 1,
            source: 'root-env-file',
            description: 'Root .env file (.env)',
            configured: this.hasRootEnvFile(),
            filePath: '.env'
          }
        ],
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to get configuration sources for app "${appId}":`, error);
      throw error;
    }
  }

  /**
   * Get detailed configuration debug information
   */
  private async getConfigurationDebugInfo(appId: string): Promise<any> {
    try {
      // This would ideally show each config value and its source
      // For now, we'll show the overall configuration and source info
      const config = await this.appScopedProvider.getAppConfiguration(appId);
      const sourceInfo = await this.getConfigurationSources(appId);
      
      return {
        appId,
        configuration: config,
        sources: sourceInfo.precedenceChain,
        configurationKeys: Object.keys(config),
        keyCount: Object.keys(config).length,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to get debug info for app "${appId}":`, error);
      throw error;
    }
  }

  /**
   * Get app discovery information
   */
  private getAppDiscoveryInfo(): any {
    const filesystemApps = this.getFilesystemApps();
    const environmentApps = this.getEnvironmentDiscoveredApps();
    const allApps = this.appScopedProvider.getAvailableApps();
    
    return {
      discoveryMethods: {
        filesystem: {
          description: 'Apps discovered from filesystem (apps/ directory)',
          apps: filesystemApps,
          count: filesystemApps.length
        },
        environment: {
          description: 'Apps discovered from environment variables pattern',
          apps: environmentApps,
          count: environmentApps.length,
          pattern: `${this.options.envVarPrefix || 'REACT_APP'}_{APP_ID}_{VAR}`
        }
      },
      combined: {
        description: 'All discovered apps (deduplicated)',
        apps: allApps,
        count: allApps.length
      },
      timestamp: Date.now()
    };
  }

  // Helper methods for diagnostic endpoints
  private hasAppSpecificEnvVars(appId: string): boolean {
    const prefix = `${this.options.envVarPrefix || 'REACT_APP'}_${appId.toUpperCase().replace(/-/g, '_')}_`;
    return Object.keys(process.env).some(key => key.startsWith(prefix));
  }

  private getAppSpecificEnvVarNames(appId: string): string[] {
    const prefix = `${this.options.envVarPrefix || 'REACT_APP'}_${appId.toUpperCase().replace(/-/g, '_')}_`;
    return Object.keys(process.env).filter(key => key.startsWith(prefix));
  }

  private hasGenericEnvVars(): boolean {
    const prefix = `${this.options.envVarPrefix || 'REACT_APP'}_`;
    const appSpecificPattern = new RegExp(`^${this.options.envVarPrefix || 'REACT_APP'}_[A-Z0-9_]+_`);
    return Object.keys(process.env).some(key => 
      key.startsWith(prefix) && !appSpecificPattern.test(key)
    );
  }

  private getGenericEnvVarNames(): string[] {
    const prefix = `${this.options.envVarPrefix || 'REACT_APP'}_`;
    const appSpecificPattern = new RegExp(`^${this.options.envVarPrefix || 'REACT_APP'}_[A-Z0-9_]+_`);
    return Object.keys(process.env).filter(key => 
      key.startsWith(prefix) && !appSpecificPattern.test(key)
    );
  }

  private hasAppEnvFile(appId: string): boolean {
    const { existsSync } = require('fs');
    const { join } = require('path');
    return existsSync(join(process.cwd(), 'apps', appId, '.env'));
  }

  private hasRootEnvFile(): boolean {
    const { existsSync } = require('fs');
    const { join } = require('path');
    return existsSync(join(process.cwd(), '.env'));
  }

  private getFilesystemApps(): string[] {
    try {
      const { readdirSync, existsSync } = require('fs');
      const { join } = require('path');
      const appsDir = join(process.cwd(), 'apps');
      
      if (!existsSync(appsDir)) {
        return [];
      }

      return readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent: any) => dirent.isDirectory())
        .map((dirent: any) => dirent.name)
        .filter((name: string) => this.isValidAppId(name));
    } catch (error) {
      logger.warn('Failed to get filesystem apps:', error);
      return [];
    }
  }

  private getEnvironmentDiscoveredApps(): string[] {
    const appPattern = new RegExp(`^${this.options.envVarPrefix || 'REACT_APP'}_([A-Z0-9_]+)_(.+)$`);
    const discoveredApps = new Set<string>();
    
    Object.keys(process.env).forEach(key => {
      const match = key.match(appPattern);
      if (match) {
        const appId = match[1].toLowerCase().replace(/_/g, '-');
        if (this.isValidAppId(appId)) {
          discoveredApps.add(appId);
        }
      }
    });

    return Array.from(discoveredApps);
  }

  private isValidAppId(appId: string): boolean {
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
    return validPattern.test(appId) && !appId.includes('..') && !appId.includes('/');
  }


  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Configuration server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, () => {
        this.isRunning = true;
        logger.info(`Configuration server running on port ${this.options.port}`);
        logger.info(`Available endpoints:`);
        logger.info(`  GET  http://localhost:${this.options.port}/config`);
        logger.info(`  GET  http://localhost:${this.options.port}/config/:key`);
        logger.info(`  GET  http://localhost:${this.options.port}/config/:appId`);
        logger.info(`  GET  http://localhost:${this.options.port}/config/:appId/:key`);
        logger.info(`  POST http://localhost:${this.options.port}/refresh`);
        logger.info(`  POST http://localhost:${this.options.port}/refresh/:appId`);
        logger.info(`  GET  http://localhost:${this.options.port}/apps`);
        logger.info(`  GET  http://localhost:${this.options.port}/apps/discovered`);
        logger.info(`  GET  http://localhost:${this.options.port}/config-sources/:appId`);
        logger.info(`  GET  http://localhost:${this.options.port}/config-debug/:appId`);
        logger.info(`  GET  http://localhost:${this.options.port}/health`);
        logger.info(`  GET  http://localhost:${this.options.port}/info`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        logger.error('Configuration server error:', error);
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        logger.info('Configuration server stopped');
        resolve();
      });
    });
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public getPort(): number {
    return this.options.port || DEFAULT_CONSTANTS.CONFIG_SERVER_PORT;
  }

  /**
   * Get the Express application instance for testing purposes
   * @returns Express application instance
   */
  public getExpressApp(): express.Application {
    return this.app;
  }
}

// Factory function for easy instantiation
export const createConfigServer = (options: ConfigServerOptions): ConfigurationServer => {
  return new ConfigurationServer(options);
};