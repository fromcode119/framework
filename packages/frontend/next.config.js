const path = require('path');
const { NextConfigEnv } = require('../../config/next-config-env');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `.client` is the client-boundary filename convention: a CLIENT route entry is `page.client.tsx` /
  // `layout.client.tsx` (directive stamped in by scripts/stamp-client-src.mjs), a SERVER one stays `page.tsx`.
  // Listing `client.tsx`/`client.ts` here makes Next recognize `page.client.tsx` as the route `page`, so no
  // one-line re-export wrapper file is needed. A dir has EITHER page.tsx OR page.client.tsx, never both.
  pageExtensions: ['client.tsx', 'client.ts', 'tsx', 'ts', 'jsx', 'js'],
  experimental: {},
  // serverExternalPackages intentionally omitted — all server-only @fromcode119/* packages
  // are replaced with no-op stubs via webpack aliases below, so no external resolution needed.
  transpilePackages: ['@fromcode119/core', '@fromcode119/react', '@fromcode119/sdk'],
  turbopack: {
    // [nextor] Source declares ONLY `export class`. This loader generates, at BUILD time, the two
    // things Next needs but a class cannot express: the exports it resolves routes by (GET/POST,
    // default, generateMetadata, manifest) and the literal `'use client'` directive.
    // See @fromcode119/nextor RouteExportPlugin + ClientDirectivePlugin.
    rules: {
      '**/{app,components,lib,hooks,src}/**/*.{ts,tsx}': {
        loaders: [
          require.resolve('@fromcode119/nextor/route-export-loader.cjs'),
          // typor: multiple-inheritance `extends` -> Typor.mixin(...). Loaders run RIGHT-to-LEFT, so the
          // syntax rewrite lands first and nextor then sees ordinary TypeScript.
          require.resolve('@fromcode119/typor/typor-loader.cjs'),
        ],
      },
    },
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
    // [nextor + typor] Same build-time source contracts as the turbopack rules above. `next dev` runs
    // with --webpack, so without this the dev server would never see the generated route exports and
    // `'use client'` directives — source declaring only `export class` would fail to resolve as a route.
    config.module.rules.unshift({
      test: /[\\/](app|components|lib|hooks|src)[\\/].*\.(ts|tsx)$/,
      exclude: /[\\/]node_modules[\\/]/,
      use: [
        { loader: require.resolve('@fromcode119/nextor/route-export-loader.cjs') },
        // Loaders run RIGHT-to-LEFT: the typor syntax rewrite lands first.
        { loader: require.resolve('@fromcode119/typor/typor-loader.cjs') },
      ],
    });

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
    config.resolve.alias['@fromcode119/core/client$'] = path.resolve(__dirname, '../core/src/client.ts');
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
  async headers() {
    return [
      {
        // Hashed build chunks are content-addressed (filename changes on every build),
        // so they are safe to cache immutably for a year. This restores Next's own
        // default for `/_next/static/*`, which the document-route rule below would
        // otherwise clobber.
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The live client bundle (`/fc-live/<slug>/<version>/live.js`) is content-addressed by the
        // theme VERSION in its path — a theme update mints a new URL — so it is safe to cache
        // immutably for a year, exactly like the hashed build chunks above. Without this rule the
        // document-route rule below would clobber it down to `no-cache`.
        source: '/fc-live/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Override Next.js force-dynamic's `no-store` header to allow bfcache.
        // `private, no-cache` lets the browser use bfcache (back/forward navigation)
        // while still revalidating with the server on normal navigations.
        // Scoped to exclude `/_next/static/*` and `/fc-live/*` so those hashed/versioned
        // assets keep their immutable rule above — HTML/data routes stay private/no-cache
        // (they can contain user-gated content).
        source: '/((?!_next/static/|fc-live/).*)',
        headers: [{ key: 'Cache-Control', value: 'private, no-cache' }],
      },
    ];
  },
};

module.exports = nextConfig;
