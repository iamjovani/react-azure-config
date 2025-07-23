const typescript = require('@rollup/plugin-typescript');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');

const isProduction = process.env.NODE_ENV === 'production';

// Shared external dependencies
const sharedExternal = [
  'react',
  'react-dom',
  '@azure/app-configuration',
  '@azure/identity',
  '@azure/core-auth',
  '@azure/keyvault-secrets'
];

// Server-only externals (Node.js modules)
const serverExternal = [
  ...sharedExternal,
  'express',
  'cors',
  'fs',
  'path',
  'http',
  'https',
  'net',
  'tls',
  'url',
  'querystring'
];

// Client-only externals (browser-safe)
const clientExternal = [
  ...sharedExternal,
  '@microsoft/applicationinsights-web',
  '@microsoft/applicationinsights-react-js'
];

// Create common configuration factory
const createConfig = (input, external, outputName, isClientBundle = false) => ({
  input,
  external,
  plugins: [
    resolve({
      browser: isClientBundle,
      preferBuiltins: !isClientBundle
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['**/*.test.*', '**/*.spec.*'],
      compilerOptions: {
        declaration: true,
        declarationDir: 'dist',
        removeComments: isProduction
      }
    })
  ]
});

module.exports = [
  // Main entry (client-safe) - ESM
  {
    ...createConfig('src/index.ts', clientExternal, 'index', true),
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // Main entry (client-safe) - CommonJS
  {
    ...createConfig('src/index.ts', clientExternal, 'index', true),
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // Server entry - ESM
  {
    ...createConfig('src/server.ts', serverExternal, 'server', false),
    output: {
      file: 'dist/server.esm.js',
      format: 'es',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // Server entry - CommonJS
  {
    ...createConfig('src/server.ts', serverExternal, 'server', false),
    output: {
      file: 'dist/server.cjs.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // Client entry - ESM
  {
    ...createConfig('src/client.ts', clientExternal, 'client', true),
    output: {
      file: 'dist/client.esm.js',
      format: 'es',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // Client entry - CommonJS
  {
    ...createConfig('src/client.ts', clientExternal, 'client', true),
    output: {
      file: 'dist/client.cjs.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // UMD build (client-only for browser)
  {
    ...createConfig('src/index.ts', clientExternal, 'index', true),
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'ReactAzureConfig',
      sourcemap: !isProduction,
      exports: 'named',
      globals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        '@azure/app-configuration': 'AzureAppConfiguration',
        '@azure/identity': 'AzureIdentity',
        '@azure/core-auth': 'AzureCoreAuth',
        '@azure/keyvault-secrets': 'AzureKeyVault'
      }
    }
  },
  
  // Minified UMD build (client-only for browser)
  {
    ...createConfig('src/index.ts', clientExternal, 'index', true),
    output: {
      file: 'dist/index.umd.min.js',
      format: 'umd',
      name: 'ReactAzureConfig',
      sourcemap: true,
      globals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        '@azure/app-configuration': 'AzureAppConfiguration',
        '@azure/identity': 'AzureIdentity',
        '@azure/core-auth': 'AzureCoreAuth',
        '@azure/keyvault-secrets': 'AzureKeyVault'
      }
    },
    plugins: [
      ...createConfig('src/index.ts', clientExternal, 'index', true).plugins,
      terser({
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.debug'] : []
        },
        format: {
          comments: false
        }
      })
    ]
  }
];