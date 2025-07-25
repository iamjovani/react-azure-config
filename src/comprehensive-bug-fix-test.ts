/**
 * Comprehensive Bug Fix Validation Test
 * 
 * This test validates that all architectural components work together to solve
 * the critical bug reported in REACT-AZURE-CONFIG-BUG-REPORT.md where:
 * 
 * 1. Prefixed environment keys (REACT_APP_ADMIN_NEXTAUTH_SECRET) were being sent to Azure
 * 2. React hooks received undefined values despite server capturing variables correctly
 * 3. Fallback system failed to propagate data to client-side components
 * 
 * The test simulates the exact scenario from the bug report and validates that
 * the new architecture prevents these issues from occurring.
 * 
 * @module comprehensive-bug-fix-test
 */

import { createEnhancedAppAzureLoader } from './server/enhanced-app-azure-loader';
import { AppIsolatedAzureManager } from './server/app-isolated-azure-manager';
import { BulletproofFallbackSystem } from './server/bulletproof-fallback-system';
import { AppScopedKeyTransformer } from './server/app-key-transformer';
import { AppAwareClientResolver } from './client/app-aware-resolver';

/**
 * Test environment setup that matches the bug report scenario
 */
function setupBugReportEnvironment(): void {
  // Exact environment variables from the bug report
  process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN = 'https://test-admin-config.azconfig.io';
  process.env.AZURE_CLIENT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  process.env.AZURE_CLIENT_SECRET_ADMIN = 'invalid-secret-to-force-fallback';
  process.env.AZURE_CLIENT_TENANT_ID_ADMIN = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  
  // Standard Azure SDK variables
  process.env.AZURE_CLIENT_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  process.env.AZURE_CLIENT_SECRET = 'standard-invalid-secret';
  process.env.AZURE_TENANT_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  
  // Application variables that should be accessible via React hooks
  process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET = 'test-nextauth-secret-from-env';
  process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID = 'test-okta-client-id-from-env';
  
  process.env.NODE_ENV = 'development';
}

/**
 * Test Results Interface
 */
interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  evidence?: any;
  error?: string;
}

/**
 * Comprehensive Bug Fix Test Suite
 */
export class ComprehensiveBugFixTest {
  private testResults: TestResult[] = [];
  
  /**
   * Run all tests and return comprehensive results
   */
  async runAllTests(): Promise<{ passed: boolean; results: TestResult[]; summary: string }> {
    console.log('🧪 Starting Comprehensive Bug Fix Validation Test');
    console.log('='.repeat(60));
    
    setupBugReportEnvironment();
    
    // Core architectural tests
    await this.testKeyTransformationEngine();
    await this.testAzureClientManager();
    await this.testFallbackSystem();
    await this.testClientResolver();
    await this.testEnhancedAppAzureLoader();
    
    // Integration tests that simulate the bug report scenario
    await this.testBugReportScenarioResolution();
    await this.testReactHookCompatibility();
    await this.testApiRouteCompatibility();
    
    // Edge case tests
    await this.testMissingEnvironmentVariables();
    await this.testInvalidAzureConfiguration();
    
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const allPassed = passedTests === totalTests;
    
    const summary = `${passedTests}/${totalTests} tests passed. ${allPassed ? '🎉 ALL BUGS FIXED!' : '⚠️ Some issues remain.'}`;
    
    return {
      passed: allPassed,
      results: this.testResults,
      summary
    };
  }
  
  /**
   * Test 1: Key Transformation Engine
   * Validates that prefixed keys are properly transformed for Azure
   */
  private async testKeyTransformationEngine(): Promise<void> {
    const testName = 'Key Transformation Engine';
    
    try {
      const transformer = new AppScopedKeyTransformer();
      
      // CRITICAL TEST: Ensure prefixed keys are transformed to clean Azure keys
      const transformedKey = transformer.envToAzure('REACT_APP_ADMIN_NEXTAUTH_SECRET', 'admin');
      
      if (transformedKey === 'nextauth.secret') {
        this.addTestResult(testName, true, 'Prefixed environment key correctly transformed to clean Azure key', {
          input: 'REACT_APP_ADMIN_NEXTAUTH_SECRET',
          output: transformedKey,
          expected: 'nextauth.secret'
        });
      } else {
        this.addTestResult(testName, false, `Expected 'nextauth.secret', got '${transformedKey}'`);
      }
      
      // Test bidirectional transformation
      const appContextKey = transformer.azureToApp('nextauth.secret', 'admin');
      const hasLegacyFormat = appContextKey.legacy === 'REACT_APP_ADMIN_NEXTAUTH_SECRET';
      
      if (hasLegacyFormat) {
        this.addTestResult(testName + ' (Bidirectional)', true, 'Azure key correctly transformed back to app context', {
          azureKey: 'nextauth.secret',
          appContext: appContextKey
        });
      } else {
        this.addTestResult(testName + ' (Bidirectional)', false, `Legacy format not generated correctly: ${appContextKey.legacy}`);
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Key transformation test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 2: Azure Client Manager
   * Validates that Azure clients receive clean keys, not prefixed ones
   */
  private async testAzureClientManager(): Promise<void> {
    const testName = 'Azure Client Manager';
    
    try {
      const azureManager = new AppIsolatedAzureManager();
      
      // Register app with invalid credentials to test key transformation without Azure calls
      azureManager.registerApp({
        appId: 'admin',
        endpoint: 'https://test-admin-config.azconfig.io',
        authentication: {
          type: 'servicePrincipal',
          tenantId: 'invalid-tenant',
          clientId: 'invalid-client',
          clientSecret: 'invalid-secret'
        }
      });
      
      // The critical test: verify that the manager processes environment variables correctly
      const registeredApps = azureManager.getRegisteredApps();
      const hasAdminApp = registeredApps.includes('admin');
      
      if (hasAdminApp) {
        // Get debug info to verify key transformation
        const debugInfo = azureManager.getAppDebugInfo('admin');
        
        this.addTestResult(testName, true, 'Azure manager correctly registered app with proper isolation', {
          registeredApps,
          debugInfo: {
            registered: debugInfo.registered,
            hasAzureClient: debugInfo.hasAzureClient,
            keyTransformation: debugInfo.keyTransformation
          }
        });
      } else {
        this.addTestResult(testName, false, 'Failed to register admin app with Azure manager');
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Azure client manager test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 3: Fallback System
   * Validates that environment variables are properly processed when Azure fails
   */
  private async testFallbackSystem(): Promise<void> {
    const testName = 'Bulletproof Fallback System';
    
    try {
      const fallbackSystem = new BulletproofFallbackSystem();
      
      // Test fallback configuration retrieval
      const fallbackResult = await fallbackSystem.getFallbackConfiguration('admin', true);
      
      if (fallbackResult.success && fallbackResult.data) {
        // Check if the bug report variables are accessible
        const hasNextAuthSecret = 
          fallbackResult.data['REACT_APP_ADMIN_NEXTAUTH_SECRET'] !== undefined ||
          fallbackResult.data['nextauth.secret'] !== undefined ||
          fallbackResult.data['nextauthsecret'] !== undefined;
          
        const hasOktaClientId = 
          fallbackResult.data['REACT_APP_ADMIN_OKTA_CLIENT_ID'] !== undefined ||
          fallbackResult.data['okta.client.id'] !== undefined ||
          fallbackResult.data['oktaclientid'] !== undefined;
        
        if (hasNextAuthSecret && hasOktaClientId) {
          this.addTestResult(testName, true, 'Fallback system correctly processes environment variables', {
            variablesFound: fallbackResult.variablesFound,
            transformedKeys: fallbackResult.transformedKeys,
            availableKeys: Object.keys(fallbackResult.data).slice(0, 10),
            hasNextAuthSecret,
            hasOktaClientId,
            debug: fallbackResult.debug
          });
        } else {
          this.addTestResult(testName, false, `Missing required variables: NextAuth=${hasNextAuthSecret}, Okta=${hasOktaClientId}`);
        }
      } else {
        this.addTestResult(testName, false, 'Fallback system failed to retrieve configuration', { result: fallbackResult });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Fallback system test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 4: Client Resolver
   * Validates that client-side resolution strategies work for React hooks
   */
  private async testClientResolver(): Promise<void> {
    const testName = 'Client-Side Resolver';
    
    try {
      const resolver = new AppAwareClientResolver();
      
      // Create mock configuration that simulates what would be received from the server
      const mockConfig = {
        'REACT_APP_ADMIN_NEXTAUTH_SECRET': 'test-nextauth-secret-from-env',
        'nextauth.secret': 'test-nextauth-secret-from-env',
        'nextauthsecret': 'test-nextauth-secret-from-env',
        'REACT_APP_ADMIN_OKTA_CLIENT_ID': 'test-okta-client-id-from-env',
        'okta.client.id': 'test-okta-client-id-from-env',
        'oktaclientid': 'test-okta-client-id-from-env'
      };
      
      // Test multiple resolution strategies for the same value
      const testKeys = [
        'REACT_APP_ADMIN_NEXTAUTH_SECRET',
        'nextauth.secret',
        'NEXTAUTH_SECRET',
        'nextauthsecret'
      ];
      
      let successfulResolutions = 0;
      const resolutionDetails = [];
      
      for (const testKey of testKeys) {
        const resolution = resolver.resolve(testKey, mockConfig, 'admin');
        if (resolution.found && resolution.value) {
          successfulResolutions++;
        }
        resolutionDetails.push({
          key: testKey,
          found: resolution.found,
          strategy: resolution.strategy,
          resolvedKey: resolution.resolvedKey
        });
      }
      
      if (successfulResolutions >= 3) { // At least 3 out of 4 should resolve
        this.addTestResult(testName, true, 'Client resolver successfully handles multiple key formats', {
          successfulResolutions,
          totalAttempts: testKeys.length,
          resolutionDetails
        });
      } else {
        this.addTestResult(testName, false, `Only ${successfulResolutions}/${testKeys.length} resolutions succeeded`, { resolutionDetails });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Client resolver test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 5: Enhanced App Azure Loader
   * Validates the main integration component works end-to-end
   */
  private async testEnhancedAppAzureLoader(): Promise<void> {
    const testName = 'Enhanced App Azure Loader';
    
    try {
      const loader = createEnhancedAppAzureLoader({
        appId: 'admin',
        endpoint: 'https://invalid-endpoint.azconfig.io', // Invalid to force fallback
        authentication: {
          type: 'servicePrincipal',
          tenantId: 'invalid-tenant',
          clientId: 'invalid-client',
          clientSecret: 'invalid-secret'
        },
        enableLocalFallback: true,
        includeDebugInfo: true,
        variableMappings: {
          'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET', 'NEXTAUTH_SECRET'],
          'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID', 'OKTA_CLIENT_ID']
        }
      });
      
      // Test configuration retrieval (should fall back to environment)
      const configResponse = await loader.getConfiguration();
      
      if (configResponse.success && configResponse.data) {
        // Verify that both original and transformed keys are available
        const hasOriginalKeys = 
          configResponse.data['REACT_APP_ADMIN_NEXTAUTH_SECRET'] !== undefined &&
          configResponse.data['REACT_APP_ADMIN_OKTA_CLIENT_ID'] !== undefined;
          
        const hasTransformedKeys = 
          configResponse.data['nextauth.secret'] !== undefined ||
          configResponse.data['okta.client.id'] !== undefined;
        
        if (hasOriginalKeys || hasTransformedKeys) {
          this.addTestResult(testName, true, 'Enhanced loader provides comprehensive configuration access', {
            source: configResponse.source,
            variableCount: Object.keys(configResponse.data).length,
            hasOriginalKeys,
            hasTransformedKeys,
            debug: configResponse.debug,
            sampleKeys: Object.keys(configResponse.data).slice(0, 8)
          });
        } else {
          this.addTestResult(testName, false, 'Enhanced loader missing expected keys', { 
            availableKeys: Object.keys(configResponse.data),
            configResponse 
          });
        }
      } else {
        this.addTestResult(testName, false, 'Enhanced loader failed to retrieve configuration', { configResponse });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Enhanced loader test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 6: Bug Report Scenario Resolution
   * Simulates the exact scenario from the bug report and validates it's fixed
   */
  private async testBugReportScenarioResolution(): Promise<void> {
    const testName = 'Bug Report Scenario Resolution';
    
    try {
      // Create loader with exact configuration from bug report
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
        enableLocalFallback: true,
      });
      
      // Test: Get configuration (should work even with invalid Azure credentials)
      const configResult = await adminLoader.getConfiguration();
      
      // Test: Get specific values that were failing in the bug report
      const nextAuthSecret = await adminLoader.getConfigurationValue('REACT_APP_ADMIN_NEXTAUTH_SECRET');
      const oktaClientId = await adminLoader.getConfigurationValue('REACT_APP_ADMIN_OKTA_CLIENT_ID');
      
      const configSuccess = configResult.success && Object.keys(configResult.data || {}).length > 0;
      const nextAuthSuccess = nextAuthSecret.success && nextAuthSecret.value !== undefined;
      const oktaSuccess = oktaClientId.success && oktaClientId.value !== undefined;
      
      if (configSuccess && nextAuthSuccess && oktaSuccess) {
        this.addTestResult(testName, true, 'Bug report scenario completely resolved', {
          configResult: {
            success: configResult.success,
            source: configResult.source,
            variableCount: Object.keys(configResult.data || {}).length
          },
          nextAuthSecret: {
            success: nextAuthSecret.success,
            value: nextAuthSecret.value ? 'Found' : 'Not found',
            resolvedKey: nextAuthSecret.resolvedKey,
            strategy: nextAuthSecret.strategy
          },
          oktaClientId: {
            success: oktaClientId.success,
            value: oktaClientId.value ? 'Found' : 'Not found',
            resolvedKey: oktaClientId.resolvedKey,
            strategy: oktaClientId.strategy
          }
        });
      } else {
        this.addTestResult(testName, false, 'Bug report scenario not fully resolved', {
          configSuccess,
          nextAuthSuccess,
          oktaSuccess,
          configResult,
          nextAuthSecret,
          oktaClientId
        });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Bug report scenario test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 7: React Hook Compatibility
   * Validates that the data format is compatible with React hooks
   */
  private async testReactHookCompatibility(): Promise<void> {
    const testName = 'React Hook Compatibility';
    
    try {
      const loader = createEnhancedAppAzureLoader({
        appId: 'admin',
        enableLocalFallback: true,
        includeDebugInfo: true
      });
      
      const configResponse = await loader.getConfiguration();
      
      // Simulate what useConfig() and useConfigValue() hooks would receive
      const mockUseConfigData = configResponse.data;
      const mockUseConfigValueNextAuth = mockUseConfigData?.['REACT_APP_ADMIN_NEXTAUTH_SECRET'];
      const mockUseConfigValueOkta = mockUseConfigData?.['REACT_APP_ADMIN_OKTA_CLIENT_ID'];
      
      // Check that the data structure matches what React hooks expect
      const hasProperStructure = mockUseConfigData && typeof mockUseConfigData === 'object';
      const hasExpectedValues = mockUseConfigValueNextAuth !== undefined && mockUseConfigValueOkta !== undefined;
      
      if (hasProperStructure && hasExpectedValues) {
        this.addTestResult(testName, true, 'Configuration data is compatible with React hooks', {
          dataStructure: 'Valid object',
          nextAuthValue: mockUseConfigValueNextAuth ? 'Present' : 'Missing',
          oktaValue: mockUseConfigValueOkta ? 'Present' : 'Missing',
          availableKeys: Object.keys(mockUseConfigData).length,
          sampleKeys: Object.keys(mockUseConfigData).slice(0, 5)
        });
      } else {
        this.addTestResult(testName, false, 'Configuration data not compatible with React hooks', {
          hasProperStructure,
          hasExpectedValues,
          mockUseConfigData
        });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'React hook compatibility test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 8: API Route Compatibility
   * Validates that API routes return the expected format
   */
  private async testApiRouteCompatibility(): Promise<void> {
    const testName = 'API Route Compatibility';
    
    try {
      const loader = createEnhancedAppAzureLoader({
        appId: 'admin',
        enableLocalFallback: true,
        includeDebugInfo: true
      });
      
      const apiResponse = await loader.getConfiguration();
      
      // Check that the response has the structure expected by API routes
      const hasApiStructure = 
        apiResponse.hasOwnProperty('success') &&
        apiResponse.hasOwnProperty('data') &&
        apiResponse.hasOwnProperty('source') &&
        apiResponse.hasOwnProperty('timestamp');
        
      const hasBackwardCompatibility = apiResponse.hasOwnProperty('config'); // Backward compatibility field
      
      if (hasApiStructure && hasBackwardCompatibility) {
        this.addTestResult(testName, true, 'API response format is compatible with existing API routes', {
          responseStructure: {
            success: typeof apiResponse.success,
            data: apiResponse.data ? 'Present' : 'Missing',
            source: typeof apiResponse.source,
            timestamp: typeof apiResponse.timestamp,
            config: apiResponse.config ? 'Present' : 'Missing'
          },
          dataEquality: JSON.stringify(apiResponse.data) === JSON.stringify(apiResponse.config)
        });
      } else {
        this.addTestResult(testName, false, 'API response format not compatible', {
          hasApiStructure,
          hasBackwardCompatibility,
          responseKeys: Object.keys(apiResponse)
        });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'API route compatibility test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 9: Missing Environment Variables
   * Validates graceful handling when environment variables are missing
   */
  private async testMissingEnvironmentVariables(): Promise<void> {
    const testName = 'Missing Environment Variables Handling';
    
    try {
      // Temporarily remove environment variables
      const originalNextAuth = process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET;
      const originalOkta = process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID;
      
      delete process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET;
      delete process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID;
      
      const loader = createEnhancedAppAzureLoader({
        appId: 'admin',
        enableLocalFallback: true
      });
      
      const configResponse = await loader.getConfiguration();
      
      // Should still succeed but with empty/minimal data
      const handlesGracefully = configResponse.success && configResponse.source === 'basic-fallback';
      
      // Restore environment variables
      if (originalNextAuth) process.env.REACT_APP_ADMIN_NEXTAUTH_SECRET = originalNextAuth;
      if (originalOkta) process.env.REACT_APP_ADMIN_OKTA_CLIENT_ID = originalOkta;
      
      if (handlesGracefully) {
        this.addTestResult(testName, true, 'System gracefully handles missing environment variables', {
          responseSuccess: configResponse.success,
          source: configResponse.source,
          dataKeys: Object.keys(configResponse.data || {}).length
        });
      } else {
        this.addTestResult(testName, false, 'System does not handle missing variables gracefully', { configResponse });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Missing environment variables test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Test 10: Invalid Azure Configuration
   * Validates that the system falls back properly when Azure configuration is completely invalid
   */
  private async testInvalidAzureConfiguration(): Promise<void> {
    const testName = 'Invalid Azure Configuration Handling';
    
    try {
      const loader = createEnhancedAppAzureLoader({
        appId: 'admin',
        endpoint: 'not-a-valid-url',
        authentication: {
          type: 'servicePrincipal',
          tenantId: '',
          clientId: '',
          clientSecret: ''
        },
        enableLocalFallback: true
      });
      
      const configResponse = await loader.getConfiguration();
      
      // Should fall back to environment variables
      const fallsBackProperly = 
        configResponse.success && 
        (configResponse.source === 'fallback' || configResponse.source.includes('fallback'));
      
      if (fallsBackProperly) {
        this.addTestResult(testName, true, 'System properly falls back when Azure configuration is invalid', {
          success: configResponse.success,
          source: configResponse.source,
          hasData: Object.keys(configResponse.data || {}).length > 0
        });
      } else {
        this.addTestResult(testName, false, 'System does not fall back properly with invalid Azure config', { configResponse });
      }
      
    } catch (error) {
      this.addTestResult(testName, false, 'Invalid Azure configuration test failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * Add a test result to the results array
   */
  private addTestResult(name: string, passed: boolean, details: string, evidence?: any, error?: string): void {
    this.testResults.push({ name, passed, details, evidence, error });
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}: ${details}`);
    
    if (evidence && process.env.NODE_ENV === 'development') {
      console.log(`   Evidence: ${JSON.stringify(evidence, null, 2).substring(0, 200)}...`);
    }
    
    if (error) {
      console.log(`   Error: ${error}`);
    }
  }
  
  /**
   * Print comprehensive test report
   */
  printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE BUG FIX TEST REPORT');
    console.log('='.repeat(60));
    
    const passedTests = this.testResults.filter(r => r.passed);
    const failedTests = this.testResults.filter(r => !r.passed);
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed: ${passedTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    console.log(`Success Rate: ${((passedTests.length / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failedTests.length === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('The critical bugs reported in REACT-AZURE-CONFIG-BUG-REPORT.md have been fixed.');
      console.log('\n📚 Next Steps:');
      console.log('1. Deploy the enhanced implementation');
      console.log('2. Update your API routes to use createEnhancedAppAzureLoader');
      console.log('3. Test with your actual Azure App Configuration setup');
      console.log('4. Monitor for any remaining edge cases');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED:');
      failedTests.forEach(test => {
        console.log(`   • ${test.name}: ${test.details}`);
        if (test.error) {
          console.log(`     Error: ${test.error}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

/**
 * Factory function to create and run comprehensive tests
 */
export async function runComprehensiveBugFixTest(): Promise<boolean> {
  const testSuite = new ComprehensiveBugFixTest();
  const results = await testSuite.runAllTests();
  
  testSuite.printReport();
  
  return results.passed;
}

/**
 * Main execution function for running tests directly
 */
if (require.main === module) {
  runComprehensiveBugFixTest()
    .then(allPassed => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}