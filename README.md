# 🚀 react-azure-config

**Solve React's build-time environment variable problem!** Load configuration at runtime with embedded Express server. Same Docker image works across dev/staging/production.

[![npm version](https://badge.fury.io/js/react-azure-config.svg)](https://badge.fury.io/js/react-azure-config)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Created by [Jovani Samuels](https://github.com/iamjovani)**

## 🎯 The Problem This Solves

**React apps traditionally bake environment variables into JavaScript bundles at build time.** This means:
- ❌ Different Docker images needed for each environment
- ❌ Cannot change configuration without rebuilding
- ❌ Secrets exposed in frontend code
- ❌ Complex CI/CD pipeline

## ✅ The Solution

**Load configuration at runtime via embedded Express server:**
- ✅ Same Docker image works across all environments
- ✅ Environment variables loaded at runtime, not build time
- ✅ No secrets baked into JavaScript bundles
- ✅ True environment-agnostic deployment
- ✅ Azure App Configuration and Key Vault integration

## 📦 Installation

```bash
npm install react-azure-config
# or
yarn add react-azure-config
```

## 🌟 Framework Compatibility

**Full SSR (Server-Side Rendering) Support:**
- ✅ **Next.js** - App Router & Pages Router
- ✅ **Remix** - Hydration-safe components  
- ✅ **Gatsby** - SSG and SSR modes
- ✅ **Create React App** - Standard SPA mode
- ✅ **Vite** - All deployment targets

**Zero hydration errors** - Components render consistently between server and client, eliminating the common "Cannot read properties of undefined" errors in SSR applications.

## 🚀 Quick Start

### Basic Usage (Environment Variables Only)

This example shows how to load environment variables at runtime, solving the build-time baking problem:

```tsx
import React from 'react';
import { ConfigProvider, useConfig, useConfigValue } from 'react-azure-config';

function App() {
  return (
    <ConfigProvider
      options={{
        environment: 'production',
        useEmbeddedService: true, // Starts embedded Express server
        sources: ['environment', 'local', 'defaults'],
        enableLocalFallback: true
      }}
    >
      <MyComponent />
    </ConfigProvider>
  );
}

function MyComponent() {
  // Load specific configuration values
  const apiUrl = useConfigValue<string>('api.url', 'https://fallback-api.com');
  const appTitle = useConfigValue<string>('app.title', 'Default App');
  const timeout = useConfigValue<number>('api.timeout', 30000);
  const isDarkMode = useConfigValue<boolean>('features.darkMode', false);
  
  // Or load full configuration object
  const { data: config, loading, error } = useConfig();

  if (loading) return <div>Loading configuration...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>{appTitle}</h1>
      <p>API URL: {apiUrl}</p>
      <p>Timeout: {timeout}ms</p>
      <p>Dark Mode: {isDarkMode ? 'Enabled' : 'Disabled'}</p>
      
      <details>
        <summary>Full Configuration</summary>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </details>
    </div>
  );
}
```

**Environment Variables:**
```bash
# These are read at runtime, not build time!
REACT_APP_API_URL=https://api.example.com
REACT_APP_APP_TITLE=My Production App
REACT_APP_API_TIMEOUT=25000
REACT_APP_FEATURES_DARK_MODE=false
```

### Azure App Configuration + Application Insights Integration

Connect to Azure App Configuration for centralized configuration management with automatic Application Insights telemetry:

```tsx
import React from 'react';
import { ConfigProvider, useConfig } from 'react-azure-config';

function App() {
  return (
    <ConfigProvider
      options={{
        // Azure App Configuration
        endpoint: 'https://your-config.azconfig.io',
        environment: 'production',
        application: 'my-app',
        label: 'v1.0',
        
        // Authentication
        authentication: {
          type: 'servicePrincipal', // or 'managedIdentity' or 'azureCli'
          tenantId: process.env.AZURE_TENANT_ID,
          clientId: process.env.AZURE_CLIENT_ID,
          clientSecret: process.env.AZURE_CLIENT_SECRET
        },
        
        // Configuration hierarchy
        sources: ['azure', 'environment', 'local', 'defaults'],
        precedence: 'first-wins',
        
        // Key Vault integration
        keyVault: {
          enableKeyVaultReferences: true,
          secretCacheTtl: 3600000, // 1 hour
          maxRetries: 3
        },
        
        // Embedded server settings
        useEmbeddedService: true,
        port: 3001
      }}
    >
      <Dashboard />
    </ConfigProvider>
  );
}

function Dashboard() {
  const { data: config, loading, error, source, refresh } = useConfig();

  if (loading) return <div>Loading Azure configuration...</div>;
  if (error) return <div>Error loading config: {error}</div>;

  return (
    <div>
      <h1>Configuration Dashboard</h1>
      <p>Source: {source}</p>
      <button onClick={refresh}>Refresh Configuration</button>
      
      <h2>Database Settings</h2>
      <pre>{JSON.stringify(config?.database, null, 2)}</pre>
      
      <h2>Feature Flags</h2>
      <pre>{JSON.stringify(config?.features, null, 2)}</pre>
    </div>
  );
}
```

**Azure Environment Variables:**
```bash
# Azure authentication
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# Or use Managed Identity (recommended for Azure deployments)
# No secrets needed - authentication handled by Azure
```

### Next.js SSR Example

**Perfect for Next.js App Router and Pages Router:**

```tsx
// app/layout.tsx (App Router) or pages/_app.tsx (Pages Router)
import { ConfigProvider } from 'react-azure-config';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConfigProvider
          options={{
            environment: process.env.NODE_ENV || 'development',
            useEmbeddedService: true,
            sources: ['environment', 'defaults']
          }}
        >
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}

// app/page.tsx or pages/index.tsx
import { useConfigValue } from 'react-azure-config';

export default function HomePage() {
  // These load at runtime, not build time - perfect for SSR!
  const apiUrl = useConfigValue('api.url', 'https://localhost:3000');
  const appName = useConfigValue('app.name', 'My App');
  
  return (
    <div>
      <h1>{appName}</h1>
      <p>API: {apiUrl}</p>
      {/* Zero hydration errors - server and client render identically */}
    </div>
  );
}
```

## 📊 Application Insights Integration

**NEW in v0.3.2**: Full SSR support + Automatic Application Insights telemetry with Key Vault reference support!

### Automatic Initialization (Just like .NET!)

Store your Application Insights connection string as a **Key Vault reference** in Azure App Configuration - it gets automatically resolved and initialized:

```tsx
import React from 'react';
import { ConfigProvider, useAppInsights, useTrackEvent } from 'react-azure-config';

function App() {
  return (
    <ConfigProvider
      apiUrl="/api/config"
      // Application Insights auto-initializes when connection string is found!
      enableAutoInsights={true}
      applicationInsights={{
        enableAutoRouteTracking: true,
        enableReactPlugin: true
      }}
    >
      <Dashboard />
    </ConfigProvider>
  );
}

function Dashboard() {
  const { trackEvent, isReady } = useAppInsights();
  const trackUserAction = useTrackEvent();

  const handleButtonClick = () => {
    // Simple event tracking
    trackUserAction('dashboard_button_clicked', { 
      section: 'main',
      timestamp: Date.now() 
    });
    
    // Advanced event tracking  
    trackEvent({
      name: 'user_interaction',
      properties: { component: 'Dashboard', action: 'button_click' },
      measurements: { value: 1 }
    });
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Application Insights Status: {isReady ? 'Ready' : 'Not Ready'}</p>
      <button onClick={handleButtonClick}>Track This Click!</button>
    </div>
  );
}
```

### Azure Configuration Setup (Same as .NET Pattern!)

**Azure App Configuration:**
```
ApplicationInsights:ConnectionString = @Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/appinsights-connection/)
ApplicationInsights:EnableAutoRouteTracking = true  
ApplicationInsights:EnableCookiesUsage = false
ApplicationInsights:EnableRequestHeaderTracking = true
ApplicationInsights:EnableResponseHeaderTracking = false
```

**Environment Variables (Same as .NET):**
```bash
# Service Principal authentication (same as .NET DefaultAzureCredential pattern)
AZURE_CLIENT_ID=your-service-principal-id
AZURE_CLIENT_SECRET=your-service-principal-secret  
AZURE_TENANT_ID=your-tenant-id
AZURE_APP_CONFIG_ENDPOINT=https://your-config.azconfig.io

# Runtime environment 
REACT_APP_ENVIRONMENT=production
```

**Key Vault Secret (`appinsights-connection`):**
```
InstrumentationKey=12345678-1234-1234-1234-123456789abc;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=12345678-1234-1234-1234-123456789abc
```

### Advanced Telemetry Tracking

```tsx
import React, { useEffect } from 'react';
import { 
  useAppInsights, 
  useTrackException, 
  useTrackPerformance,
  useInsightsConfig 
} from 'react-azure-config';

function AdvancedComponent() {
  const { trackEvent, setContext, isReady } = useAppInsights();
  const trackException = useTrackException();
  const { createTimer, trackCounter } = useTrackPerformance();
  const insightsConfig = useInsightsConfig();

  useEffect(() => {
    if (isReady) {
      // Set user context for all telemetry
      setContext({
        userId: 'user-123',
        appVersion: '1.0.0',
        environment: 'production',
        properties: { 
          feature: 'advanced-dashboard',
          experiment: 'a/b-test-v1' 
        }
      });
    }
  }, [isReady, setContext]);

  const performExpensiveOperation = async () => {
    // Track performance timing
    const timer = createTimer('expensive_operation');
    
    try {
      // Simulate expensive operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Track successful completion
      trackCounter('operation_success');
      
    } catch (error) {
      // Track exceptions automatically
      trackException(error as Error, { 
        operation: 'expensive_operation',
        context: 'user_initiated' 
      });
    } finally {
      // Stop timer and track duration
      const duration = timer.stop({ 
        operation: 'expensive_operation',
        status: 'completed' 
      });
      console.log(`Operation took ${duration}ms`);
    }
  };

  return (
    <div>
      <h2>Advanced Telemetry</h2>
      <p>Insights Ready: {isReady ? '✅' : '❌'}</p>
      <p>Connection String Configured: {insightsConfig.isConfigured ? '✅' : '❌'}</p>
      
      <button onClick={performExpensiveOperation}>
        Run Tracked Operation
      </button>
      
      <button onClick={() => trackEvent({
        name: 'feature_used',
        properties: { feature: 'advanced-telemetry' }
      })}>
        Track Feature Usage
      </button>
    </div>
  );
}
```

### Installation (Optional Peer Dependencies)

Application Insights integration requires these optional packages:

```bash
npm install @microsoft/applicationinsights-web @microsoft/applicationinsights-react-js
# or
yarn add @microsoft/applicationinsights-web @microsoft/applicationinsights-react-js
```

**Without these packages installed**, the library works normally but Application Insights features are disabled.

## 🐳 Docker Integration

**The key benefit: Same Docker image works across all environments!**

### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Build WITHOUT environment variables - no secrets baked in!
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Environment variables injected at runtime
ENV REACT_APP_ENVIRONMENT=production
ENV REACT_APP_API_URL=https://api.example.com

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Deploy Same Image to Different Environments

```bash
# Development
docker run -p 3000:80 \
  -e REACT_APP_ENVIRONMENT=development \
  -e REACT_APP_API_URL=https://dev-api.example.com \
  -e REACT_APP_FEATURES_DARK_MODE=true \
  my-app

# Production  
docker run -p 3000:80 \
  -e REACT_APP_ENVIRONMENT=production \
  -e REACT_APP_API_URL=https://api.example.com \
  -e REACT_APP_FEATURES_DARK_MODE=false \
  my-app

# Same image, different configurations!
```

## 🔧 Environment Variable Mapping

The library automatically transforms environment variables into nested configuration objects:

```bash
# Environment Variables
REACT_APP_API_URL=https://api.example.com
REACT_APP_API_TIMEOUT=30000
REACT_APP_DATABASE_HOST=db.example.com
REACT_APP_DATABASE_PORT=5432
REACT_APP_FEATURES_DARK_MODE=true
REACT_APP_FEATURES_ANALYTICS=false
```

**Becomes:**
```json
{
  "api": {
    "url": "https://api.example.com",
    "timeout": 30000
  },
  "database": {
    "host": "db.example.com",
    "port": 5432
  },
  "features": {
    "darkMode": true,
    "analytics": false
  }
}
```

## 🎨 Advanced Usage

### Custom Configuration Sources

```tsx
<ConfigProvider
  options={{
    sources: ['azure', 'environment', 'local', 'defaults'],
    precedence: 'merge-deep', // or 'first-wins'
    
    cache: {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      storage: ['memory', 'localStorage'],
      refreshStrategy: 'on-demand' // or 'periodic' or 'load-once'
    },
    
    logLevel: 'info' // 'debug', 'info', 'warn', 'error', 'silent'
  }}
>
  <App />
</ConfigProvider>
```

### Feature Flags

```tsx
import { useFeature } from 'react-azure-config';

function FeatureComponent() {
  const showNewUI = useFeature('newUI');
  const enableAnalytics = useFeature('analytics');
  
  return (
    <div>
      {showNewUI && <NewUIComponent />}
      {enableAnalytics && <AnalyticsScript />}
    </div>
  );
}
```

### Server Management

```tsx
import { useConfigProvider } from 'react-azure-config';

function ConfigStatus() {
  const { 
    isServerRunning, 
    serverError, 
    restartServer, 
    getServerHealth 
  } = useConfigProvider();

  const checkHealth = async () => {
    const health = await getServerHealth();
    console.log('Server health:', health);
  };

  return (
    <div>
      <p>Server Status: {isServerRunning ? 'Running' : 'Stopped'}</p>
      {serverError && <p>Error: {serverError}</p>}
      <button onClick={restartServer}>Restart Server</button>
      <button onClick={checkHealth}>Check Health</button>
    </div>
  );
}
```

## 📚 API Reference

### Hooks

#### Configuration Hooks

| Hook | Description | Parameters |
|------|-------------|------------|
| `useConfig<T>()` | Load full configuration object | None |
| `useConfigValue<T>(key, defaultValue?)` | Load specific configuration value | `key: string`, `defaultValue?: T` |
| `useFeature(name)` | Load feature flag | `name: string` |
| `useEnv<T>(key, defaultValue?)` | Load environment variable with transformation | `key: string`, `defaultValue?: T` |
| `useConfigProvider()` | Server management and health | None |

#### Application Insights Hooks (NEW in v0.3.0)

| Hook | Description | Parameters |
|------|-------------|------------|
| `useAppInsights()` | Primary Application Insights hook with all tracking methods | None |
| `useTrackEvent()` | Simple event tracking | `eventName: string`, `properties?: object` |
| `useTrackException()` | Exception/error tracking | `error: Error`, `context?: object` |
| `useTrackPageView()` | Page view tracking (auto + manual) | `pageName?: string`, `properties?: object` |
| `useTrackPerformance()` | Performance timing and metrics | None |
| `useInsightsConfig()` | Get current Application Insights configuration | None |
| `useAppInsightsAvailable()` | Check if App Insights packages are installed | None |

### Configuration Options

```typescript
interface AzureConfigOptions {
  // Azure settings
  endpoint?: string;
  environment: string;
  application?: string;
  label?: string;
  
  // Authentication
  authentication?: {
    type: 'servicePrincipal' | 'managedIdentity' | 'azureCli';
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  
  // Sources and precedence
  sources?: string[];
  precedence?: 'first-wins' | 'merge-deep';
  
  // Embedded server
  useEmbeddedService?: boolean;
  port?: number;
  
  // Caching
  cache?: {
    ttl: number;
    maxSize: number;
    storage: ('memory' | 'localStorage')[];
    refreshStrategy?: 'load-once' | 'periodic' | 'on-demand';
  };
  
  // Key Vault
  keyVault?: {
    enableKeyVaultReferences?: boolean;
    secretCacheTtl?: number;
    maxRetries?: number;
  };
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

interface ConfigProviderProps {
  children: ReactNode;
  client?: RuntimeConfigurationClient;
  apiUrl?: string;
  fetchOnMount?: boolean;
  
  // Application Insights (NEW in v0.3.0)
  applicationInsights?: {
    connectionString?: string; // Override connection string
    autoInitialize?: boolean; // Auto-initialize when connection string found
    enableReactPlugin?: boolean; // Enable React-specific tracking
    enableAutoRouteTracking?: boolean; // Auto-track route changes
    enableCookiesUsage?: boolean; // Enable cookies for user tracking
    enableRequestHeaderTracking?: boolean; // Track request headers
    enableResponseHeaderTracking?: boolean; // Track response headers
    additionalConfig?: object; // Additional Application Insights config
  };
  enableAutoInsights?: boolean; // Enable automatic Application Insights initialization
}
```

## 🏗️ How It Works

1. **ConfigProvider** starts an embedded Express server (port 3001)
2. **Server reads environment variables** at container startup (runtime)
3. **React hooks** call `localhost:3001/config` for configuration
4. **Configuration served via API** - not compiled into bundle
5. **Same Docker image** serves different configurations based on env vars

## 🚀 Deployment Examples

### Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name my-app \
  --image myregistry.azurecr.io/my-app:latest \
  --environment-variables \
    REACT_APP_ENVIRONMENT=production \
    AZURE_CLIENT_ID=your-client-id \
  --secure-environment-variables \
    AZURE_CLIENT_SECRET=your-secret
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: myregistry.azurecr.io/my-app:latest
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_ENVIRONMENT
          value: "production"
        - name: AZURE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: azure-secrets
              key: client-id
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [Jovani Samuels](https://github.com/iamjovani)

## 🔗 Links

- [GitHub Repository](https://github.com/iamjovani/react-azure-config)
- [npm Package](https://www.npmjs.com/package/react-azure-config)
- [Issues & Bugs](https://github.com/iamjovani/react-azure-config/issues)

---

**Built with ❤️ by [Jovani Samuels](https://github.com/iamjovani)**