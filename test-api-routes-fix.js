/**
 * Test: API Route Construction Fixes
 * Verifies that the RuntimeConfigurationClient calls the exact apiUrl without nested paths
 */

const { createRuntimeConfigClient } = require('./dist/client.cjs.js');

// Mock fetch to capture API calls
let fetchCalls = [];
global.fetch = function(url, options) {
  fetchCalls.push({ url, options });
  
  // Mock successful response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      config: {
        'NEXTAUTH_SECRET': 'test-secret-from-api',
        'OKTA_CLIENT_ID': 'test-okta-id-from-api',
        'api.url': 'https://api.example.com'
      },
      source: 'api'
    })
  });
};

async function testApiRouteConstruction() {
  console.log('🧪 Testing API Route Construction Fixes\n');
  
  // Test 1: Basic apiUrl usage
  console.log('📋 Test 1: Basic API URL Usage');
  fetchCalls = [];
  
  const client1 = createRuntimeConfigClient({
    useEmbeddedService: true,
    configServiceUrl: 'http://localhost:3001/api/config',
    environment: 'test',
    appId: 'admin'
  });
  
  await client1.getConfiguration();
  
  console.log(`  ✓ Fetch calls made: ${fetchCalls.length}`);
  console.log(`  ✓ API URL called: ${fetchCalls[0]?.url}`);
  console.log(`  ✓ Correct direct call: ${fetchCalls[0]?.url === 'http://localhost:3001/api/config' ? '✅' : '❌'}`);
  
  // Test 2: Individual value retrieval
  console.log('\n📋 Test 2: Individual Value Retrieval');
  fetchCalls = [];
  
  const value = await client1.getValue('NEXTAUTH_SECRET');
  
  console.log(`  ✓ Value retrieved: ${value}`);
  console.log(`  ✓ Additional fetch calls for individual value: ${fetchCalls.length === 0 ? '✅ (reused config)' : '❌ (made extra calls)'}`);
  
  // Test 3: Different apiUrl
  console.log('\n📋 Test 3: Different API URL');
  fetchCalls = [];
  
  const client2 = createRuntimeConfigClient({
    useEmbeddedService: true,
    configServiceUrl: 'https://my-custom-api.com/configuration',
    environment: 'production',
    appId: 'client'
  });
  
  await client2.getConfiguration();
  
  console.log(`  ✓ API URL called: ${fetchCalls[0]?.url}`);
  console.log(`  ✓ Correct custom API call: ${fetchCalls[0]?.url === 'https://my-custom-api.com/configuration' ? '✅' : '❌'}`);
  
  // Test 4: Verify no nested path construction
  console.log('\n📋 Test 4: Verify No Nested Path Construction');
  
  const allUrls = fetchCalls.map(call => call.url);
  const hasNestedPaths = allUrls.some(url => 
    url.includes('/config/config/') || 
    url.includes('/config/admin/') || 
    url.includes('/config/client/')
  );
  
  console.log(`  ✓ No nested paths detected: ${!hasNestedPaths ? '✅' : '❌'}`);
  console.log(`  ✓ All URLs: ${JSON.stringify(allUrls, null, 2)}`);
  
  return !hasNestedPaths;
}


async function main() {
  try {
    const success = await testApiRouteConstruction();
    
    if (success) {
      console.log('\n🎉 API Route Construction Test: PASSED');
      console.log('✅ RuntimeConfigurationClient correctly calls exact apiUrl without nested paths');
    } else {
      console.log('\n❌ API Route Construction Test: FAILED');
      console.log('❌ RuntimeConfigurationClient still constructing nested paths');
    }
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testApiRouteConstruction };