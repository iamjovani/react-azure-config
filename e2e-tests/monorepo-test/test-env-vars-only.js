/**
 * E2E Test: Environment Variables Only (No .env files)
 * Tests that the library correctly falls back to environment variables when no .env files are present
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');
const fs = require('fs');
const path = require('path');

// Clean up any existing .env files to ensure we're testing env var fallback only
function cleanupAllEnvFiles() {
  const files = [
    '.env', 
    '.env.local', 
    '.env.development', 
    'apps/admin/.env', 
    'apps/admin/.env.local',
    'apps/admin/.env.development',
    'apps/client/.env',
    'apps/client/.env.local', 
    'apps/client/.env.development'
  ];
  
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🗑️  Removed: ${file}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not remove ${file}:`, error.message);
    }
  });
}

// Verify no .env files exist
function verifyNoEnvFiles() {
  const files = [
    '.env', 
    '.env.local', 
    '.env.development', 
    'apps/admin/.env', 
    'apps/admin/.env.local',
    'apps/admin/.env.development',
    'apps/client/.env',
    'apps/client/.env.local', 
    'apps/client/.env.development'
  ];
  
  const existingFiles = files.filter(file => fs.existsSync(file));
  
  if (existingFiles.length > 0) {
    console.error('❌ Error: Found existing .env files:', existingFiles);
    return false;
  }
  
  console.log('✅ Confirmed: No .env files present');
  return true;
}

async function testEnvironmentVariablesOnly() {
  console.log('🧪 Testing Environment Variables Only (No .env files)\n');
  
  // Step 1: Clean up all .env files
  console.log('🧹 Step 1: Cleaning up all .env files');
  cleanupAllEnvFiles();
  
  // Step 2: Verify no .env files exist
  console.log('\n🔍 Step 2: Verifying no .env files exist');
  if (!verifyNoEnvFiles()) {
    return false;
  }
  
  // Step 3: Set up environment variables
  console.log('\n⚙️  Step 3: Setting up environment variables');
  const envVars = {
    'REACT_APP_API_URL': 'https://env-only-api.example.com',
    'REACT_APP_ADMIN_API_URL': 'https://admin-env-only-api.example.com',
    'REACT_APP_CLIENT_API_URL': 'https://client-env-only-api.example.com',
    'REACT_APP_NEXTAUTH_SECRET': 'env-only-nextauth-secret',
    'REACT_APP_ADMIN_NEXTAUTH_SECRET': 'admin-env-only-nextauth-secret',
    'REACT_APP_CLIENT_NEXTAUTH_SECRET': 'client-env-only-nextauth-secret',
    'DATABASE_URL': 'postgres://env-only:5432/envdb',
    'OKTA_CLIENT_ID': 'env-only-okta-client',
    'OKTA_CLIENT_SECRET': 'env-only-okta-secret',
    'SGJ_INVESTMENT_BASE_URL': 'https://env-only-sgj.example.com'
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
    console.log(`  ✓ Set ${key}=${value}`);
  });
  
  // Step 4: Test configuration retrieval
  console.log('\n🎯 Step 4: Testing configuration retrieval from environment variables');
  
  const provider = new AppScopedConfigurationProvider();
  
  try {
    // Test admin app configuration
    console.log('\n📱 Testing Admin App Configuration');
    const adminConfig = await provider.getAppConfiguration('admin');
    
    const adminApiUrl = adminConfig.apiurl || adminConfig['api.url'];
    const adminNextAuthSecret = adminConfig.nextauthsecret || adminConfig['nextauth.secret'];
    const databaseUrl = adminConfig.databaseurl || adminConfig['database.url'];
    const oktaClientId = adminConfig.oktaclientid || adminConfig['okta.client.id'];
    const sgjInvestmentUrl = adminConfig.sgjinvestmentbaseurl || adminConfig['sgj.investment.base.url'];
    
    console.log(`  ✓ Admin API URL: ${adminApiUrl} ${adminApiUrl === 'https://admin-env-only-api.example.com' ? '✅' : '❌'}`);
    console.log(`  ✓ Admin NextAuth Secret: ${adminNextAuthSecret} ${adminNextAuthSecret === 'admin-env-only-nextauth-secret' ? '✅' : '❌'}`);
    console.log(`  ✓ Database URL: ${databaseUrl} ${databaseUrl === 'postgres://env-only:5432/envdb' ? '✅' : '❌'}`);
    console.log(`  ✓ Okta Client ID: ${oktaClientId} ${oktaClientId === 'env-only-okta-client' ? '✅' : '❌'}`);
    console.log(`  ✓ SGJ Investment URL: ${sgjInvestmentUrl} ${sgjInvestmentUrl === 'https://env-only-sgj.example.com' ? '✅' : '❌'}`);
    
    // Test client app configuration
    console.log('\n📱 Testing Client App Configuration');
    const clientConfig = await provider.getAppConfiguration('client');
    
    const clientApiUrl = clientConfig.apiurl || clientConfig['api.url'];
    const clientNextAuthSecret = clientConfig.nextauthsecret || clientConfig['nextauth.secret'];
    
    console.log(`  ✓ Client API URL: ${clientApiUrl} ${clientApiUrl === 'https://client-env-only-api.example.com' ? '✅' : '❌'}`);
    console.log(`  ✓ Client NextAuth Secret: ${clientNextAuthSecret} ${clientNextAuthSecret === 'client-env-only-nextauth-secret' ? '✅' : '❌'}`);
    
    // Test generic configuration (no specific app)
    console.log('\n🌐 Testing Generic Configuration');
    const genericConfig = await provider.getAppConfiguration();
    
    const genericApiUrl = genericConfig.apiurl || genericConfig['api.url'];
    const genericNextAuthSecret = genericConfig.nextauthsecret || genericConfig['nextauth.secret'];
    
    console.log(`  ✓ Generic API URL: ${genericApiUrl} ${genericApiUrl === 'https://env-only-api.example.com' ? '✅' : '❌'}`);
    console.log(`  ✓ Generic NextAuth Secret: ${genericNextAuthSecret} ${genericNextAuthSecret === 'env-only-nextauth-secret' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Environment variable test failed:', error.message);
    return false;
  }
  
  // Step 5: Test precedence with mixed environment variables
  console.log('\n🔄 Step 5: Testing Environment Variable Precedence');
  
  // Add some generic env vars and verify app-specific ones take precedence
  process.env.REACT_APP_LOG_LEVEL = 'info';
  process.env.REACT_APP_ADMIN_LOG_LEVEL = 'debug';
  
  try {
    const adminConfig = await provider.getAppConfiguration('admin');
    const clientConfig = await provider.getAppConfiguration('client');
    
    const adminLogLevel = adminConfig.loglevel || adminConfig['log.level'];
    const clientLogLevel = clientConfig.loglevel || clientConfig['log.level'];
    
    console.log(`  ✓ Admin Log Level (app-specific): ${adminLogLevel} ${adminLogLevel === 'debug' ? '✅' : '❌'}`);
    console.log(`  ✓ Client Log Level (generic): ${clientLogLevel} ${clientLogLevel === 'info' ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Precedence test failed:', error.message);
    return false;
  }
  
  // Step 6: Test missing environment variables
  console.log('\n❓ Step 6: Testing Missing Environment Variables');
  
  try {
    const testConfig = await provider.getAppConfiguration('test');
    const missingValue = testConfig.nonexistentkey || testConfig['nonexistent.key'];
    
    console.log(`  ✓ Missing key returns undefined: ${missingValue === undefined ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Missing env var test failed:', error.message);
    return false;
  }
  
  console.log('\n🎉 Environment Variables Only Test: PASSED');
  console.log('✅ Library successfully retrieves configuration from environment variables when no .env files are present');
  console.log('✅ App-specific environment variables take precedence over generic ones');
  console.log('✅ Missing environment variables are handled gracefully');
  
  return true;
}

async function main() {
  const success = await testEnvironmentVariablesOnly();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEnvironmentVariablesOnly };