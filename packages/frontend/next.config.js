const path = require('path');
const { NextConfigEnv } = require('../../config/next-config-env');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // serverExternalPackages intentionally omitted — all server-only @fromcode119/* packages
  // are replaced with no-op stubs via webpack aliases below, so no external resolution needed.
  transpilePackages: ['@fromcode119/core', '@fromcode119/react', '@fromcode119/sdk'],
  turbopack: {
    resolveAlias: {
      '@fromcode119/react': '../react/src',
      '@fromcode119/react/*': '../react/src/*',
      '@fromcode119/core': '../core/src',
      '@fromcode119/core/*': '../core/src/*',
      '@fromcode119/sdk': '../sdk/src',
      '@fromcode119/sdk/*': '../sdk/src/*',
      '@fromcode119/database/physical-table-name-utils': '../database/src/physical-table-name-utils.ts',
      '@fromcode119/database/naming-strategy': '../database/src/naming-strategy.ts',
    },
  },
  images: {
    remotePatterns: NextConfigEnv.getRemoteImagePatterns(),
  },
  webpack: (config, { dev, isServer }) => {
    // Force aliasing of @ to handle cases where the package is inside node_modules
    config.resolve.alias['@'] = path.resolve(__dirname);

    // Stub out all server-only @fromcode119 packages for ALL Next.js builds.
    // The frontend app never runs these directly — all data access goes via the API server.
    const serverOnlyStub = path.resolve(__dirname, './webpack/database-stub.js');
    [
      '@fromcode119/database$',
      '@fromcode119/media$',
      '@fromcode119/cache$',
      '@fromcode119/email$',
      '@fromcode119/scheduler$',
      '@fromcode119/marketplace-client$',
      '@fromcode119/plugins$',
      'express$', // defense-in-depth: BaseRouter (and any plugin code) must never reach the client bundle
    ].forEach(pkg => { config.resolve.alias[pkg] = serverOnlyStub; });

    // Stub async_hooks so the AsyncLocalStorage static initialiser in
    // core/src/context/request-context.ts doesn't crash the browser bundle.
    config.resolve.alias['async_hooks'] = path.resolve(__dirname, './webpack/async-hooks-stub.js');

    config.resolve.alias['@fromcode119/react$'] = path.resolve(__dirname, '../react/src/index.ts');
    config.resolve.alias['@fromcode119/core$'] = path.resolve(__dirname, '../core/src/index.ts');
    config.resolve.alias['@fromcode119/sdk$'] = path.resolve(__dirname, '../sdk/src/index.ts');
    config.resolve.alias['@fromcode119/database/physical-table-name-utils$'] = path.resolve(__dirname, '../database/src/physical-table-name-utils.ts');
    config.resolve.alias['@fromcode119/database/naming-strategy$'] = path.resolve(__dirname, '../database/src/naming-strategy.ts');

    config.resolve.alias['@fromcode119/react/'] = path.resolve(__dirname, '../react/src/');
    config.resolve.alias['@fromcode119/core/'] = path.resolve(__dirname, '../core/src/');
    config.resolve.alias['@fromcode119/sdk/'] = path.resolve(__dirname, '../sdk/src/');

    // When package source directories are aliased into webpack, prefer TypeScript
    // source files over any stale generated JavaScript artifacts that may exist.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };

    config.resolve.symlinks = false;

    // Add SDK source to modules to ensure it's found when transpiling other packages
    config.resolve.modules.push(path.resolve(__dirname, '../sdk/src'));
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'));

    // Polyfill/stub Node.js built-ins that core/src server-only code imports.
    // admin/frontend never execute this code — all server logic runs in the API server.
    // Setting to false provides an empty module so webpack doesn't crash.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      url: false,
      util: false,
      module: false,
      'stream/promises': false,
      stream: false,
      zlib: false,
      net: false,
      tls: false,
      http: false,
      https: false,
      http2: false,
      child_process: false,
      worker_threads: false,
    };

    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
