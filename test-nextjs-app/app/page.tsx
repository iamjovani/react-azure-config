'use client'

import { useConfig } from 'react-azure-config/client'

export default function HomePage() {
  const { data: config, loading, error } = useConfig()

  return (
    <main>
      <h1>Custom Configuration Solution</h1>
      
      <div className="test-section">
        <h2>📊 Configuration Status</h2>
        {loading && <div className="loading">Loading configuration...</div>}
        {error && <div className="error">Error: {error}</div>}
        {config && (
          <div className="success">
            ✅ Configuration loaded successfully!
            <details>
              <summary>View Configuration</summary>
              <pre>{JSON.stringify(config, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>

      <div className="test-section">
        <h2>🎯 Individual Values</h2>
        <p><strong>API URL:</strong> {(config as any)?.['API_URL'] || 'Not available'}</p>
        <p><strong>App Name:</strong> {(config as any)?.['APP_NAME'] || 'Not available'}</p>
        <p><strong>Dark Mode:</strong> {(config as any)?.['FEATURES_DARKMODE'] === 'true' ? 'Enabled' : 'Disabled'}</p>
      </div>
    </main>
  )
}