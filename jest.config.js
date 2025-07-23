module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  setupFiles: ['<rootDir>/src/test-polyfills.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock Azure modules to avoid ES module issues
    '^@azure/app-configuration$': '<rootDir>/src/__mocks__/@azure/app-configuration.js',
    '^@azure/identity$': '<rootDir>/src/__mocks__/@azure/identity.js',
    '^@azure/core-auth$': '<rootDir>/src/__mocks__/@azure/core-auth.js'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-setup.ts',
    '!src/example-usage.tsx',
    '!src/index.ts',
    '!src/__mocks__/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
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