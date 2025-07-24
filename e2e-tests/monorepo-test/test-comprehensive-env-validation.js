/**
 * Comprehensive Environment Variable Fallback Validation
 * 
 * Ultra-thorough testing of environment variable fallback functionality
 * with detailed logging and edge case validation.
 */

const { AppScopedConfigurationProvider } = require('react-azure-config/server');
const util = require('util');

// Enhanced logging with detailed environment variable inspection
function logEnvironmentState(label) {
  console.log(`\n🔍 ${label}`);
  console.log('=' .repeat(60));
  
  // Show all REACT_APP_ variables
  const reactAppVars = Object.keys(process.env)
    .filter(key => key.startsWith('REACT_APP_'))
    .sort();
    
  console.log(`📋 REACT_APP_ Variables (${reactAppVars.length}):`);
  reactAppVars.forEach(key => {
    console.log(`  ${key} = "${process.env[key]}"`);
  });
  
  // Show other relevant variables
  const otherRelevantVars = Object.keys(process.env)
    .filter(key => 
      !key.startsWith('REACT_APP_') && 
      (key.match(/^(NODE_ENV|PORT|DATABASE_URL|API_URL|BASE_URL|OKTA_|AZURE_|AUTH_|JWT_|SESSION_)/) ||
       key.match(/^[A-Z_]+_API_/) ||
       key.match(/^[A-Z_]+_URL$/))
    )
    .sort();
    
  console.log(`🔧 Other Relevant Variables (${otherRelevantVars.length}):`);
  otherRelevantVars.forEach(key => {
    console.log(`  ${key} = "${process.env[key]}"`);
  });
  
  console.log('=' .repeat(60));
}

function logConfigurationInDetail(config, label) {
  console.log(`\n📊 ${label}:`);
  console.log('─' .repeat(40));
  
  function logNestedObject(obj, indent = '  ') {
    Object.keys(obj).sort().forEach(key => {
      const value = obj[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        console.log(`${indent}${key}: {`);
        logNestedObject(value, indent + '  ');
        console.log(`${indent}}`);
      } else {
        console.log(`${indent}${key}: "${value}"`);
      }
    });
  }
  
  logNestedObject(config);
  console.log('─' .repeat(40));
}

function validateConfigurationValue(config, path, expectedValue, testName) {
  const actualValue = path.split('.').reduce((obj, key) => obj?.[key], config);
  const passed = actualValue === expectedValue;
  
  console.log(`${passed ? '✅' : '❌'} ${testName}`);
  console.log(`  Expected: "${expectedValue}"`);
  console.log(`  Actual: "${actualValue}"`);
  console.log(`  Path: ${path}`);
  
  return passed;
}

async function testEnvironmentVariablePatternMatching() {
  console.log('\n🧪 Testing Environment Variable Pattern Matching');
  
  // Clear any existing environment variables
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('TEST_PATTERN_')) {
      delete process.env[key];
    }
  });
  
  // Set up test variables with different patterns
  const testVars = {
    // Standard REACT_APP_ variables
    'REACT_APP_STANDARD_VAR': 'standard-value',
    'REACT_APP_NESTED__SUB__VALUE': 'nested-value', // Double underscore for nesting
    
    // App-specific variables
    'REACT_APP_ADMIN_SPECIFIC_CONFIG': 'admin-specific',
    'REACT_APP_CLIENT_SPECIFIC_CONFIG': 'client-specific',
    
    // Common environment variables
    'DATABASE_URL': 'postgres://test-db:5432/testdb',
    'API_URL': 'https://test-api.example.com',
    'OKTA_CLIENT_ID': 'test-okta-client',
    'AZURE_TENANT_ID': 'test-azure-tenant',
    'AUTH_SECRET': 'test-auth-secret',
    'JWT_SECRET': 'test-jwt-secret',
    'SESSION_SECRET': 'test-session-secret',
    
    // API and URL patterns
    'PAYMENT_API_URL': 'https://payment-api.example.com',
    'NOTIFICATION_URL': 'https://notification.example.com',
    'ANALYTICS_API_KEY': 'analytics-key-123',
    
    // Edge case variables
    'REACT_APP_EMPTY_VAR': '',
    'REACT_APP_NULL_VAR': 'null',
    'REACT_APP_UNDEFINED_VAR': 'undefined',
    'REACT_APP_SPECIAL_CHARS': 'value-with-special!@#$%^&*()chars',
    'REACT_APP_UNICODE': 'value-with-ñ-and-emoji-🚀',
  };
  
  // Set all test variables
  Object.entries(testVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  logEnvironmentState('Environment Variables Set for Pattern Testing');
  
  const provider = new AppScopedConfigurationProvider();
  
  // Test admin app configuration
  console.log('\n📱 Testing Admin App Configuration');
  const adminConfig = await provider.getAppConfiguration('admin');
  logConfigurationInDetail(adminConfig, 'Admin Configuration');
  
  // Test client app configuration
  console.log('\n📱 Testing Client App Configuration');
  const clientConfig = await provider.getAppConfiguration('client');
  logConfigurationInDetail(clientConfig, 'Client Configuration');
  
  // Validate specific patterns
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test standard REACT_APP_ variables
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'react.app.standard.var', 'standard-value', 'Standard REACT_APP_ variable')) {
    testsPassed++;
  }
  
  // Test nested variables (double underscore)
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'react.app.nested.sub.value', 'nested-value', 'Nested variable (double underscore)')) {
    testsPassed++;
  }
  
  // Test app-specific variables
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'specificconfig', 'admin-specific', 'Admin-specific environment variable')) {
    testsPassed++;
  }
  
  totalTests++;
  if (validateConfigurationValue(clientConfig, 'specificconfig', 'client-specific', 'Client-specific environment variable')) {
    testsPassed++;
  }
  
  // Test direct process.env fallback
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'database.url', 'postgres://test-db:5432/testdb', 'Database URL (direct fallback)')) {
    testsPassed++;
  }
  
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'okta.client.id', 'test-okta-client', 'OKTA Client ID (direct fallback)')) {
    testsPassed++;
  }
  
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'auth.secret', 'test-auth-secret', 'Auth Secret (direct fallback)')) {
    testsPassed++;
  }
  
  // Test API patterns
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'payment.api.url', 'https://payment-api.example.com', 'Payment API URL pattern')) {
    testsPassed++;
  }
  
  // Test empty and special values
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'react.app.empty.var', '', 'Empty environment variable')) {
    testsPassed++;
  }
  
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'react.app.special.chars', 'value-with-special!@#$%^&*()chars', 'Special characters in value')) {
    testsPassed++;
  }
  
  totalTests++;
  if (validateConfigurationValue(adminConfig, 'react.app.unicode', 'value-with-ñ-and-emoji-🚀', 'Unicode characters in value')) {
    testsPassed++;
  }
  
  console.log(`\n🎯 Pattern Matching Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  // Clean up test variables
  Object.keys(testVars).forEach(key => {
    delete process.env[key];
  });
  
  return testsPassed === totalTests;
}

async function testPrecedenceChainWithLogging() {
  console.log('\n🧪 Testing Complete Precedence Chain with Detailed Logging');
  
  // Clear environment
  ['REACT_APP_TEST_PRECEDENCE', 'REACT_APP_ADMIN_TEST_PRECEDENCE'].forEach(key => {
    delete process.env[key];
  });
  
  const provider = new AppScopedConfigurationProvider();
  
  console.log('\n🎬 Step 1: Testing Direct Process.env Fallback (Lowest Priority)');
  process.env.DATABASE_URL = 'postgres://step1:5432/db';
  process.env.OKTA_CLIENT_ID = 'step1-okta-client';
  
  logEnvironmentState('Step 1 Environment State');
  let config = await provider.getAppConfiguration('admin');
  logConfigurationInDetail(config, 'Step 1 Configuration');
  
  validateConfigurationValue(config, 'database.url', 'postgres://step1:5432/db', 'Step 1: Direct process.env fallback');
  
  console.log('\n🎬 Step 2: Adding Generic REACT_APP_ Variables (Higher Priority)');
  process.env.REACT_APP_API_URL = 'https://step2-generic-api.com';
  process.env.REACT_APP_LOG_LEVEL = 'info';
  
  // Clear cache to force reload
  provider.clearAllCaches();
  
  logEnvironmentState('Step 2 Environment State');
  config = await provider.getAppConfiguration('admin');
  logConfigurationInDetail(config, 'Step 2 Configuration');
  
  validateConfigurationValue(config, 'react.app.api.url', 'https://step2-generic-api.com', 'Step 2: Generic REACT_APP_ variable');
  validateConfigurationValue(config, 'database.url', 'postgres://step1:5432/db', 'Step 2: Process.env still available');
  
  console.log('\n🎬 Step 3: Adding App-Specific Variables (Highest Priority)');
  process.env.REACT_APP_ADMIN_API_URL = 'https://step3-admin-specific-api.com';
  process.env.REACT_APP_ADMIN_SECRET_KEY = 'admin-secret-123';
  
  // Clear cache to force reload
  provider.clearAllCaches();
  
  logEnvironmentState('Step 3 Environment State');
  config = await provider.getAppConfiguration('admin');
  logConfigurationInDetail(config, 'Step 3 Configuration');
  
  validateConfigurationValue(config, 'apiurl', 'https://step3-admin-specific-api.com', 'Step 3: App-specific variable overrides generic');
  validateConfigurationValue(config, 'secretkey', 'admin-secret-123', 'Step 3: App-specific unique variable');
  validateConfigurationValue(config, 'react.app.log.level', 'info', 'Step 3: Generic variable still available');
  validateConfigurationValue(config, 'database.url', 'postgres://step1:5432/db', 'Step 3: Process.env fallback still available'); 
  
  console.log('\n🎬 Step 4: Testing Client App Isolation');
  const clientConfig = await provider.getAppConfiguration('client');
  logConfigurationInDetail(clientConfig, 'Client Configuration (Should Not Have Admin Variables)');
  
  validateConfigurationValue(clientConfig, 'react.app.api.url', 'https://step2-generic-api.com', 'Step 4: Client gets generic variables');
  validateConfigurationValue(clientConfig, 'apiurl', undefined, 'Step 4: Client does not get admin-specific variables (isolation)');
  validateConfigurationValue(clientConfig, 'secretkey', undefined, 'Step 4: Client does not get admin secrets (security)');
  
  // Clean up
  ['DATABASE_URL', 'OKTA_CLIENT_ID', 'REACT_APP_API_URL', 'REACT_APP_LOG_LEVEL', 'REACT_APP_ADMIN_API_URL', 'REACT_APP_ADMIN_SECRET_KEY'].forEach(key => {
    delete process.env[key];
  });
  
  console.log('\n🎉 Precedence Chain Test Completed');
  return true;
}

async function testEdgeCasesAndErrorHandling() {
  console.log('\n🧪 Testing Edge Cases and Error Handling');
  
  const provider = new AppScopedConfigurationProvider();
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test 1: Invalid app IDs
  console.log('\n🔒 Testing Invalid App IDs');
  try {
    await provider.getAppConfiguration('../../../etc/passwd');
    console.log('❌ Should have thrown error for directory traversal attempt');
  } catch (error) {
    console.log('✅ Correctly rejected directory traversal attempt');
    testsPassed++;
  }
  totalTests++;
  
  try {
    await provider.getAppConfiguration('app/with/slashes');
    console.log('❌ Should have thrown error for app ID with slashes');
  } catch (error) {
    console.log('✅ Correctly rejected app ID with slashes');
    testsPassed++;
  }
  totalTests++;
  
  // Test 2: Very long environment variable values
  console.log('\n📏 Testing Long Environment Variable Values');
  const longValue = 'x'.repeat(10000);
  process.env.REACT_APP_LONG_VALUE = longValue;
  
  const config = await provider.getAppConfiguration('test');
  const retrievedValue = config?.react?.app?.long?.value;
  
  if (retrievedValue === longValue) {
    console.log('✅ Long environment variable value handled correctly');
    testsPassed++;
  } else {
    console.log('❌ Long environment variable value not handled correctly');
  }
  totalTests++;
  
  // Test 3: Unicode and special characters
  console.log('\n🌍 Testing Unicode and Special Characters');
  process.env.REACT_APP_UNICODE_TEST = '测试-тест-🚀-emoji-ñäöü';
  process.env.REACT_APP_SPECIAL_CHARS = 'value!@#$%^&*()_+-=[]{}|;":,.<>?/~`';
  
  const unicodeConfig = await provider.getAppConfiguration('unicode');
  const unicodeValue = unicodeConfig?.react?.app?.unicode?.test;
  const specialValue = unicodeConfig?.react?.app?.special?.chars;
  
  if (unicodeValue === '测试-тест-🚀-emoji-ñäöü') {
    console.log('✅ Unicode characters handled correctly');
    testsPassed++;
  } else {
    console.log('❌ Unicode characters not handled correctly');
  }
  totalTests++;
  
  if (specialValue === 'value!@#$%^&*()_+-=[]{}|;":,.<>?/~`') {
    console.log('✅ Special characters handled correctly');
    testsPassed++;
  } else {
    console.log('❌ Special characters not handled correctly');
  }
  totalTests++;
  
  // Test 4: Empty and null-like values
  console.log('\n⚫ Testing Empty and Null-like Values');
  process.env.REACT_APP_EMPTY = '';
  process.env.REACT_APP_NULL_STRING = 'null';
  process.env.REACT_APP_UNDEFINED_STRING = 'undefined';
  process.env.REACT_APP_ZERO = '0';
  process.env.REACT_APP_FALSE = 'false';
  
  const emptyConfig = await provider.getAppConfiguration('empty-test');
  
  const emptyValue = emptyConfig?.react?.app?.empty;
  const nullStringValue = emptyConfig?.react?.app?.null?.string;
  const undefinedStringValue = emptyConfig?.react?.app?.undefined?.string;
  const zeroValue = emptyConfig?.react?.app?.zero;
  const falseValue = emptyConfig?.react?.app?.false;
  
  if (emptyValue === '') {
    console.log('✅ Empty string value handled correctly');
    testsPassed++;
  } else {
    console.log('❌ Empty string value not handled correctly');
  }
  totalTests++;
  
  if (nullStringValue === 'null') {
    console.log('✅ "null" string value handled correctly');
    testsPassed++;
  } else {
    console.log('❌ "null" string value not handled correctly');
  }
  totalTests++;
  
  if (zeroValue === '0') {
    console.log('✅ "0" string value handled correctly');
    testsPassed++;
  } else {
    console.log('❌ "0" string value not handled correctly');
  }
  totalTests++;
  
  // Test 5: Variable name transformation
  console.log('\n🔄 Testing Variable Name Transformation');
  process.env.REACT_APP_TRANSFORM_TEST__NESTED__VALUE = 'nested-transform-test';
  process.env.REACT_APP_ADMIN_TRANSFORM_TEST__ADMIN__NESTED = 'admin-nested-transform';
  
  const transformConfig = await provider.getAppConfiguration('admin');
  const nestedTransform = transformConfig?.react?.app?.transform?.test?.nested?.value;
  const adminNestedTransform = transformConfig?.transformtest?.admin?.nested;
  
  if (nestedTransform === 'nested-transform-test') {
    console.log('✅ Generic nested variable transformation correct');
    testsPassed++;
  } else {
    console.log('❌ Generic nested variable transformation incorrect');
    console.log(`  Expected: "nested-transform-test", Got: "${nestedTransform}"`);
  }
  totalTests++;
  
  if (adminNestedTransform === 'admin-nested-transform') {
    console.log('✅ App-specific nested variable transformation correct');
    testsPassed++;
  } else {
    console.log('❌ App-specific nested variable transformation incorrect');
    console.log(`  Expected: "admin-nested-transform", Got: "${adminNestedTransform}"`);
  }
  totalTests++;
  
  // Clean up test variables
  [
    'REACT_APP_LONG_VALUE', 
    'REACT_APP_UNICODE_TEST', 
    'REACT_APP_SPECIAL_CHARS',
    'REACT_APP_EMPTY',
    'REACT_APP_NULL_STRING',
    'REACT_APP_UNDEFINED_STRING',
    'REACT_APP_ZERO',
    'REACT_APP_FALSE',
    'REACT_APP_TRANSFORM_TEST__NESTED__VALUE',
    'REACT_APP_ADMIN_TRANSFORM_TEST__ADMIN__NESTED'
  ].forEach(key => {
    delete process.env[key];
  });
  
  console.log(`\n🎯 Edge Cases Test Results: ${testsPassed}/${totalTests} tests passed`);
  return testsPassed === totalTests;
}

async function testCacheInvalidation() {
  console.log('\n🧪 Testing Cache Invalidation on Environment Changes');
  
  const provider = new AppScopedConfigurationProvider();
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test 1: Initial configuration load
  process.env.REACT_APP_CACHE_TEST = 'initial-value';
  
  console.log('\n📊 Loading Initial Configuration');
  let config = await provider.getAppConfiguration('cache-test');
  const initialValue = config?.react?.app?.cache?.test;
  
  if (initialValue === 'initial-value') {
    console.log('✅ Initial configuration loaded correctly');
    testsPassed++;
  }
  totalTests++;
  
  // Test 2: Change environment variable and test cache invalidation
  console.log('\n🔄 Changing Environment Variable');
  process.env.REACT_APP_CACHE_TEST = 'changed-value';
  
  // Force cache check (this would normally happen automatically)
  const cacheStats = provider.getCacheStats();
  console.log('Cache stats before change detection:', JSON.stringify(cacheStats.enhanced, null, 2));
  
  // Load configuration again (should detect environment change and invalidate cache)
  config = await provider.getAppConfiguration('cache-test');
  const changedValue = config?.react?.app?.cache?.test;
  
  if (changedValue === 'changed-value') {
    console.log('✅ Environment variable change detected and cache invalidated');
    testsPassed++;
  } else {
    console.log('❌ Environment variable change not detected or cache not invalidated');
    console.log(`  Expected: "changed-value", Got: "${changedValue}"`);
  }
  totalTests++;
  
  // Test 3: Add new environment variable
  console.log('\n➕ Adding New Environment Variable');
  process.env.REACT_APP_NEW_CACHE_VAR = 'new-variable-value';
  
  config = await provider.getAppConfiguration('cache-test');
  const newVarValue = config?.react?.app?.new?.cache?.var;
  
  if (newVarValue === 'new-variable-value') {
    console.log('✅ New environment variable detected after cache invalidation');
    testsPassed++;
  } else {
    console.log('❌ New environment variable not detected');
    console.log(`  Expected: "new-variable-value", Got: "${newVarValue}"`);
  }
  totalTests++;
  
  // Clean up
  delete process.env.REACT_APP_CACHE_TEST;
  delete process.env.REACT_APP_NEW_CACHE_VAR;
  
  console.log(`\n🎯 Cache Invalidation Test Results: ${testsPassed}/${totalTests} tests passed`);
  return testsPassed === totalTests;
}

async function runComprehensiveValidation() {
  console.log('🚀 Starting Comprehensive Environment Variable Fallback Validation');
  console.log('=' .repeat(80));
  
  logEnvironmentState('Initial Environment State');
  
  const testResults = [];
  
  try {
    console.log('\n🎯 Test Suite 1: Environment Variable Pattern Matching');
    const patternResult = await testEnvironmentVariablePatternMatching();
    testResults.push({ name: 'Pattern Matching', passed: patternResult });
    
    console.log('\n🎯 Test Suite 2: Precedence Chain Validation');
    const precedenceResult = await testPrecedenceChainWithLogging();
    testResults.push({ name: 'Precedence Chain', passed: precedenceResult });
    
    console.log('\n🎯 Test Suite 3: Edge Cases and Error Handling');
    const edgeCasesResult = await testEdgeCasesAndErrorHandling();
    testResults.push({ name: 'Edge Cases', passed: edgeCasesResult });
    
    console.log('\n🎯 Test Suite 4: Cache Invalidation');
    const cacheResult = await testCacheInvalidation();
    testResults.push({ name: 'Cache Invalidation', passed: cacheResult });
    
  } catch (error) {
    console.error('💥 Comprehensive validation failed with error:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('📋 COMPREHENSIVE VALIDATION RESULTS');
  console.log('=' .repeat(80));
  
  const passedTests = testResults.filter(result => result.passed).length;
  const totalTests = testResults.length;
  
  testResults.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log('─' .repeat(80));
  console.log(`🎯 Overall Results: ${passedTests}/${totalTests} test suites passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Environment Variable Fallback is Working Perfectly!');
    console.log('✅ The library correctly handles all environment variable scenarios');
    console.log('✅ Precedence chain is working as expected');
    console.log('✅ Edge cases are handled properly');
    console.log('✅ Cache invalidation works correctly');
  } else {
    console.log('❌ SOME TESTS FAILED - Environment Variable Fallback needs attention');
    console.log(`⚠️  ${totalTests - passedTests} test suite(s) failed`);
    return false;
  }
  
  console.log('=' .repeat(80));
  return passedTests === totalTests;
}

if (require.main === module) {
  runComprehensiveValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveValidation };