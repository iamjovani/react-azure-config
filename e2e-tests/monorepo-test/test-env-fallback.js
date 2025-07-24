/**
 * E2E Test: Environment Variable Fallback
 * Tests that the library properly falls back to environment variables when no .env files exist
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');

// Set up test environment variables
process.env.REACT_APP_API_URL = 'https://generic-api.example.com';
process.env.REACT_APP_LOG_LEVEL = 'debug';
process.env.REACT_APP_SHARED_SECRET = 'shared-secret-123';

// App-specific environment variables
process.env.REACT_APP_ADMIN_API_URL = 'https://admin-api.example.com';
process.env.REACT_APP_ADMIN_DB_HOST = 'admin-db.example.com';
process.env.REACT_APP_ADMIN_LOG_LEVEL = 'info';

process.env.REACT_APP_CLIENT_API_URL = 'https://client-api.example.com';
process.env.REACT_APP_CLIENT_AUTH_KEY = 'client-auth-key-456';

// Direct process.env variables (should be captured by fallback)
process.env.DATABASE_URL = 'postgres://localhost:5432/testdb';
process.env.OKTA_CLIENT_ID = 'okta-test-client-id';
process.env.API_URL = 'https://fallback-api.example.com';
process.env.NODE_ENV = 'test';

async function testEnvironmentFallback() {
  console.log('🧪 Testing Environment Variable Fallback (No .env files)\n');
  
  const provider = new AppScopedConfigurationProvider();
  
  // Test Admin App
  console.log('📱 Testing Admin App Configuration:');
  try {
    const adminConfig = await provider.getAppConfiguration('admin');
    
    console.log('Admin config keys:', Object.keys(adminConfig));
    
    // Check app-specific values (should override generic)
    const adminApiUrl = adminConfig.apiurl || adminConfig['api.url'];
    const adminLogLevel = adminConfig.loglevel || adminConfig['log.level'];
    const adminDbHost = adminConfig.dbhost || adminConfig['db.host'];
    
    console.log(`✓ Admin API URL: ${adminApiUrl} ${adminApiUrl === 'https://admin-api.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Admin Log Level: ${adminLogLevel} ${adminLogLevel === 'info' ? '✅' : '❌'}`);
    console.log(`✓ Admin DB Host: ${adminDbHost} ${adminDbHost === 'admin-db.example.com' ? '✅' : '❌'}`);
    
    // Check shared values (nested in react.app.shared.secret)
    const sharedSecret = adminConfig?.react?.app?.shared?.secret;
    console.log(`✓ Shared Secret: ${sharedSecret} ${sharedSecret === 'shared-secret-123' ? '✅' : '❌'}`);
    
    // Check fallback values (nested structures)
    const databaseUrl = adminConfig?.database?.url;
    const oktaClientId = adminConfig?.okta?.client?.id;
    console.log(`✓ Database URL (fallback): ${databaseUrl} ${databaseUrl === 'postgres://localhost:5432/testdb' ? '✅' : '❌'}`);
    console.log(`✓ OKTA Client ID (fallback): ${oktaClientId} ${oktaClientId === 'okta-test-client-id' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Admin app test failed:', error.message);
    return false;
  }
  
  console.log('\n📱 Testing Client App Configuration:');
  try {
    const clientConfig = await provider.getAppConfiguration('client');
    
    console.log('Client config keys:', Object.keys(clientConfig));
    
    // Check app-specific values
    const clientApiUrl = clientConfig.apiurl || clientConfig['api.url'];
    const clientAuthKey = clientConfig.authkey || clientConfig['auth.key'];
    
    console.log(`✓ Client API URL: ${clientApiUrl} ${clientApiUrl === 'https://client-api.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Client Auth Key: ${clientAuthKey} ${clientAuthKey === 'client-auth-key-456' ? '✅' : '❌'}`);
    
    // Check generic fallback (should get generic REACT_APP_LOG_LEVEL since no client-specific)
    const logLevel = clientConfig?.react?.app?.log?.level;
    console.log(`✓ Log Level (generic): ${logLevel} ${logLevel === 'debug' ? '✅' : '❌'}`);
    
    // Check shared values (nested in react.app.shared.secret)
    const sharedSecret = clientConfig?.react?.app?.shared?.secret;
    console.log(`✓ Shared Secret: ${sharedSecret} ${sharedSecret === 'shared-secret-123' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Client app test failed:', error.message);
    return false;
  }
  
  console.log('\n🎉 Environment Variable Fallback Test: PASSED');
  return true;
}

async function main() {
  const success = await testEnvironmentFallback();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEnvironmentFallback };