module.exports = {
  displayName: 'client',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.client.ts'],
  setupFiles: ['<rootDir>/src/test-polyfills.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock Azure modules to avoid ES module issues
    '^@azure/app-configuration$': '<rootDir>/src/__mocks__/@azure/app-configuration.js',
    '^@azure/identity$': '<rootDir>/src/__mocks__/@azure/identity.js',
    '^@azure/core-auth$': '<rootDir>/src/__mocks__/@azure/core-auth.js',
    '^fs$': '<rootDir>/src/__mocks__/fs.js',
    '^./runtime-config-client$': '<rootDir>/src/__mocks__/runtime-config-client.ts'
  },
  testMatch: [
    '<rootDir>/src/client/**/*.test.ts',
    '<rootDir>/src/client/**/*.test.tsx',
    '<rootDir>/src/client/**/*.spec.ts',
    '<rootDir>/src/client/**/*.spec.tsx',
    '<rootDir>/src/cache.test.ts',
    '<rootDir>/src/local-config.test.ts',
    '<rootDir>/src/runtime-config-client.test.ts',
    '<rootDir>/src/hooks.test.tsx',
    '<rootDir>/src/context.test.tsx',
    '<rootDir>/src/integration.test.tsx',
  ],
  transform: {
    '^.+\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(@azure|tslib)/)'
  ]
};