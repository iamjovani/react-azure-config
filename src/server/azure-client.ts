/**
 * Azure Configuration Client
 * 
 * Provides Azure App Configuration integration with Key Vault reference resolution,
 * configurable refresh strategies, and multi-source configuration loading.
 * 
 * @module azure-client
 */

// External dependencies
import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import type { TokenCredential } from '@azure/core-auth';

// Internal modules
import { ConfigurationCache } from '../cache';
import { LocalConfigurationProvider } from '../local-config';
import { logger } from '../utils/logger';
import { setNestedProperty, getDefaultConfiguration, delay, isKeyVaultReference } from '../utils/config-utils';
import { handleError, ErrorType } from '../utils/error-handler';
import { DEFAULT_CONSTANTS, CONFIG_SOURCES, AUTH_TYPES, REFRESH_STRATEGIES } from '../constants';
import type { AzureConfigOptions, ConfigurationValue, KeyVaultConfig } from '../types';

export class AzureConfigurationClient {
  private client: AppConfigurationClient | null = null;
  private cache: ConfigurationCache;
  private options: AzureConfigOptions;
  private localProvider: LocalConfigurationProvider | null = null;
  private retryCount = 0;
  private maxRetries = DEFAULT_CONSTANTS.MAX_RETRIES;
  private keyVaultClients = new Map<string, SecretClient>();
  private keyVaultConfig: KeyVaultConfig;
  private credential: TokenCredential | null = null;
  private configurationLoaded = false;
  private lastConfigLoad: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(options: AzureConfigOptions) {
    this.options = {
      application: DEFAULT_CONSTANTS.DEFAULT_APPLICATION,
      enableLocalFallback: true,
      sources: [CONFIG_SOURCES.AZURE, CONFIG_SOURCES.ENVIRONMENT, CONFIG_SOURCES.LOCAL, CONFIG_SOURCES.DEFAULTS],
      precedence: 'first-wins',
      logLevel: 'warn',
      ...options
    };
    
    if (options.logLevel) {
      logger.setLevel(options.logLevel);
    }
    
    this.cache = new ConfigurationCache({
      ttl: DEFAULT_CONSTANTS.DEFAULT_CACHE_TTL,
      maxSize: DEFAULT_CONSTANTS.DEFAULT_CACHE_SIZE,
      storage: ['memory', 'localStorage'],
      refreshStrategy: REFRESH_STRATEGIES.ON_DEMAND,
      ...options.cache
    });
    
    this.keyVaultConfig = {
      enableKeyVaultReferences: true,
      secretCacheTtl: DEFAULT_CONSTANTS.KV_SECRET_CACHE_TTL,
      maxRetries: DEFAULT_CONSTANTS.MAX_RETRIES,
      retryDelayMs: DEFAULT_CONSTANTS.RETRY_DELAY_MS,
      refreshStrategy: REFRESH_STRATEGIES.ON_DEMAND,
      ...options.keyVault
    };
    
    if (this.options.environment === 'local') {
      this.localProvider = new LocalConfigurationProvider();
    } else if (this.options.endpoint) {
      this.initializeAzureClient();
    }
    
    this.setupPeriodicRefresh();
  }

  private initializeAzureClient(): void {
    try {
      this.credential = this.createCredential();
      this.client = new AppConfigurationClient(this.options.endpoint!, this.credential);
      logger.debug('Azure App Configuration client initialized');
    } catch (error) {
      const configError = handleError(error, ErrorType.AZURE_CLIENT_ERROR, {
        endpoint: this.options.endpoint,
        environment: this.options.environment
      });
      
      if (this.options.enableLocalFallback) {
        logger.info('Falling back to local configuration');
        this.localProvider = new LocalConfigurationProvider();
      } else {
        throw configError;
      }
    }
  }

  private createCredential(): TokenCredential {
    const auth = this.options.authentication;
    
    if (auth?.type === AUTH_TYPES.SERVICE_PRINCIPAL) {
      if (!auth.tenantId || !auth.clientId || !auth.clientSecret) {
        throw handleError(
          'Service Principal authentication requires tenantId, clientId, and clientSecret',
          ErrorType.VALIDATION_ERROR,
          { authType: auth.type }
        );
      }
      
      logger.debug(`Using Service Principal authentication for tenant: ${auth.tenantId}`);
      return new ClientSecretCredential(auth.tenantId, auth.clientId, auth.clientSecret);
    }
    
    if (auth?.type === AUTH_TYPES.MANAGED_IDENTITY) {
      logger.debug('Using Managed Identity authentication');
      const options = auth.clientId ? { managedIdentityClientId: auth.clientId } : undefined;
      return new DefaultAzureCredential(options);
    }
    
    if (auth?.type === AUTH_TYPES.AZURE_CLI) {
      logger.debug('Using Azure CLI authentication');
      return new DefaultAzureCredential();
    }
    
    logger.debug('Using DefaultAzureCredential');
    return new DefaultAzureCredential();
  }

  async getConfiguration(): Promise<ConfigurationValue> {
    const cacheKey = `config:${this.options.environment}:${this.options.application}`;
    const refreshStrategy = this.cache.getConfig().refreshStrategy || 'on-demand';
    
    if (refreshStrategy === 'load-once' && this.configurationLoaded) {
      const cached = this.cache.get<ConfigurationValue>(cacheKey);
      if (cached) {
        logger.debug('Using cached configuration (load-once strategy)');
        return cached;
      }
    }
    
    const cached = this.cache.get<ConfigurationValue>(cacheKey);
    if (cached && refreshStrategy !== 'load-once') {
      return cached;
    }

    const sources = this.options.sources || ['azure', 'environment', 'local', 'defaults'];
    
    for (const source of sources) {
      try {
        const config = await this.loadFromSource(source);
        if (config && Object.keys(config).length > 0) {
          this.cache.set(cacheKey, config, source);
          this.configurationLoaded = true;
          this.lastConfigLoad = Date.now();
          logger.debug(`Configuration loaded from ${source}`);
          return config;
        }
      } catch (error) {
        logger.warn(`Failed to load from ${source}:`, error);
        
        if (source === 'azure' && this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.debug(`Retrying Azure load (${this.retryCount}/${this.maxRetries})`);
          await delay(Math.pow(2, this.retryCount) * DEFAULT_CONSTANTS.RETRY_DELAY_MS);
          
          try {
            const retryConfig = await this.loadFromSource(source);
            if (retryConfig && Object.keys(retryConfig).length > 0) {
              this.cache.set(cacheKey, retryConfig, source);
              this.configurationLoaded = true;
              this.lastConfigLoad = Date.now();
              this.retryCount = 0;
              return retryConfig;
            }
          } catch (retryError) {
            handleError(retryError, ErrorType.CONFIGURATION_ERROR, {
              source,
              retryAttempt: this.retryCount,
              maxRetries: this.maxRetries
            }, 'warn');
          }
        }
        
        continue;
      }
    }

    throw handleError(
      `Failed to load configuration from all sources: ${sources.join(', ')}`,
      ErrorType.CONFIGURATION_ERROR,
      { sources, environment: this.options.environment }
    );
  }

  private async loadFromSource(source: string): Promise<ConfigurationValue> {
    switch (source) {
      case 'azure':
        return await this.loadFromAzure();
        
      case 'environment':
      case 'local':
        if (!this.localProvider) {
          this.localProvider = new LocalConfigurationProvider();
        }
        return this.localProvider.getConfiguration();
        
      case CONFIG_SOURCES.DEFAULTS:
        return getDefaultConfiguration(this.options.environment);
        
      default:
        throw handleError(
          `Unknown configuration source: ${source}`,
          ErrorType.VALIDATION_ERROR,
          { source, availableSources: Object.values(CONFIG_SOURCES) }
        );
    }
  }

  private async loadFromAzure(): Promise<ConfigurationValue> {
    if (!this.client) {
      throw handleError(
        'Azure client not initialized',
        ErrorType.AZURE_CLIENT_ERROR,
        { endpoint: this.options.endpoint }
      );
    }

    const config: ConfigurationValue = {};
    const keyFilter = this.options.application ? `${this.options.application}:*` : undefined;
    const labelFilter = this.options.label || (this.options.environment === 'local' ? '\0' : this.options.environment);

    try {
      logger.debug(`Loading from Azure - App: ${keyFilter}, Label: ${labelFilter}`);
      
      const options: any = { labelFilter };
      if (keyFilter) {
        options.keyFilter = keyFilter;
      }
      const settingsIterator = this.client.listConfigurationSettings(options);

      let settingsCount = 0;
      for await (const setting of settingsIterator) {
        if (setting.key && setting.value !== undefined) {
          const key = this.options.application 
            ? setting.key.replace(`${this.options.application}:`, '')
            : setting.key;
          
          let resolvedValue = setting.value;
          if (this.keyVaultConfig.enableKeyVaultReferences && isKeyVaultReference(setting.value)) {
            try {
              resolvedValue = await this.resolveKeyVaultReference(setting.value) || setting.value;
            } catch (error) {
              logger.warn(`Failed to resolve Key Vault reference for "${key}":`, error);
              resolvedValue = setting.value;
            }
          }
          
          setNestedProperty(config, key, resolvedValue);
          settingsCount++;
        }
      }

      logger.debug(`Loaded ${settingsCount} settings from Azure`);
      return config;
    } catch (error) {
      logger.error('Error loading from Azure:', error);
      throw error;
    }
  }




  async getValue<T = unknown>(key: string): Promise<T | undefined> {
    const config = await this.getConfiguration();
    const keys = key.split('.');
    let current: unknown = config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && current !== null && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    
    return current as T;
  }

  async refreshConfiguration(force: boolean = false): Promise<void> {
    const refreshStrategy = this.cache.getConfig().refreshStrategy || 'on-demand';
    
    if (!force && refreshStrategy === 'load-once') {
      logger.debug('Refresh ignored - using load-once strategy');
      return;
    }
    
    this.cache.clear();
    this.retryCount = 0;
    this.configurationLoaded = false;
    await this.getConfiguration();
  }

  getEnvironment(): string {
    return this.options.environment;
  }

  getCacheStats() {
    return this.cache.getStats();
  }




  // Key Vault reference detection and resolution methods
  private parseKeyVaultReference(uri: string): { vaultUrl?: string; secretName?: string; secretVersion?: string } {
    try {
      const url = new URL(uri);
      const pathParts = url.pathname.split('/');
      
      if (pathParts.length < 3 || pathParts[1] !== 'secrets') {
        return {};
      }
      
      return {
        vaultUrl: `${url.protocol}//${url.hostname}`,
        secretName: pathParts[2],
        secretVersion: pathParts[3]
      };
    } catch {
      return {};
    }
  }

  private async resolveKeyVaultReference(keyVaultRef: string): Promise<string | null> {
    try {
      const ref = JSON.parse(keyVaultRef) as { uri?: string };
      if (!ref.uri) return null;

      const { vaultUrl, secretName, secretVersion } = this.parseKeyVaultReference(ref.uri);
      if (!vaultUrl || !secretName) {
        logger.warn('Invalid Key Vault reference format:', keyVaultRef);
        return null;
      }

      const client = this.getKeyVaultClient(vaultUrl);
      if (!client) return null;

      const cacheKey = `keyvault:${vaultUrl}:${secretName}:${secretVersion || 'latest'}`;
      const kvRefreshStrategy = this.keyVaultConfig.refreshStrategy || 'on-demand';
      
      const cachedSecret = this.cache.get<string>(cacheKey);
      if (cachedSecret) {
        if (kvRefreshStrategy === 'load-once') {
          logger.debug(`Using cached Key Vault secret: ${secretName}`);
          return cachedSecret;
        }
        return cachedSecret;
      }

      const secret = await this.fetchSecretWithRetry(client, secretName, secretVersion);
      
      if (secret) {
        this.cache.set(cacheKey, secret, 'keyvault');
        logger.debug(`Resolved Key Vault secret: ${secretName}`);
      }

      return secret;
    } catch (error) {
      logger.error('Error resolving Key Vault reference:', error);
      return null;
    }
  }

  private getKeyVaultClient(vaultUrl: string): SecretClient | null {
    if (!this.credential) {
      logger.error('No credential available for Key Vault access');
      return null;
    }

    if (this.keyVaultClients.has(vaultUrl)) {
      return this.keyVaultClients.get(vaultUrl)!;
    }

    try {
      const client = new SecretClient(vaultUrl, this.credential);
      this.keyVaultClients.set(vaultUrl, client);
      logger.debug(`Created Key Vault client for: ${vaultUrl}`);
      return client;
    } catch (error) {
      logger.error(`Failed to create Key Vault client for ${vaultUrl}:`, error);
      return null;
    }
  }

  private async fetchSecretWithRetry(
    client: SecretClient, 
    secretName: string, 
    version?: string
  ): Promise<string | null> {
    const maxRetries = this.keyVaultConfig.maxRetries || DEFAULT_CONSTANTS.MAX_RETRIES;
    const retryDelay = this.keyVaultConfig.retryDelayMs || DEFAULT_CONSTANTS.RETRY_DELAY_MS;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const secret = version 
          ? await client.getSecret(secretName, { version })
          : await client.getSecret(secretName);
        
        return secret.value || null;
      } catch (error: any) {
        if (attempt === maxRetries) {
          if (error.code === 'Forbidden' || error.statusCode === 403) {
            logger.error(`Access denied to Key Vault secret "${secretName}"`);
          } else if (error.code === 'SecretNotFound' || error.statusCode === 404) {
            logger.error(`Key Vault secret "${secretName}" not found`);
          } else {
            logger.error(`Error fetching Key Vault secret "${secretName}":`, error);
          }
          throw error;
        }

        logger.debug(`Key Vault access attempt ${attempt + 1} failed, retrying...`);
        await delay(retryDelay * Math.pow(2, attempt));
      }
    }

    return null;
  }

  // Setup periodic refresh based on configuration
  private setupPeriodicRefresh(): void {
    const cacheConfig = this.cache.getConfig();
    const refreshStrategy = cacheConfig.refreshStrategy || 'on-demand';
    
    if (refreshStrategy === 'periodic') {
      const interval = cacheConfig.refreshInterval || 60 * 60 * 1000;
      
      logger.debug(`Setting up periodic refresh every ${interval}ms`);
      this.refreshTimer = setInterval(async () => {
        try {
          logger.debug('Performing periodic configuration refresh');
          await this.refreshConfiguration();
        } catch (error) {
          logger.error('Periodic refresh failed:', error);
        }
      }, interval);
    }
    
    const kvRefreshStrategy = this.keyVaultConfig.refreshStrategy || 'on-demand';
    if (kvRefreshStrategy === 'periodic' && kvRefreshStrategy !== refreshStrategy) {
      const kvInterval = this.keyVaultConfig.refreshInterval || 30 * 60 * 1000;
      
      logger.debug(`Setting up periodic Key Vault refresh every ${kvInterval}ms`);
      setInterval(async () => {
        try {
          logger.debug('Performing periodic Key Vault cache refresh');
          this.clearKeyVaultCache();
        } catch (error) {
          logger.error('Periodic Key Vault refresh failed:', error);
        }
      }, kvInterval);
    }
  }

  private clearKeyVaultCache(): void {
    const cacheKeys = this.cache.getAllKeys().filter(key => key.startsWith('keyvault:'));
    cacheKeys.forEach(key => this.cache.delete(key));
    logger.debug(`Cleared ${cacheKeys.length} Key Vault cache entries`);
  }



}