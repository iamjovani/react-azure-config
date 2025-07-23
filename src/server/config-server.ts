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
import { getDefaultConfiguration, getNestedProperty } from '../utils/config-utils';
import { logger } from '../utils/logger';
import { DEFAULT_CONSTANTS, CONFIG_SOURCES } from '../constants';
import type { AzureConfigOptions, ConfigurationValue, ConfigApiResponse } from '../types';

export interface ConfigServerOptions extends AzureConfigOptions {
  port?: number;
  corsOrigin?: string | string[];
  sources?: string[];
  enableHealthCheck?: boolean;
}

export class ConfigurationServer {
  private app: express.Application;
  private server: import('http').Server | null = null;
  private azureClient: AzureConfigurationClient | null = null;
  private localProvider: LocalConfigurationProvider | null = null;
  private options: ConfigServerOptions;
  private isRunning = false;

  constructor(options: ConfigServerOptions) {
    this.options = {
      port: DEFAULT_CONSTANTS.CONFIG_SERVER_PORT,
      corsOrigin: DEFAULT_CONSTANTS.DEFAULT_CORS_ORIGINS,
      sources: [CONFIG_SOURCES.AZURE, CONFIG_SOURCES.ENVIRONMENT, CONFIG_SOURCES.LOCAL, CONFIG_SOURCES.DEFAULTS],
      enableHealthCheck: true,
      ...options
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeClients();
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
    this.app.get('/config', async (req, res) => {
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

    this.app.post('/refresh', async (req, res) => {
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

    if (this.options.enableHealthCheck) {
      this.app.get('/health', async (req, res) => {
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
    this.app.get('/info', (req, res) => {
      res.json({
        sources: this.options.sources,
        activeSource: this.getActiveSource(),
        environment: this.options.environment,
        port: this.options.port,
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

  private async getConfiguration(): Promise<ConfigurationValue> {
    const sources = this.options.sources || ['local'];
    
    for (const source of sources) {
      try {
        switch (source) {
          case CONFIG_SOURCES.AZURE:
            if (this.azureClient) {
              const config = await this.azureClient.getConfiguration();
              if (config && Object.keys(config).length > 0) {
                return config;
              }
            }
            break;
            
          case CONFIG_SOURCES.ENVIRONMENT:
          case CONFIG_SOURCES.LOCAL:
            if (this.localProvider) {
              const config = this.localProvider.getConfiguration();
              if (config && Object.keys(config).length > 0) {
                return config;
              }
            }
            break;
            
          case CONFIG_SOURCES.DEFAULTS:
            return getDefaultConfiguration(this.options.environment);
        }
      } catch (error) {
        logger.warn(`Failed to load configuration from ${source}:`, error);
        continue;
      }
    }

    return getDefaultConfiguration(this.options.environment);
  }

  private async getConfigValue(key: string): Promise<any> {
    const config = await this.getConfiguration();
    return getNestedProperty(config, key);
  }

  private async refreshConfiguration(): Promise<void> {
    if (this.azureClient) {
      await this.azureClient.refreshConfiguration();
    }
    
    if (this.localProvider) {
      // Reinitialize local provider to pick up changes
      this.localProvider = new LocalConfigurationProvider();
    }
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
      timestamp: Date.now()
    };

    if (this.azureClient) {
      try {
        await this.azureClient.getConfiguration();
        health.checks.azure = 'healthy';
      } catch (error) {
        health.checks.azure = 'unhealthy';
        health.status = 'degraded';
      }
    }

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
        logger.info(`  POST http://localhost:${this.options.port}/refresh`);
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
}

// Factory function for easy instantiation
export const createConfigServer = (options: ConfigServerOptions): ConfigurationServer => {
  return new ConfigurationServer(options);
};