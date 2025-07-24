# Multi-App Configuration Support

This library now supports multi-app configurations in monorepo environments with Docker volume mount override capabilities.

## Features Added

✅ **App-scoped file reading** - Read from `apps/{appId}/.env` files  
✅ **API endpoints** - `/api/config/{appId}` for app-specific configuration  
✅ **Caching with invalidation** - File modification-based cache invalidation  
✅ **ConfigProvider enhancement** - Support for `appId` prop  
✅ **Runtime client routing** - Automatic endpoint routing based on appId  
✅ **Docker volume mount support** - Override .env files at runtime  

## Usage Examples

### Server-side Setup

```typescript
import { createConfigServer } from 'react-azure-config/server';

// Start configuration server
const server = createConfigServer({
  port: 3001,
  environment: 'production'
});

await server.start();
```

### Client-side Usage

#### Single App (Backward Compatible)
```typescript
import { ConfigProvider } from 'react-azure-config/client';

function App() {
  return (
    <ConfigProvider>
      <MyComponents />
    </ConfigProvider>
  );
}
```

#### Multi-App Support
```typescript
import { ConfigProvider } from 'react-azure-config/client';

// Admin app
function AdminApp() {
  return (
    <ConfigProvider appId="admin">
      <AdminComponents />
    </ConfigProvider>
  );
}

// User portal app  
function UserPortalApp() {
  return (
    <ConfigProvider appId="user-portal">
      <UserPortalComponents />
    </ConfigProvider>
  );
}
```

### Configuration File Structure

```
project-root/
├── .env                          # Root fallback configuration
├── apps/
│   ├── admin/
│   │   └── .env                  # Admin app configuration
│   ├── user-portal/
│   │   └── .env                  # User portal configuration
│   └── analytics/
│       └── .env                  # Analytics app configuration
└── ...
```

### API Endpoints

The configuration server now provides these endpoints:

```bash
# Default (backward compatible)
GET /config                       # Root configuration
GET /config/:key                  # Root configuration value

# App-specific  
GET /config/admin                 # Admin app configuration
GET /config/admin/:key            # Admin app configuration value
GET /config/user-portal           # User portal configuration
GET /config/user-portal/:key      # User portal configuration value

# Refresh endpoints
POST /refresh                     # Refresh all configurations
POST /refresh/admin               # Refresh admin app configuration

# Utility endpoints
GET /apps                         # List available apps
GET /health                       # Health check
GET /info                         # Server information
```

### Docker Integration

Each app can have its configuration overridden via Docker volume mounts:

```bash
# Override admin app configuration
docker run -v /host/admin.env:/app/apps/admin/.env my-app

# Override user portal configuration  
docker run -v /host/user-portal.env:/app/apps/user-portal/.env my-app
```

### Configuration Precedence

For each app, configuration is loaded in this order (highest to lowest priority):

1. **App-specific**: `apps/{appId}/.env`
2. **Root fallback**: `.env` 
3. **Process environment**: `process.env`

### Direct Provider Usage

```typescript
import { AppScopedConfigurationProvider } from 'react-azure-config/server';

const provider = new AppScopedConfigurationProvider();

// Get configuration for specific app
const adminConfig = provider.getAppConfiguration('admin');
const userPortalConfig = provider.getAppConfiguration('user-portal');

// Get specific values
const adminDbUrl = provider.getAppConfigValue('admin', 'DATABASE_URL');
const portalApiKey = provider.getAppConfigValue('user-portal', 'API_KEY');

// List available apps
const availableApps = provider.getAvailableApps(); // ['admin', 'user-portal', 'analytics']
```

This approach solves the Docker "baked-in" configuration problem by reading .env files at runtime instead of build time, while providing excellent multi-app support for monorepo environments.