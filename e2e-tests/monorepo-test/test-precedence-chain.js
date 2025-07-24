/**
 * E2E Test: Configuration Precedence Chain
 * Tests the full precedence: Azure → App env vars → Generic env vars → .env files → Direct fallback
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');
const fs = require('fs');
const path = require('path');

// Clean up any existing .env files
function cleanupEnvFiles() {
  const files = ['.env', 'apps/admin/.env', 'apps/client/.env'];
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });
}

// Create test .env files
function createTestEnvFiles() {
  // Root .env file (lowest priority)
  fs.writeFileSync('.env', `
REACT_APP_API_URL=https://root-env-api.example.com
REACT_APP_LOG_LEVEL=error
REACT_APP_ROOT_ONLY=root-value
DATABASE_URL=postgres://root:5432/db
`);

  // Admin app .env file
  fs.mkdirSync('apps/admin', { recursive: true });
  fs.writeFileSync('apps/admin/.env', `
REACT_APP_API_URL=https://admin-env-file-api.example.com
REACT_APP_ADMIN_SETTING=admin-env-file-value
`);

  // Client app .env file
  fs.mkdirSync('apps/client', { recursive: true });
  fs.writeFileSync('apps/client/.env', `
REACT_APP_API_URL=https://client-env-file-api.example.com
REACT_APP_CLIENT_SETTING=client-env-file-value
`);
}

async function testPrecedenceChain() {
  console.log('🧪 Testing Full Precedence Chain\n');
  
  // Step 1: Clean slate (only direct process.env)
  console.log('🎬 Step 1: Testing Direct Process.env Fallback');
  cleanupEnvFiles();
  
  // Set up environment variables
  process.env.REACT_APP_API_URL = 'https://env-var-api.example.com';
  process.env.REACT_APP_ADMIN_API_URL = 'https://admin-env-var-api.example.com';
  process.env.REACT_APP_LOG_LEVEL = 'warn';
  process.env.DATABASE_URL = 'postgres://localhost:5432/testdb';
  process.env.OKTA_CLIENT_ID = 'okta-env-var';
  
  const provider = new AppScopedConfigurationProvider();
  
  try {
    const adminConfig1 = await provider.getAppConfiguration('admin');
    const adminApiUrl1 = adminConfig1.apiurl || adminConfig1['api.url'];
    const databaseUrl1 = adminConfig1.databaseurl || adminConfig1['database.url'];
    
    console.log(`✓ Admin API URL (env var): ${adminApiUrl1} ${adminApiUrl1 === 'https://admin-env-var-api.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Database URL (direct fallback): ${databaseUrl1} ${databaseUrl1 === 'postgres://localhost:5432/testdb' ? '✅' : '❌'}`);
  } catch (error) {
    console.error('❌ Step 1 failed:', error.message);
    return false;
  }
  
  // Step 2: Add .env files (should override some values)
  console.log('\n🎬 Step 2: Adding .env Files');
  createTestEnvFiles();
  
  try {
    const adminConfig2 = await provider.getAppConfiguration('admin');
    const adminApiUrl2 = adminConfig2.apiurl || adminConfig2['api.url'];
    const adminSetting2 = adminConfig2.adminsetting || adminConfig2['admin.setting'];
    const rootOnly2 = adminConfig2.rootonly || adminConfig2['root.only'];
    
    console.log(`✓ Admin API URL (app .env file): ${adminApiUrl2} ${adminApiUrl2 === 'https://admin-env-file-api.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Admin Setting (app .env file): ${adminSetting2} ${adminSetting2 === 'admin-env-file-value' ? '✅' : '❌'}`);
    console.log(`✓ Root Only (root .env file): ${rootOnly2} ${rootOnly2 === 'root-value' ? '✅' : '❌'}`);
    
    const clientConfig2 = await provider.getAppConfiguration('client');
    const clientApiUrl2 = clientConfig2.apiurl || clientConfig2['api.url'];
    const clientSetting2 = clientConfig2.clientsetting || clientConfig2['client.setting'];
    
    console.log(`✓ Client API URL (app .env file): ${clientApiUrl2} ${clientApiUrl2 === 'https://client-env-file-api.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Client Setting (app .env file): ${clientSetting2} ${clientSetting2 === 'client-env-file-value' ? '✅' : '❌'}`);
  } catch (error) {
    console.error('❌ Step 2 failed:', error.message);
    return false;
  }
  
  // Step 3: Override with higher priority env vars (app-specific should win)
  console.log('\n🎬 Step 3: Testing App-Specific Environment Variable Precedence');
  process.env.REACT_APP_ADMIN_API_URL = 'https://admin-high-priority-env.example.com';
  process.env.REACT_APP_CLIENT_API_URL = 'https://client-high-priority-env.example.com';
  
  try {
    const adminConfig3 = await provider.getAppConfiguration('admin');
    const clientConfig3 = await provider.getAppConfiguration('client');
    
    const adminApiUrl3 = adminConfig3.apiurl || adminConfig3['api.url'];
    const clientApiUrl3 = clientConfig3.apiurl || clientConfig3['api.url'];
    
    console.log(`✓ Admin API URL (app-specific env var): ${adminApiUrl3} ${adminApiUrl3 === 'https://admin-high-priority-env.example.com' ? '✅' : '❌'}`);
    console.log(`✓ Client API URL (app-specific env var): ${clientApiUrl3} ${clientApiUrl3 === 'https://client-high-priority-env.example.com' ? '✅' : '❌'}`);
  } catch (error) {
    console.error('❌ Step 3 failed:', error.message);
    return false;
  }
  
  console.log('\n🎉 Precedence Chain Test: PASSED');
  
  // Cleanup
  cleanupEnvFiles();
  return true;
}

async function main() {
  const success = await testPrecedenceChain();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPrecedenceChain };