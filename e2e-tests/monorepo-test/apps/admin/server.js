/**
 * Admin App Test Server
 * Tests environment variable fallback for admin app
 */

const { AppScopedConfigurationProvider, createConfigServer } = require('react-azure-config/server');

async function startAdminApp() {
  console.log('🚀 Starting Admin App Test Server...');
  
  const provider = new AppScopedConfigurationProvider();
  
  // Test configuration loading for admin app
  console.log('\n📊 Testing Admin App Configuration Loading...');
  
  try {
    const config = await provider.getAppConfiguration('admin');
    
    console.log('\n✅ Admin App Configuration Loaded:');
    console.log('Configuration keys:', Object.keys(config));
    console.log('Configuration values:', JSON.stringify(config, null, 2));
    
    // Test specific values
    const apiUrl = config.apiurl || config['api.url'] || config.api?.url;
    const logLevel = config.loglevel || config['log.level'] || config.log?.level;
    const database = config.databaseurl || config['database.url'] || config.database?.url;
    
    console.log('\n🔍 Specific Value Tests:');
    console.log(`API URL: ${apiUrl || 'NOT FOUND'}`);
    console.log(`Log Level: ${logLevel || 'NOT FOUND'}`);
    console.log(`Database URL: ${database || 'NOT FOUND'}`);
    
    // Start config server
    const configServer = createConfigServer({
      port: 3001,
      environment: process.env.NODE_ENV || 'test'
    });
    
    await configServer.start();
    console.log('\n🌐 Admin Config Server started on http://localhost:3001');
    console.log('   - Config endpoint: http://localhost:3001/config/admin');
    console.log('   - Debug endpoint: http://localhost:3001/config-debug/admin');
    
  } catch (error) {
    console.error('❌ Admin App Configuration Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startAdminApp().catch(console.error);
}

module.exports = { startAdminApp };