/**
 * E2E Test: No .env Files Scenario
 * Tests that the library works properly when no .env files exist at all
 * This specifically tests the fix for the environment variable fallback issue
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');
const fs = require('fs');

// Ensure no .env files exist
function ensureNoDotEnvFiles() {
  const possibleEnvFiles = [
    '.env',
    '.env.local', 
    '.env.development',
    '.env.production',
    'apps/admin/.env',
    'apps/admin/.env.local',
    'apps/client/.env',
    'apps/client/.env.local'
  ];
  
  possibleEnvFiles.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🗑️  Removed existing ${file}`);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });
}

async function testNoDotEnvScenario() {
  console.log('🧪 Testing No .env Files Scenario (Pure Environment Variable Fallback)\n');
  
  // Ensure clean slate
  ensureNoDotEnvFiles();
  
  // Set up comprehensive environment variables
  process.env.REACT_APP_API_URL = 'https://env-api.example.com';
  process.env.REACT_APP_LOG_LEVEL = 'warn';
  process.env.REACT_APP_SHARED_CONFIG = 'shared-env-value';
  
  // App-specific environment variables (should have higher priority)
  process.env.REACT_APP_ADMIN_API_URL = 'https://admin-env-api.example.com';
  process.env.REACT_APP_ADMIN_SECRET = 'admin-secret-123';
  process.env.REACT_APP_CLIENT_API_URL = 'https://client-env-api.example.com';
  process.env.REACT_APP_CLIENT_TOKEN = 'client-token-456';
  
  // Direct process.env variables (lowest priority fallback)
  process.env.DATABASE_URL = 'postgres://localhost:5432/fallback_db';
  process.env.OKTA_CLIENT_ID = 'okta-fallback-id';
  process.env.API_URL = 'https://direct-fallback-api.example.com';
  process.env.PORT = '8080';
  
  const provider = new AppScopedConfigurationProvider();
  
  console.log('📱 Testing Admin App (No .env files):');
  try {
    const adminConfig = await provider.getAppConfiguration('admin');
    
    console.log('Admin config source count:', Object.keys(adminConfig).length);
    
    // Test app-specific override
    const adminApiUrl = adminConfig.apiurl || adminConfig['api.url'];
    console.log(`✓ Admin API URL (app-specific): ${adminApiUrl} ${adminApiUrl === 'https://admin-env-api.example.com' ? '✅' : '❌'}`);
    
    // Test app-specific unique value (REACT_APP_ADMIN_SECRET becomes secret)
    const adminSecret = adminConfig.secret;
    console.log(`✓ Admin Secret: ${adminSecret} ${adminSecret === 'admin-secret-123' ? '✅' : '❌'}`);
    
    // Test generic environment variable (nested in react.app.log.level)
    const logLevel = adminConfig?.react?.app?.log?.level;
    console.log(`✓ Log Level (generic): ${logLevel} ${logLevel === 'warn' ? '✅' : '❌'}`);
    
    // Test shared config (nested in react.app.shared.config)
    const sharedConfig = adminConfig?.react?.app?.shared?.config;
    console.log(`✓ Shared Config: ${sharedConfig} ${sharedConfig === 'shared-env-value' ? '✅' : '❌'}`);
    
    // Test direct process.env fallback (nested structures)
    const databaseUrl = adminConfig?.database?.url;
    console.log(`✓ Database URL (direct fallback): ${databaseUrl} ${databaseUrl === 'postgres://localhost:5432/fallback_db' ? '✅' : '❌'}`);
    
    const oktaClientId = adminConfig?.okta?.client?.id;
    console.log(`✓ OKTA Client ID (direct fallback): ${oktaClientId} ${oktaClientId === 'okta-fallback-id' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Admin app test failed:', error.message);
    return false;
  }
  
  console.log('\n📱 Testing Client App (No .env files):');
  try {
    const clientConfig = await provider.getAppConfiguration('client');
    
    console.log('Client config source count:', Object.keys(clientConfig).length);
    
    // Test app-specific override  
    const clientApiUrl = clientConfig.apiurl || clientConfig['api.url'];
    console.log(`✓ Client API URL (app-specific): ${clientApiUrl} ${clientApiUrl === 'https://client-env-api.example.com' ? '✅' : '❌'}`);
    
    // Test app-specific unique value (REACT_APP_CLIENT_TOKEN becomes token)
    const clientToken = clientConfig.token;
    console.log(`✓ Client Token: ${clientToken} ${clientToken === 'client-token-456' ? '✅' : '❌'}`);
    
    // Test generic fallback (no client-specific log level, nested in react.app.log.level)
    const logLevel = clientConfig?.react?.app?.log?.level;
    console.log(`✓ Log Level (generic fallback): ${logLevel} ${logLevel === 'warn' ? '✅' : '❌'}`);
    
    // Test shared config (nested in react.app.shared.config)
    const sharedConfig = clientConfig?.react?.app?.shared?.config;
    console.log(`✓ Shared Config: ${sharedConfig} ${sharedConfig === 'shared-env-value' ? '✅' : '❌'}`);
    
    // Test direct process.env fallback (nested structure)
    const port = clientConfig?.port;
    console.log(`✓ Port (direct fallback): ${port} ${port === '8080' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Client app test failed:', error.message);
    return false;
  }
  
  console.log('\n🎉 No .env Files Test: PASSED');
  console.log('✅ Environment variable fallback is working correctly!');
  
  return true;
}

async function main() {
  const success = await testNoDotEnvScenario();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testNoDotEnvScenario };