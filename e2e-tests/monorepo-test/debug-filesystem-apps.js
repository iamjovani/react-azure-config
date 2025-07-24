/**
 * Debug Filesystem App Discovery
 * 
 * Test the filesystem app discovery logic specifically
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');

function debugFilesystemApps() {
  console.log('🔍 Debug: Filesystem App Discovery');
  console.log('=' .repeat(60));
  
  const provider = new AppScopedConfigurationProvider();
  
  // Get available apps from the provider
  const availableApps = provider.getAvailableApps();
  console.log('Available Apps:', availableApps);
  
  // Test specific environment variables
  process.env.REACT_APP_ADMIN_SPECIFIC_CONFIG = 'admin-config';
  process.env.REACT_APP_CLIENT_SPECIFIC_CONFIG = 'client-config';
  process.env.REACT_APP_GENERIC_VAR = 'generic-value';
  
  console.log('\n📋 Test Environment Variables Set:');
  console.log('  REACT_APP_ADMIN_SPECIFIC_CONFIG = "admin-config"');
  console.log('  REACT_APP_CLIENT_SPECIFIC_CONFIG = "client-config"');
  console.log('  REACT_APP_GENERIC_VAR = "generic-value"');
  
  return { provider, availableApps };
}

async function testAppConfiguration() {
  const { provider, availableApps } = debugFilesystemApps();
  
  console.log('\n📱 Testing Admin App Configuration');
  const adminConfig = await provider.getAppConfiguration('admin');
  
  console.log('\n📊 Admin Configuration:');
  console.log(JSON.stringify(adminConfig, null, 2));
  
  console.log('\n📱 Testing Client App Configuration');
  const clientConfig = await provider.getAppConfiguration('client');
  
  console.log('\n📊 Client Configuration:');
  console.log(JSON.stringify(clientConfig, null, 2));
  
  // Clean up
  delete process.env.REACT_APP_ADMIN_SPECIFIC_CONFIG;
  delete process.env.REACT_APP_CLIENT_SPECIFIC_CONFIG;
  delete process.env.REACT_APP_GENERIC_VAR;
}

if (require.main === module) {
  testAppConfiguration()
    .then(() => {
      console.log('\n✅ Filesystem app debug completed');
    })
    .catch(error => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { testAppConfiguration };