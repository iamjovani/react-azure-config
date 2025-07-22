const typescript = require('@rollup/plugin-typescript');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');

const isProduction = process.env.NODE_ENV === 'production';

const external = [
  'react',
  'react-dom',
  '@azure/app-configuration',
  '@azure/identity',
  '@azure/core-auth',
  '@azure/keyvault-secrets',
  'express',
  'cors'
];

const commonConfig = {
  input: 'src/index.ts',
  external,
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
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
};

module.exports = [
  // ESM build
  {
    ...commonConfig,
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // CommonJS build
  {
    ...commonConfig,
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named'
    }
  },
  
  // UMD build
  {
    ...commonConfig,
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
        '@azure/keyvault-secrets': 'AzureKeyVault',
        'express': 'express',
        'cors': 'cors'
      }
    }
  },
  
  // Minified UMD build
  {
    ...commonConfig,
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
        '@azure/keyvault-secrets': 'AzureKeyVault',
        'express': 'express',
        'cors': 'cors'
      }
    },
    plugins: [
      ...commonConfig.plugins,
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