module.exports = {
  displayName: 'server',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@azure/app-configuration$': '<rootDir>/src/__mocks__/@azure/app-configuration.js',
    '^@azure/identity$': '<rootDir>/src/__mocks__/@azure/identity.js',
    '^@azure/core-auth$': '<rootDir>/src/__mocks__/@azure/core-auth.js',
    '^../server/config-server$': '<rootDir>/src/__mocks__/config-server.ts',
    '^../utils/config-utils$': '<rootDir>/src/__mocks__/config-utils.ts',
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx',
    '!**/src/__tests__/client-server-separation.test.ts',
    '!**/src/__tests__/client-server-separation.test.tsx',
    '!**/src/__tests__/nextjs-compatibility.test.ts',
    '!**/src/__tests__/nextjs-compatibility.test.tsx',
    '!**/src/__tests__/runtime-config-demo.test.ts',
    '!**/src/__tests__/runtime-config-demo.test.tsx',
    '!**/src/__tests__/environment-agnostic.test.ts',
    '!**/src/__tests__/environment-agnostic.test.tsx',
    '!**/src/__tests__/environment-agnostic-final.test.ts',
    '!**/src/__tests__/environment-agnostic-final.test.tsx',
    '<rootDir>/src/server/**/*.test.ts',
    '<rootDir>/src/server/**/*.test.tsx',
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