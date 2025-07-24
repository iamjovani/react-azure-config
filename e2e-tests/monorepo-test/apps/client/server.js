/**
 * Client App Test Server  
 * Tests environment variable fallback for client app
 */

const { AppScopedConfigurationProvider, createConfigServer } = require('react-azure-config/server');

async function startClientApp() {
  console.log('🚀 Starting Client App Test Server...');
  
  const provider = new AppScopedConfigurationProvider();
  
  // Test configuration loading for client app
  console.log('\n📊 Testing Client App Configuration Loading...');
  
  try {
    const config = await provider.getAppConfiguration('client');
    
    console.log('\n✅ Client App Configuration Loaded:');
    console.log('Configuration keys:', Object.keys(config));
    console.log('Configuration values:', JSON.stringify(config, null, 2));
    
    // Test specific values
    const apiUrl = config.apiurl || config['api.url'] || config.api?.url;
    const authKey = config.authkey || config['auth.key'] || config.auth?.key;
    const logLevel = config.loglevel || config['log.level'] || config.log?.level;
    
    console.log('\n🔍 Specific Value Tests:');
    console.log(`API URL: ${apiUrl || 'NOT FOUND'}`);
    console.log(`Auth Key: ${authKey || 'NOT FOUND'}`);
    console.log(`Log Level: ${logLevel || 'NOT FOUND'}`);
    
    // Start config server
    const configServer = createConfigServer({
      port: 3002,
      environment: process.env.NODE_ENV || 'test'
    });
    
    await configServer.start();
    console.log('\n🌐 Client Config Server started on http://localhost:3002');
    console.log('   - Config endpoint: http://localhost:3002/config/client');
    console.log('   - Debug endpoint: http://localhost:3002/config-debug/client');
    
  } catch (error) {
    console.error('❌ Client App Configuration Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startClientApp().catch(console.error);
}

module.exports = { startClientApp };