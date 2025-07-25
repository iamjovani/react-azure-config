/**
 * Debug script to investigate Azure precedence issue
 */

const { AppScopedConfigurationProvider } = require('./dist/server.cjs.js');

// Mock Azure client
class MockAzureConfigurationClient {
  constructor(options) {
    this.options = options;
  }

  async getConfiguration() {
    console.log('🔍 Mock Azure returning configuration:');
    const config = {
      'api.url': 'https://azure-admin-api.example.com',
      'database.url': 'postgres://azure:5432/azuredb',
      'log.level': 'warn',
      'okta.client.id': 'azure-okta-client-id'
    };
    console.log('   Raw Azure config:', JSON.stringify(config, null, 2));
    return config;
  }
}

async function debugPrecedence() {
  console.log('🐛 DEBUGGING AZURE PRECEDENCE ISSUE\n');
  
  // Set environment variables
  process.env.REACT_APP_ADMIN_API_URL = 'https://env-admin-api.example.com';
  process.env.REACT_APP_ADMIN_LOG_LEVEL = 'debug';
  process.env.OKTA_CLIENT_ID = 'env-okta-client-id';
  
  // Set Azure credentials
  process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN = 'https://test-appconfig.azconfig.io';
  process.env.AZURE_CLIENT_ID_ADMIN = 'test-client-id';
  process.env.AZURE_CLIENT_SECRET_ADMIN = 'test-client-secret';
  process.env.AZURE_CLIENT_TENANT_ID_ADMIN = 'test-tenant-id';
  
  const provider = new AppScopedConfigurationProvider();
  
  // Mock the Azure client
  provider.getOrCreateAzureClient = async function(appId) {
    if (appId === 'admin') {
      return new MockAzureConfigurationClient({ appId });
    }
    return null;
  };
  
  // Override the loadAppConfigurationWithPrecedence method to add debugging
  const originalMethod = provider.loadAppConfigurationWithPrecedence.bind(provider);
  provider.loadAppConfigurationWithPrecedence = async function(appId) {
    console.log(`\n🔍 Loading configuration with precedence for app: ${appId}`);
    
    const config = {};
    const sources = [];

    // Load each source manually to debug
    
    // 1. Root .env file (priority 1)
    console.log('\n📂 Loading root .env file...');
    const rootEnvConfig = await this.loadEnvFileConfigWithCache('.env');
    console.log('   Root env keys:', Object.keys(rootEnvConfig));
    sources.push({ type: 'root-env-file', data: rootEnvConfig, priority: 1 });
    
    // 2. App .env file (priority 2)
    console.log('\n📂 Loading app .env file...');
    const appEnvConfig = await this.loadEnvFileConfigWithCache(`apps/${appId}/.env`);
    console.log('   App env keys:', Object.keys(appEnvConfig));
    sources.push({ type: 'app-env-file', data: appEnvConfig, priority: 2 });
    
    // 3. Generic env vars (priority 3)
    console.log('\n🌐 Loading generic environment variables...');
    const genericEnvConfig = this.parseGenericEnvVarsWithCache();
    console.log('   Generic env keys:', Object.keys(genericEnvConfig));
    console.log('   Generic env sample:', JSON.stringify(Object.entries(genericEnvConfig).slice(0, 3), null, 2));
    sources.push({ type: 'generic-env-vars', data: genericEnvConfig, priority: 3 });
    
    // 4. App-specific env vars (priority 4)
    console.log('\n🎯 Loading app-specific environment variables...');
    const appEnvVarConfig = this.parseAppSpecificEnvVarsWithCache(appId);
    console.log('   App-specific env keys:', Object.keys(appEnvVarConfig));
    console.log('   App-specific env data:', JSON.stringify(appEnvVarConfig, null, 2));
    sources.push({ type: 'app-env-vars', data: appEnvVarConfig, priority: 4 });
    
    // 5. Direct process.env (priority 0)
    console.log('\n📋 Loading direct process.env...');
    const processEnvConfig = this.parseProcessEnvDirectly(appId);
    console.log('   Process env keys:', Object.keys(processEnvConfig));
    sources.push({ type: 'process-env-direct', data: processEnvConfig, priority: 0 });
    
    // 6. Azure config (priority 5)
    console.log('\n☁️  Loading Azure configuration...');
    const azureConfig = await this.loadAzureAppConfigurationWithCache(appId);
    console.log('   Azure config keys:', Object.keys(azureConfig));
    console.log('   Azure config data:', JSON.stringify(azureConfig, null, 2));
    sources.push({ type: 'azure', data: azureConfig, priority: 5 });
    
    // Sort by priority
    console.log('\n📊 Sorting sources by priority...');
    sources.sort((a, b) => a.priority - b.priority);
    sources.forEach(source => {
      console.log(`   ${source.type}: priority ${source.priority}, ${Object.keys(source.data).length} keys`);
    });
    
    // Merge configurations
    console.log('\n🔄 Merging configurations...');
    sources.forEach((source, index) => {
      console.log(`\n   Step ${index + 1}: Merging ${source.type} (priority ${source.priority})`);
      console.log(`   Before merge - config keys: [${Object.keys(config).join(', ')}]`);
      console.log(`   Merging data: ${JSON.stringify(source.data, null, 2)}`);
      
      this.deepMerge(config, source.data);
      
      console.log(`   After merge - config keys: [${Object.keys(config).join(', ')}]`);
      
      // Show specific key values for debugging
      const apiUrl = config.apiurl || config['api.url'];
      const logLevel = config.loglevel || config['log.level'];
      console.log(`   Current API URL: ${apiUrl}`);
      console.log(`   Current Log Level: ${logLevel}`);
    });
    
    console.log('\n✅ Final merged configuration:');
    console.log('   Final keys:', Object.keys(config));
    const finalApiUrl = config.apiurl || config['api.url'];
    const finalLogLevel = config.loglevel || config['log.level'];
    console.log(`   Final API URL: ${finalApiUrl}`);
    console.log(`   Final Log Level: ${finalLogLevel}`);
    
    return config;
  };
  
  try {
    const result = await provider.getAppConfiguration('admin');
    
    console.log('\n🏁 FINAL RESULT:');
    console.log('Result keys:', Object.keys(result));
    console.log('API URL:', result.apiurl || result['api.url']);
    console.log('Log Level:', result.loglevel || result['log.level']);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugPrecedence().catch(console.error);