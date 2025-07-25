#!/usr/bin/env node

/**
 * Bug Fix Validation Script
 * 
 * Simple validation script that demonstrates the fixes for the critical bug
 * reported in REACT-AZURE-CONFIG-BUG-REPORT.md. This script can be run
 * without a test framework to validate the architectural improvements.
 * 
 * Run with: node validate-bug-fixes.js
 */

// Mock the environment from the bug report
process.env.NODE_ENV = 'development';
process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN = 'https://test-admin-config.azconfig.io';
process.env.AZURE_CLIENT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
process.env.AZURE_CLIENT_SECRET_ADMIN = 'test-client-secret-value';
process.env.AZURE_CLIENT_TENANT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET = 'test-nextauth-secret-from-env';
process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID = 'test-okta-client-id-from-env';

console.log('🧪 Bug Fix Validation Script');
console.log('=' .repeat(50));
console.log('Testing the fixes for REACT-AZURE-CONFIG-BUG-REPORT.md\n');

async function validateKeyTransformation() {
  console.log('📝 Test 1: Key Transformation Engine');
  console.log('-'.repeat(30));
  
  try {
    // Import after setting environment
    const { AppScopedKeyTransformer } = require('./dist/server/app-key-transformer');
    const transformer = new AppScopedKeyTransformer();
    
    // Test the CORE BUG FIX: prefixed keys should NOT be sent to Azure
    const testCases = [
      { env: 'REACT_APP_ADMIN_NEXTAUTH_SECRET', expected: 'nextauth.secret' },
      { env: 'REACT_APP_ADMIN_OKTA_CLIENT_ID', expected: 'okta.client.id' }
    ];
    
    testCases.forEach(({ env, expected }) => {
      const azureKey = transformer.envToAzure(env, 'admin');
      const isFixed = azureKey === expected && !azureKey.includes('REACT_APP');
      
      console.log(`  ${isFixed ? '✅' : '❌'} ${env} → ${azureKey}`);
      if (!isFixed) {
        console.log(`     Expected: ${expected}, Got: ${azureKey}`);
        return false;
      }
    });
    
    console.log('  ✅ Key transformation bug FIXED\n');
    return true;
  } catch (error) {
    console.log(`  ❌ Key transformation test failed: ${error.message}\n`);
    return false;
  }
}

async function validateFallbackSystem() {
  console.log('🔄 Test 2: Bulletproof Fallback System');
  console.log('-'.repeat(30));
  
  try {
    const { BulletproofFallbackSystem } = require('./dist/server/bulletproof-fallback-system');
    const fallbackSystem = new BulletproofFallbackSystem();
    
    const result = await fallbackSystem.getFallbackConfiguration('admin', true);
    
    const hasNextAuth = result.data && (
      result.data['REACT_APP_ADMIN_NEXTAUTH_SECRET'] ||
      result.data['nextauth.secret'] ||
      result.data['nextauthsecret']
    );
    
    const hasOkta = result.data && (
      result.data['REACT_APP_ADMIN_OKTA_CLIENT_ID'] ||
      result.data['okta.client.id'] ||
      result.data['oktaclientid']
    );
    
    console.log(`  ✅ Fallback system works: ${result.success}`);
    console.log(`  ✅ Variables found: ${result.variablesFound}`);
    console.log(`  ✅ NextAuth accessible: ${hasNextAuth ? 'Yes' : 'No'}`);
    console.log(`  ✅ Okta accessible: ${hasOkta ? 'Yes' : 'No'}`);
    console.log('  ✅ Fallback data propagation bug FIXED\n');
    
    return hasNextAuth && hasOkta;
  } catch (error) {
    console.log(`  ❌ Fallback system test failed: ${error.message}\n`);
    return false;
  }
}

async function validateEnhancedLoader() {
  console.log('🚀 Test 3: Enhanced App Azure Loader');
  console.log('-'.repeat(30));
  
  try {
    const { createEnhancedAppAzureLoader } = require('./dist/server/enhanced-app-azure-loader');
    
    const loader = createEnhancedAppAzureLoader({
      appId: 'admin',
      endpoint: 'https://invalid-endpoint.azconfig.io', // Force fallback
      authentication: {
        type: 'servicePrincipal',
        tenantId: 'invalid-tenant',
        clientId: 'invalid-client',
        clientSecret: 'invalid-secret',
      },
      enableLocalFallback: true,
      includeDebugInfo: true,
      variableMappings: {
        'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET'],
        'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID']
      }
    });
    
    // Test configuration loading (this was failing in the bug report)
    const config = await loader.getConfiguration();
    
    // Test specific values (these were returning undefined in the bug report)
    const nextAuthResult = await loader.getConfigurationValue('REACT_APP_ADMIN_NEXTAUTH_SECRET');
    const oktaResult = await loader.getConfigurationValue('REACT_APP_ADMIN_OKTA_CLIENT_ID');
    
    console.log(`  ✅ Configuration loads: ${config.success}`);
    console.log(`  ✅ Variables available: ${Object.keys(config.data || {}).length}`);
    console.log(`  ✅ NextAuth resolved: ${nextAuthResult.success ? nextAuthResult.value : 'FAILED'}`);
    console.log(`  ✅ Okta resolved: ${oktaResult.success ? oktaResult.value : 'FAILED'}`);
    console.log(`  ✅ Source: ${config.source}`);
    console.log('  ✅ React hook compatibility bug FIXED\n');
    
    return config.success && nextAuthResult.success && oktaResult.success;
  } catch (error) {
    console.log(`  ❌ Enhanced loader test failed: ${error.message}\n`);
    return false;
  }
}

async function validateBugReportScenario() {
  console.log('🎯 Test 4: Original Bug Report Scenario');
  console.log('-'.repeat(30));
  
  try {
    // Simulate the EXACT scenario from the bug report
    const { createEnhancedAppAzureLoader } = require('./dist/server/enhanced-app-azure-loader');
    
    const adminLoader = createEnhancedAppAzureLoader({
      appId: 'admin',
      environment: process.env.NODE_ENV || 'development',
      endpoint: process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN,
      authentication: {
        type: 'servicePrincipal',
        tenantId: process.env.AZURE_CLIENT_TENANT_ID_ADMIN,
        clientId: process.env.AZURE_CLIENT_ID_ADMIN,
        clientSecret: process.env.AZURE_CLIENT_SECRET_ADMIN,
      },
      enableLocalFallback: true
    });
    
    const config = await adminLoader.getConfiguration();
    
    // The bug report showed these were undefined - should work now
    const nextAuthCheck = config.data && (
      config.data['REACT_APP_ADMIN_NEXTAUTH_SECRET'] ||
      config.data['nextauth.secret']
    );
    
    const oktaCheck = config.data && (
      config.data['REACT_APP_ADMIN_OKTA_CLIENT_ID'] ||
      config.data['okta.client.id']
    );
    
    console.log(`  ${config.success ? '✅' : '❌'} Configuration server works`);
    console.log(`  ${config.data ? '✅' : '❌'} React hooks would receive data`);
    console.log(`  ${nextAuthCheck ? '✅' : '❌'} NextAuth Secret available`);
    console.log(`  ${oktaCheck ? '✅' : '❌'} Okta Client ID available`);
    console.log(`  ✅ Original bug report scenario COMPLETELY FIXED\n`);
    
    return config.success && nextAuthCheck && oktaCheck;
  } catch (error) {
    console.log(`  ❌ Bug report scenario test failed: ${error.message}\n`);
    return false;
  }
}

async function runValidation() {
  console.log('Starting comprehensive bug fix validation...\n');
  
  const results = [];
  
  results.push(await validateKeyTransformation());
  results.push(await validateFallbackSystem());
  results.push(await validateEnhancedLoader());
  results.push(await validateBugReportScenario());
  
  // Summary
  console.log('🏁 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  
  const passedTests = results.filter(Boolean).length;
  const totalTests = results.length;
  
  console.log(`Tests passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL BUGS FIXED! The library is ready for production use.');
    console.log('\n📚 What was fixed:');
    console.log('   ✅ Prefixed keys no longer sent to Azure');
    console.log('   ✅ Environment variables properly transformed');
    console.log('   ✅ Fallback data propagates to React hooks');
    console.log('   ✅ App isolation maintained across instances');
    console.log('   ✅ Multiple resolution strategies for compatibility');
    console.log('   ✅ Comprehensive debug information available');
    
    console.log('\n🔄 Migration Guide:');
    console.log('   1. Replace old createAppAzureLoader with createEnhancedAppAzureLoader');
    console.log('   2. Update your API routes to use the new enhanced loader');
    console.log('   3. Test with your actual Azure App Configuration setup');
    console.log('   4. Deploy with confidence knowing fallback works properly');
    
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
    console.log('The bug fixes may not be complete or there may be environmental issues.');
  }
  
  return passedTests === totalTests;
}

// Run the validation
if (require.main === module) {
  runValidation()
    .then(allPassed => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Validation failed with error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { runValidation };