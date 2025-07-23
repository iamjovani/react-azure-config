/**
 * ClientOnly Component
 * 
 * A universal SSR-safe wrapper component that prevents children from rendering
 * on the server side, eliminating hydration mismatches.
 * 
 * This is essential for components that rely on client-side APIs or browser globals.
 * 
 * @module client/ClientOnly
 */

import { ReactNode, useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  /** Optional fallback to render on server side */
  fallback?: ReactNode;
}

/**
 * ClientOnly wrapper component
 * 
 * Prevents hydration mismatches by only rendering children after client-side hydration.
 * This is crucial for components that use browser-specific APIs or have different
 * server vs client behavior.
 * 
 * @example
 * ```tsx
 * <ClientOnly fallback={<div>Loading...</div>}>
 *   <ComponentThatUsesWindow />
 * </ClientOnly>
 * ```
 */
export const ClientOnly: React.FC<ClientOnlyProps> = ({ 
  children, 
  fallback = null 
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This only runs on the client side after hydration
    setIsClient(true);
  }, []);

  // Return fallback during SSR and initial client render,
  // then switch to actual children after hydration
  return isClient ? <>{children}</> : <>{fallback}</>;
};

/**
 * Custom hook to detect if we're running on the client side
 * 
 * Useful for conditional logic that should only run after hydration.
 * 
 * @returns boolean indicating if we're on the client side
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const isClient = useIsClient();
 *   
 *   return (
 *     <div>
 *       {isClient ? <ClientSpecificComponent /> : <ServerFallback />}
 *     </div>
 *   );
 * };
 * ```
 */
export const useIsClient = (): boolean => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
};

/**
 * Environment detection utilities
 * 
 * Provides SSR-safe environment detection functions.
 */
export const environment = {
  /** True if running on server side */
  isServer: typeof window === 'undefined',
  
  /** True if running on client side */
  isClient: typeof window !== 'undefined',
  
  /** True if running in browser environment */
  isBrowser: typeof window !== 'undefined' && typeof window.document !== 'undefined',
  
  /** True if we're in development mode */
  isDevelopment: process.env.NODE_ENV === 'development',
  
  /** True if we're in production mode */
  isProduction: process.env.NODE_ENV === 'production',
  
  /** True if we're in test mode */
  isTest: process.env.NODE_ENV === 'test'
} as const;

/**
 * SSR-safe environment variable getter
 * 
 * Safely accesses environment variables with fallback for SSR.
 * 
 * @param key Environment variable key
 * @param defaultValue Default value if variable is not found
 * @returns Environment variable value or default
 */
export const getEnvVar = (key: string, defaultValue: string = ''): string => {
  try {
    return process.env[key] || defaultValue;
  } catch {
    // Fallback for environments where process is not available
    return defaultValue;
  }
};

/**
 * SSR-safe localStorage getter
 * 
 * Safely accesses localStorage with fallback for SSR.
 * 
 * @param key Storage key
 * @param defaultValue Default value if key is not found
 * @returns Stored value or default
 */
export const getLocalStorage = (key: string, defaultValue: string = ''): string => {
  if (environment.isServer) {
    return defaultValue;
  }
  
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

/**
 * SSR-safe localStorage setter
 * 
 * Safely sets localStorage with error handling.
 * 
 * @param key Storage key
 * @param value Value to store
 * @returns Success boolean
 */
export const setLocalStorage = (key: string, value: string): boolean => {
  if (environment.isServer) {
    return false;
  }
  
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};