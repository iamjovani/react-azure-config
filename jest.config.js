module.exports = {
  projects: [
    '<rootDir>/jest.client.config.js',
    '<rootDir>/jest.server.config.js',
  ],
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
};