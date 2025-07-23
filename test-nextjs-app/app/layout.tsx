'use client'

import './globals.css'
import { ConfigProvider } from 'react-azure-config/client'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ConfigProvider
          apiUrl="/api/config"
          fetchOnMount={true}
        >
          {children}
        </ConfigProvider>
      </body>
    </html>
  )
}