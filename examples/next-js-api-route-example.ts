/**
 * Example Next.js API Route Implementation
 * 
 * This example shows how to properly use the enhanced createAppAzureLoader
 * in Next.js API routes to fix the issues described in the bug report.
 * 
 * File: apps/admin/app/api/config/[appId]/route.ts
 */

import { createAppAzureLoader } from 'react-azure-config/server';

// Create the enhanced Azure loader for the admin app
const adminLoader = createAppAzureLoader({
  appId: 'admin',
  environment: process.env.NODE_ENV || 'development',
  // Azure configuration with app-specific environment variables
  endpoint: process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN,
  authentication: {
    type: 'servicePrincipal',
    tenantId: process.env.AZURE_CLIENT_TENANT_ID_ADMIN || process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID_ADMIN || process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET_ADMIN || process.env.AZURE_CLIENT_SECRET,
  },
  // Enhanced fallback configuration
  enableLocalFallback: true,
  variableMappings: {
    // Map Azure keys to environment variable names
    'nextauth.secret': ['REACT_APP_ADMIN_NEXTAUTH_SECRET', 'NEXTAUTH_SECRET'],
    'okta.client.id': ['REACT_APP_ADMIN_OKTA_CLIENT_ID', 'OKTA_CLIENT_ID'],
    'okta.client.secret': ['REACT_APP_ADMIN_OKTA_CLIENT_SECRET', 'OKTA_CLIENT_SECRET'],
    'okta.issuer': ['REACT_APP_ADMIN_OKTA_ISSUER', 'OKTA_ISSUER'],
    'api.url': ['REACT_APP_ADMIN_API_URL', 'API_URL'],
    'database.url': ['REACT_APP_ADMIN_DATABASE_URL', 'DATABASE_URL']
  },
  includeDebugInfo: process.env.NODE_ENV === 'development'
});

// Handle GET requests for full configuration
export async function GET(
  request: Request,
  { params }: { params: { appId: string } }
) {
  try {
    const { appId } = params;
    
    // Validate appId matches our configured app
    if (appId !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid app ID: ${appId}`,
          timestamp: Date.now()
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get configuration using the enhanced loader
    const configResponse = await adminLoader.getConfiguration();
    
    return new Response(JSON.stringify(configResponse), {
      status: configResponse.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API route error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        source: 'api-error',
        timestamp: Date.now()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle POST requests for configuration refresh
export async function POST(
  request: Request,
  { params }: { params: { appId: string } }
) {
  try {
    const { appId } = params;
    
    if (appId !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid app ID: ${appId}`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Refresh configuration cache
    await adminLoader.refreshConfiguration();
    
    // Return fresh configuration
    const configResponse = await adminLoader.getConfiguration();
    
    return new Response(
      JSON.stringify({
        ...configResponse,
        refreshed: true
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('API route refresh error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
        timestamp: Date.now()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Example: Handle GET requests for specific configuration values
// File: apps/admin/app/api/config/[appId]/[key]/route.ts
export async function GET_VALUE(
  request: Request,
  { params }: { params: { appId: string; key: string } }
) {
  try {
    const { appId, key } = params;
    
    if (appId !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid app ID: ${appId}`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get specific configuration value
    const valueResponse = await adminLoader.getConfigurationValue(key);
    
    return new Response(JSON.stringify(valueResponse), {
      status: valueResponse.success ? 200 : 404,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API route value error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Value retrieval failed',
        timestamp: Date.now()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Alternative: Direct AzureEnvironmentLoader usage (backward compatibility)
 * 
 * If you prefer to use the original AzureEnvironmentLoader directly:
 */

// import { createAppAzureLoaderLegacy } from 'react-azure-config/server';
// 
// const legacyLoader = createAppAzureLoaderLegacy('admin', {
//   endpoint: process.env.AZURE_APP_CONFIG_ENDPOINT_ADMIN,
//   authentication: { /* ... */ }
// });
// 
// export async function GET_LEGACY() {
//   try {
//     const configResponse = await legacyLoader.getConfigurationForApi();
//     return new Response(JSON.stringify(configResponse), {
//       status: configResponse.success ? 200 : 500,
//       headers: { 'Content-Type': 'application/json' }
//     });
//   } catch (error) {
//     // Handle error...
//   }
// }

/**
 * React Component Usage Example
 * 
 * File: apps/admin/app/(primary-layout)/azure-test/page.tsx
 */

// 'use client';
// 
// import { ConfigProvider, useConfig, useConfigValue } from 'react-azure-config/client';
// 
// export default function AzureTestPage() {
//   return (
//     <ConfigProvider 
//       appId="admin"
//       configServiceUrl="/api/config/admin"  // Points to our enhanced API route
//       enableLocalFallback={true}
//     >
//       <ConfigurationDisplay />
//     </ConfigProvider>
//   );
// }
// 
// function ConfigurationDisplay() {
//   const { data, loading, error } = useConfig();
//   const nextAuthSecret = useConfigValue('REACT_APP_ADMIN_NEXTAUTH_SECRET');
//   const oktaClientId = useConfigValue('REACT_APP_ADMIN_OKTA_CLIENT_ID');
//   
//   if (loading) return <div>Loading configuration...</div>;
//   if (error) return <div>Error: {error}</div>;
//   
//   return (
//     <div>
//       <h2>Configuration Test</h2>
//       <p>NextAuth Secret: {nextAuthSecret || 'Not found'}</p>
//       <p>Okta Client ID: {oktaClientId || 'Not found'}</p>
//       <p>Total config keys: {data ? Object.keys(data).length : 0}</p>
//       <pre>{JSON.stringify(data, null, 2)}</pre>
//     </div>
//   );
// }

export { GET as default };