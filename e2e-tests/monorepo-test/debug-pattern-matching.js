/**
 * Debug Pattern Matching Issues
 * 
 * Focused debugging to understand why pattern matching tests are failing
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');

function debugEnvironmentVariableProcessing() {
  console.log('🔍 Debug: Environment Variable Processing');
  
  // Set up specific test variables
  process.env.REACT_APP_STANDARD_VAR = 'standard-value';
  process.env.REACT_APP_NESTED__SUB__VALUE = 'nested-value';
  process.env.REACT_APP_ADMIN_SPECIFIC_CONFIG = 'admin-specific';
  process.env.DATABASE_URL = 'postgres://test-db:5432/testdb';
  process.env.OKTA_CLIENT_ID = 'test-okta-client';
  process.env.PAYMENT_API_URL = 'https://payment-api.example.com';
  
  console.log('\n📋 Environment Variables Set:');
  Object.keys(process.env)
    .filter(key => key.startsWith('REACT_APP_') || ['DATABASE_URL', 'OKTA_CLIENT_ID', 'PAYMENT_API_URL'].includes(key))
    .sort()
    .forEach(key => {
      console.log(`  ${key} = "${process.env[key]}"`);
    });
}

async function debugConfigurationParsing() {
  console.log('\n🔍 Debug: Configuration Parsing');
  
  const provider = new AppScopedConfigurationProvider();
  
  // Get admin configuration and examine the structure
  const adminConfig = await provider.getAppConfiguration('admin');
  
  console.log('\n📊 Admin Configuration Structure:');
  console.log(JSON.stringify(adminConfig, null, 2));
  
  console.log('\n🔍 Debug: Looking for specific values');
  
  // Check standard variable
  const standardVar = adminConfig?.react?.app?.standard?.var;
  console.log(`\n1. react.app.standard.var: "${standardVar}"`);
  console.log(`   Expected: "standard-value"`);
  console.log(`   Match: ${standardVar === 'standard-value' ? '✅' : '❌'}`);
  
  // Check nested variable
  const nestedVar = adminConfig?.react?.app?.nested?.sub?.value;
  console.log(`\n2. react.app.nested.sub.value: "${nestedVar}"`);
  console.log(`   Expected: "nested-value"`);
  console.log(`   Match: ${nestedVar === 'nested-value' ? '✅' : '❌'}`);
  
  // Check app-specific variable
  const appSpecific = adminConfig?.specificconfig;
  console.log(`\n3. specificconfig: "${appSpecific}"`);
  console.log(`   Expected: "admin-specific"`);
  console.log(`   Match: ${appSpecific === 'admin-specific' ? '✅' : '❌'}`);
  
  // Check database URL
  const databaseUrl = adminConfig?.database?.url;
  console.log(`\n4. database.url: "${databaseUrl}"`);
  console.log(`   Expected: "postgres://test-db:5432/testdb"`);
  console.log(`   Match: ${databaseUrl === 'postgres://test-db:5432/testdb' ? '✅' : '❌'}`);
  
  // Check OKTA client ID
  const oktaClientId = adminConfig?.okta?.client?.id;
  console.log(`\n5. okta.client.id: "${oktaClientId}"`);
  console.log(`   Expected: "test-okta-client"`);
  console.log(`   Match: ${oktaClientId === 'test-okta-client' ? '✅' : '❌'}`);
  
  // Check payment API URL
  const paymentApiUrl = adminConfig?.payment?.api?.url;
  console.log(`\n6. payment.api.url: "${paymentApiUrl}"`);
  console.log(`   Expected: "https://payment-api.example.com"`);
  console.log(`   Match: ${paymentApiUrl === 'https://payment-api.example.com' ? '✅' : '❌'}`);
  
  // Debug: Let's check what keys exist at different levels
  console.log('\n🔍 Debug: Available keys at different levels');
  console.log('Root keys:', Object.keys(adminConfig).sort());
  
  if (adminConfig.react) {
    console.log('react keys:', Object.keys(adminConfig.react).sort());
    if (adminConfig.react.app) {
      console.log('react.app keys:', Object.keys(adminConfig.react.app).sort());
    }
  }
  
  if (adminConfig.database) {
    console.log('database keys:', Object.keys(adminConfig.database).sort());
  }
  
  if (adminConfig.okta) {
    console.log('okta keys:', Object.keys(adminConfig.okta).sort());
  }
  
  if (adminConfig.payment) {
    console.log('payment keys:', Object.keys(adminConfig.payment).sort());
  }
}

async function debugGenericVsAppSpecificParsing() {
  console.log('\n🔍 Debug: Generic vs App-Specific Parsing');
  
  // Clear all variables first
  ['REACT_APP_TEST_GENERIC', 'REACT_APP_ADMIN_TEST_SPECIFIC'].forEach(key => {
    delete process.env[key];
  });
  
  const provider = new AppScopedConfigurationProvider();
  
  console.log('\n📝 Test 1: Generic REACT_APP_ Variable Only');
  process.env.REACT_APP_TEST_GENERIC = 'generic-value';
  
  provider.clearAllCaches();
  let config = await provider.getAppConfiguration('admin');
  
  console.log('Config after setting generic variable:');
  console.log(JSON.stringify(config, null, 2));
  
  const genericValue = config?.react?.app?.test?.generic;
  console.log(`Generic value found: "${genericValue}"`);
  console.log(`Expected: "generic-value"`);
  console.log(`Match: ${genericValue === 'generic-value' ? '✅' : '❌'}`);
  
  console.log('\n📝 Test 2: Adding App-Specific Variable (Should Override)');
  process.env.REACT_APP_ADMIN_TEST_GENERIC = 'admin-specific-value';
  
  provider.clearAllCaches();
  config = await provider.getAppConfiguration('admin');
  
  console.log('Config after adding app-specific variable:');
  console.log(JSON.stringify(config, null, 2));
  
  // The app-specific variable should be available as 'testgeneric'
  const appSpecificValue = config?.testgeneric;
  console.log(`App-specific value found: "${appSpecificValue}"`);
  console.log(`Expected: "admin-specific-value"`);
  console.log(`Match: ${appSpecificValue === 'admin-specific-value' ? '✅' : '❌'}`);
  
  // The generic value should still be there
  const stillGenericValue = config?.react?.app?.test?.generic;
  console.log(`Generic value still there: "${stillGenericValue}"`);
  console.log(`Expected: "generic-value"`);
  console.log(`Match: ${stillGenericValue === 'generic-value' ? '✅' : '❌'}`);
  
  // Clean up
  delete process.env.REACT_APP_TEST_GENERIC;
  delete process.env.REACT_APP_ADMIN_TEST_GENERIC;
}

async function debugTransformationLogic() {
  console.log('\n🔍 Debug: Variable Name Transformation Logic');
  
  // Test different transformation scenarios
  const testCases = [
    { input: 'REACT_APP_SIMPLE', expected: 'simple', description: 'Simple variable' },
    { input: 'REACT_APP_WITH_UNDERSCORE', expected: 'withunderscore', description: 'Variable with underscore' },
    { input: 'REACT_APP_WITH__DOUBLE__UNDERSCORE', expected: 'with.double.underscore', description: 'Variable with double underscore (nesting)' },
    { input: 'REACT_APP_ADMIN_SPECIFIC_CONFIG', appId: 'admin', expected: 'specificconfig', description: 'App-specific variable' },
  ];
  
  const provider = new AppScopedConfigurationProvider();
  
  for (const test of testCases) {
    console.log(`\n📝 Testing: ${test.description}`);
    console.log(`Input: ${test.input}`);
    console.log(`Expected: ${test.expected}`);
    
    // Clear environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('REACT_APP_TEST_')) {
        delete process.env[key];
      }
    });
    
    // Set the test variable
    process.env[test.input] = 'test-value';
    
    provider.clearAllCaches();
    const config = await provider.getAppConfiguration(test.appId || 'test');
    
    // Try to find the transformed value
    const value = getValueByPath(config, test.expected);
    
    console.log(`Found value: "${value}"`);
    console.log(`Match: ${value === 'test-value' ? '✅' : '❌'}`);
    
    if (value !== 'test-value') {
      console.log('Full config structure:');
      console.log(JSON.stringify(config, null, 2));
    }
    
    delete process.env[test.input];
  }
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

async function runPatternMatchingDebug() {
  console.log('🚀 Starting Pattern Matching Debug');
  console.log('=' .repeat(60));
  
  try {
    debugEnvironmentVariableProcessing();
    await debugConfigurationParsing();
    await debugGenericVsAppSpecificParsing();
    await debugTransformationLogic();
    
    console.log('\n🎉 Pattern Matching Debug Completed');
    
  } catch (error) {
    console.error('💥 Debug failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
  
  // Clean up all test variables
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('REACT_APP_') && key.includes('TEST')) {
      delete process.env[key];
    }
  });
  
  ['DATABASE_URL', 'OKTA_CLIENT_ID', 'PAYMENT_API_URL'].forEach(key => {
    if (process.env[key] && process.env[key].includes('test')) {
      delete process.env[key];
    }
  });
}

if (require.main === module) {
  runPatternMatchingDebug()
    .then(() => {
      console.log('\n✅ Debug completed');
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runPatternMatchingDebug };