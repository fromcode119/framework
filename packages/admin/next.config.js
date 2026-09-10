const path = require('path');
const fs = require('fs');
const { NextConfigEnv } = require('../../config/next-config-env');

// Dynamically discover all extensions in the packages directory
const packagesDir = path.resolve(__dirname, '..');
const extensions = fs.readdirSync(packagesDir).filter(name => {
  const ext = path.join(packagesDir, name);
  return fs.statSync(ext).isDirectory() && !['core', 'react', 'sdk', 'api', 'admin', 'auth', 'media', 'cache', 'database', 'scheduler'].includes(name);
});
const adminBasePath = NextConfigEnv.getAdminBasePath();

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: adminBasePath,
  allowedDevOrigins: NextConfigEnv.getAllowedDevOrigins(),
  reactStrictMode: true,
  // `.client` filename convention: a CLIENT route entry is `page.client.tsx` / `layout.client.tsx` (directive
  // stamped by scripts/stamp-client-src.mjs); a SERVER route stays `page.tsx`. Listing `client.tsx`/`client.ts`
  // makes Next treat `page.client.tsx` as the route `page` — so no one-line re-export wrapper is needed.
  pageExtensions: ['client.tsx', 'client.ts', 'tsx', 'ts', 'jsx', 'js'],
  // serverExternalPackages intentionally omitted — all server-only @fromcode119/* packages
  // are replaced with no-op stubs via webpack aliases below, so no external resolution needed.
  transpilePackages: [
    '@fromcode119/core',
    '@fromcode119/react',
    '@fromcode119/sdk',
    ...extensions.map(ext => `@fromcode119/${ext}`),
  ],
  turbopack: {
    // [next-build-codegen] Source declares ONLY `export class`. This loader generates, at BUILD time, the two
    // things Next needs but a class cannot express: the exports it resolves routes by (GET/POST,
    // default, generateMetadata, manifest) and the literal `'use client'` directive.
    // See @fromcode119/next-build-codegen RouteExportPlugin + ClientDirectivePlugin.
    rules: {
      '**/{app,components,lib,hooks,src}/**/*.{ts,tsx}': {
        loaders: [
          require.resolve('@fromcode119/next-build-codegen/route-export-loader.cjs'),
          // typescript-multiple-inheritance: multiple-inheritance `extends` -> Typor.mixin(...). Loaders run RIGHT-to-LEFT, so the
          // syntax rewrite lands first and next-build-codegen then sees ordinary TypeScript.
          require.resolve('@fromcode119/typescript-multiple-inheritance/tsmi-loader.cjs'),
        ],
      },
    },
    resolveAlias: {
      '@fromcode119/react': '../react/src',
      '@fromcode119/react/*': '../react/src/*',
      '@fromcode119/core': '../core/src/client.ts',
      '@fromcode119/core/*': '../core/src/*',
      '@fromcode119/sdk': '../sdk/src',
      '@fromcode119/sdk/*': '../sdk/src/*',
      '@fromcode119/database/physical-table-name-utils': '../database/src/physical-table-name-utils.ts',
      '@fromcode119/database/naming-strategy': '../database/src/naming-strategy.ts',
      ...Object.fromEntries(extensions.map(ext => [
        `@fromcode119/${ext}`,
        `../${ext}/src`
      ])),
      ...Object.fromEntries(extensions.map(ext => [
        `@fromcode119/${ext}/*`,
        `../${ext}/src/*`
      ])),
    },
  },
  images: {
    remotePatterns: NextConfigEnv.getRemoteImagePatterns(),
  },
  async redirects() {
    if (!adminBasePath) {
      return [];
    }

    return [
      {
        source: '/login',
        destination: `${adminBasePath}/login`,
        permanent: false,
        basePath: false,
      },
      {
        source: '/forgot-password',
        destination: `${adminBasePath}/forgot-password`,
        permanent: false,
        basePath: false,
      },
      {
        source: '/reset-password',
        destination: `${adminBasePath}/reset-password`,
        permanent: false,
        basePath: false,
      },
      {
        source: '/setup',
        destination: `${adminBasePath}/setup`,
        permanent: false,
        basePath: false,
      },
      {
        source: '/brand/:path*',
        destination: `${adminBasePath}/brand/:path*`,
        permanent: false,
        basePath: false,
      },
      {
        source: '/favicon.ico',
        destination: `${adminBasePath}/favicon.ico`,
        permanent: false,
        basePath: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // The framework's runtime assets under this app's public/ — today the per-icon Lucide data
        // modules (`/fc-runtime/icons/<lucide version>/<name>.js`, emitted by `build:frontend-icons`).
        // The version segment content-addresses them (a lucide upgrade mints new URLs), so they are safe
        // to cache immutably for a year — the same rule the storefront applies to the same path.
        source: '/fc-runtime/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf)).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
          {
            key: 'X-Fromcode-Admin-No-Store',
            value: '1',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, dev }) => {
    // [next-build-codegen + typescript-multiple-inheritance] Same build-time source contracts as the turbopack rules above. `next dev` runs
    // with --webpack, so without this the dev server would never see the generated route exports and
    // `'use client'` directives — source declaring only `export class` would fail to resolve as a route.
    config.module.rules.unshift({
      // PRE loader: webpack runs pre-loaders before every normal loader whatever the rule order, so the
      // generated route exports and `'use client'` directive are in the source BEFORE Next's own
      // transform reads it. Without `enforce`, our rule sits first in the list and therefore runs LAST
      // (loaders execute right-to-left), so Next's React Server Component check saw an unstamped
      // `.client.tsx` and 500'd every dev page with "you're importing a module that depends on
      // usePathname into a React Server Component module".
      enforce: 'pre',
      test: /[\\/](app|components|lib|hooks|src)[\\/].*\.(ts|tsx)$/,
      exclude: /[\\/]node_modules[\\/]/,
      use: [
        { loader: require.resolve('@fromcode119/next-build-codegen/route-export-loader.cjs') },
        // Loaders run RIGHT-to-LEFT: the typescript-multiple-inheritance syntax rewrite lands first.
        { loader: require.resolve('@fromcode119/typescript-multiple-inheritance/tsmi-loader.cjs') },
      ],
    });

    // Force aliasing of @ to handle cases where the package is inside node_modules
    config.resolve.alias['@'] = path.resolve(__dirname);

    // Stub out all server-only @fromcode119 packages for ALL Next.js builds.
    // The admin/frontend apps never run these directly — all data access goes
    // through the API server via HTTP. core/src statically imports from these
    // packages; we replace them with a no-op proxy so webpack doesn't chase
    // server-only imports (drizzle-orm, pg, nodemailer, ffmpeg, etc.).
    for (const [pkg, stub] of Object.entries(NextConfigEnv.getServerOnlyStubFiles())) {
      config.resolve.alias[`${pkg}$`] = stub;
    }
    // async_hooks: `RequestContext` instantiates an AsyncLocalStorage at class-evaluation time.
    config.resolve.alias['async_hooks'] = NextConfigEnv.getNodeBuiltinFallbacks().async_hooks;

    config.resolve.alias['@fromcode119/react$'] = path.resolve(__dirname, '../react/src/index.ts');
    config.resolve.alias['@fromcode119/core$'] = path.resolve(__dirname, '../core/src/client.ts');
    config.resolve.alias['@fromcode119/core/client$'] = path.resolve(__dirname, '../core/src/client.ts');
    config.resolve.alias['@fromcode119/sdk$'] = path.resolve(__dirname, '../sdk/src/index.ts');
    config.resolve.alias['@fromcode119/database/physical-table-name-utils$'] = path.resolve(__dirname, '../database/src/physical-table-name-utils.ts');
    config.resolve.alias['@fromcode119/database/naming-strategy$'] = path.resolve(__dirname, '../database/src/naming-strategy.ts');

    // reactor's React-FREE subpath, resolved from SOURCE. An EXACT (`$`) alias is required: a
    // trailing-slash alias key never matches — enhanced-resolve tests `request.startsWith(key + '/')`,
    // so `'@fromcode119/react-class-components/'` would have to be followed by a second slash. Without this the
    // request falls through to node_modules and the package's `exports` map, i.e. built `dist` — which
    // is exactly what this dev setup exists to avoid.
    config.resolve.alias['@fromcode119/react-class-components/lang$'] = path.resolve(__dirname, '../react-class-components/src/lang.ts');
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

    // Dynamically add aliases for all discovered extensions
    extensions.forEach(ext => {
      config.resolve.alias[`@fromcode119/${ext}$`] = path.resolve(__dirname, `../${ext}/src/index.ts`);
      config.resolve.alias[`@fromcode119/${ext}/`] = path.resolve(__dirname, `../${ext}/src/`);
    });

    // `ai` is consumed as BUILT output (dist), not src-transpiled, so its `.client.*` 'use client' stamp
    // (injected at ai build time via next-build-codegen's UseClientPlugin) is honored — Next won't run custom transforms
    // on transpiled-package SOURCE, so the directive must already be present in the module Next reads.
    config.resolve.alias['@fromcode119/ai$'] = path.resolve(__dirname, '../ai/dist/index.js');
    config.resolve.alias['@fromcode119/ai/admin$'] = path.resolve(__dirname, '../ai/dist/admin-extension.js');
    config.resolve.alias['@fromcode119/ai/'] = path.resolve(__dirname, '../ai/dist/');

    config.resolve.symlinks = false;

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

    // Standard Docker/macOS watch optimization
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
  }
};

module.exports = nextConfig;
