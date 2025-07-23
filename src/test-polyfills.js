// Polyfills for Node.js environment testing
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Response for Next.js middleware tests
global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = init.headers || {};
  }
};

// Mock fetch for client tests
global.fetch = global.fetch || jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: {
        database: {
          connectionString: 'Server=localhost;Database=testdb;User Id=test;Password=test;'
        },
        api: {
          baseUrl: 'https://api.example.com'
        },
        features: {
          newFeature: 'true'
        }
      },
      timestamp: Date.now()
    })
  })
);