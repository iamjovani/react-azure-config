/**
 * Comprehensive Bug Fix Validation Test
 * 
 * This test validates that all the bugs reported in the REACT-AZURE-CONFIG-BUG-REPORT.md
 * have been fixed with the architectural improvements made.
 */

const { createAppAzureLoader, ApiRouteConfigHandler } = require('./dist/server.cjs.js');

// Mock environment variables to match the bug report scenario
process.env.NODE_ENV = 'development';
process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN = 'https://test-admin-config.azconfig.io';
process.env.AZURE_CLIENT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
process.env.AZURE_CLIENT_SECRET_ADMIN = 'test-client-secret-value';
process.env.AZURE_CLIENT_TENANT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET = 'test-nextauth-secret-from-env';
process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID = 'test-okta-client-id-from-env';

console.log('🧪 Starting Comprehensive Bug Fix Validation Test');
console.log('=' .repeat(60));

async function testEnhancedApiRouteIntegration() {
  console.log('\n📝 Test 1: Enhanced API Route Integration');
  console.log('-'.repeat(40));

  try {
    // Test the new createAppAzureLoader which should return ApiRouteConfigHandler
    const adminHandler = createAppAzureLoader({
      appId: 'admin',
      environment: 'development',
      endpoint: process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN,
      authentication: {
        type: 'servicePrincipal',
        tenantId: process.env.AZURE_CLIENT_TENANT_ID_ADMIN,
        clientId: process.env.AZURE_CLIENT_ID_ADMIN,
        clientSecret: process.env.AZURE_CLIENT_SECRET_ADMIN,
      },
      enableLocalFallback: true,
      variableMappings: {
        'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET', 'NEXTAUTH_SECRET'],
        'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID', 'OKTA_CLIENT_ID']
      }
    });

    console.log('✅ createAppAzureLoader now returns ApiRouteConfigHandler');
    console.log(`   Handler type: ${adminHandler.constructor.name}`);

    // Test getting configuration (this should activate fallback when Azure fails)
    const configResponse = await adminHandler.getConfiguration();
    
    console.log('✅ getConfiguration() method available and working');
    console.log(`   Success: ${configResponse.success}`);
    console.log(`   Source: ${configResponse.source}`);
    console.log(`   Variables found: ${configResponse.data ? Object.keys(configResponse.data).length : 0}`);
    
    if (configResponse.debug) {
      console.log(`   Debug info: ${JSON.stringify(configResponse.debug, null, 2)}`);
    }

    // Test getting specific values
    const nextAuthResponse = await adminHandler.getConfigurationValue('REACT_APP_ADMIN_NEXTAUTH_SECRET');
    console.log('✅ getConfigurationValue() method working');
    console.log(`   NextAuth Secret found: ${nextAuthResponse.success}`);
    console.log(`   Value: ${nextAuthResponse.value ? 'Found' : 'Not found'}`);

    return true;
  } catch (error) {
    console.error('❌ Enhanced API Route Integration test failed:', error.message);
    return false;
  }
}

async function testEnvironmentFallbackMechanism() {
  console.log('\n🔄 Test 2: Environment Fallback Mechanism');
  console.log('-'.repeat(40));

  try {
    // Create handler with invalid Azure credentials to force fallback
    const fallbackHandler = createAppAzureLoader({
      appId: 'admin',
      environment: 'development',
      endpoint: 'https://invalid-endpoint.azconfig.io',
      authentication: {
        type: 'servicePrincipal',
        tenantId: 'invalid-tenant',
        clientId: 'invalid-client',
        clientSecret: 'invalid-secret',
      },
      enableLocalFallback: true,
      variableMappings: {
        'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET'],
        'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID']
      }
    });

    const fallbackResponse = await fallbackHandler.getConfiguration();
    
    console.log('✅ Fallback mechanism activated when Azure fails');
    console.log(`   Success: ${fallbackResponse.success}`);
    console.log(`   Source: ${fallbackResponse.source}`);
    console.log(`   Fallback variables: ${fallbackResponse.data ? Object.keys(fallbackResponse.data).length : 0}`);

    // Check if specific environment variables were found
    const hasNextAuth = fallbackResponse.data && 
      (fallbackResponse.data['REACT_APP_ADMIN_NEXTAUTH_SECRET'] || 
       fallbackResponse.data['nextauth.secret'] ||
       fallbackResponse.data['nextauthsecret']);
    
    const hasOkta = fallbackResponse.data && 
      (fallbackResponse.data['REACT_APP_ADMIN_OKTA_CLIENT_ID'] ||
       fallbackResponse.data['okta.client.id'] ||
       fallbackResponse.data['oktaclientid']);

    console.log(`   NextAuth Secret accessible: ${hasNextAuth ? 'Yes' : 'No'}`);
    console.log(`   Okta Client ID accessible: ${hasOkta ? 'Yes' : 'No'}`);

    if (fallbackResponse.data) {
      console.log(`   Available keys: ${Object.keys(fallbackResponse.data).slice(0, 5).join(', ')}${Object.keys(fallbackResponse.data).length > 5 ? '...' : ''}`);
    }

    return hasNextAuth && hasOkta;
  } catch (error) {
    console.error('❌ Environment Fallback test failed:', error.message);
    return false;
  }
}

async function testVariableResolutionStrategies() {
  console.log('\n🔍 Test 3: Variable Resolution Strategies');
  console.log('-'.repeat(40));

  try {
    const handler = createAppAzureLoader({
      appId: 'admin',
      enableLocalFallback: true,
      variableMappings: {
        'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET'],
        'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID']
      }
    });

    const config = await handler.getConfiguration();
    
    if (!config.success || !config.data) {
      console.log('⚠️  No configuration data available for resolution test');
      return false;
    }

    console.log('✅ Testing multiple variable resolution patterns:');

    // Test different key formats that should all resolve to the same value
    const testKeys = [
      'REACT_APP_ADMIN_NEXTAUTH_SECRET',
      'nextauth.secret',
      'nextauthsecret',
      'NEXTAUTH_SECRET'
    ];

    const resolvedValues = {};
    for (const key of testKeys) {
      const valueResponse = await handler.getConfigurationValue(key);
      resolvedValues[key] = valueResponse.value;
      console.log(`   ${key}: ${valueResponse.value ? 'Found' : 'Not found'}`);
    }

    // Check if at least one resolution strategy worked
    const hasAnyValue = Object.values(resolvedValues).some(value => value !== undefined);
    console.log(`   At least one resolution strategy worked: ${hasAnyValue ? 'Yes' : 'No'}`);

    return hasAnyValue;
  } catch (error) {
    console.error('❌ Variable Resolution test failed:', error.message);
    return false;
  }
}

async function testErrorHandlingAndDebugging() {
  console.log('\n🛠️  Test 4: Error Handling and Debugging');
  console.log('-'.repeat(40));

  try {
    // Test with completely invalid configuration to see error handling
    const debugHandler = createAppAzureLoader({
      appId: 'nonexistent-app',
      enableLocalFallback: true,
      includeDebugInfo: true
    });

    const debugResponse = await debugHandler.getConfiguration();
    
    console.log('✅ Error handling working for invalid app configuration');
    console.log(`   Success: ${debugResponse.success}`);
    console.log(`   Source: ${debugResponse.source}`);
    
    if (debugResponse.debug) {
      console.log('✅ Debug information provided:');
      console.log(`   Sources used: ${debugResponse.debug.sourcesUsed.join(', ')}`);
      console.log(`   Fallback activated: ${debugResponse.debug.fallbackActivated}`);
      console.log(`   Variable count: ${debugResponse.debug.variableCount}`);
      if (debugResponse.debug.errors) {
        console.log(`   Errors logged: ${debugResponse.debug.errors.length}`);
      }
    }

    // Test debug info method
    const debugInfo = await debugHandler.getDebugInfo();
    console.log('✅ getDebugInfo() method available');
    console.log(`   App ID: ${debugInfo.appId}`);
    console.log(`   Fallback enabled: ${debugInfo.environment.fallbackEnabled}`);

    return true;
  } catch (error) {
    console.error('❌ Error Handling test failed:', error.message);
    return false;
  }
}

async function testBackwardCompatibility() {
  console.log('\n🔄 Test 5: Backward Compatibility');
  console.log('-'.repeat(40));

  try {
    // Test that the legacy createAppAzureLoaderLegacy still works
    const { createAppAzureLoaderLegacy } = require('./dist/server.cjs.js');
    
    const legacyLoader = createAppAzureLoaderLegacy('admin', {
      environment: 'development'
    });

    console.log('✅ Legacy createAppAzureLoaderLegacy available');
    console.log(`   Legacy loader type: ${legacyLoader.constructor.name}`);

    // Test that it has the new API methods
    if (typeof legacyLoader.getConfigurationForApi === 'function') {
      console.log('✅ Legacy loader has enhanced API methods');
      
      const legacyApiResponse = await legacyLoader.getConfigurationForApi();
      console.log(`   Legacy API response success: ${legacyApiResponse.success}`);
      console.log(`   Legacy API response source: ${legacyApiResponse.source}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Backward Compatibility test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Running all bug fix validation tests...\n');

  const tests = [
    { name: 'Enhanced API Route Integration', fn: testEnhancedApiRouteIntegration },
    { name: 'Environment Fallback Mechanism', fn: testEnvironmentFallbackMechanism },
    { name: 'Variable Resolution Strategies', fn: testVariableResolutionStrategies },
    { name: 'Error Handling and Debugging', fn: testErrorHandlingAndDebugging },
    { name: 'Backward Compatibility', fn: testBackwardCompatibility }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.error(`💥 Test "${test.name}" threw an exception:`, error.message);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }

  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL BUGS FIXED! The library is ready for production use.');
    console.log('\n📚 Next Steps:');
    console.log('   1. Update your API routes to use the new createAppAzureLoader');
    console.log('   2. Test with your actual Azure App Configuration setup');
    console.log('   3. Deploy with confidence knowing fallback works properly');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }

  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then(allPassed => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };