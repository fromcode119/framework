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
    // ONE list, shared with the standalone runtime bundle build (config/next-config-env.js). Never add
    // an alias here directly.
    resolveAlias: NextConfigEnv.toTurbopackResolveAlias(NextConfigEnv.getSourceAliases(__dirname), __dirname),
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

    // Package -> source aliases (incl. `@` -> this dir): the ONE list shared with the standalone runtime
    // bundle build, from config/next-config-env.js. Never add an alias here directly.
    Object.assign(
      config.resolve.alias,
      NextConfigEnv.toWebpackResolveAlias(NextConfigEnv.getSourceAliases(__dirname)),
    );

    // Stub out all server-only @fromcode119 packages (and express) for ALL Next.js builds.
    // The frontend app never runs these directly — all data access goes via the API server.
    for (const [pkg, stub] of Object.entries(NextConfigEnv.getServerOnlyStubFiles())) {
      config.resolve.alias[`${pkg}$`] = stub;
    }

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
    // `false` provides an empty module so webpack doesn't crash; a string (async_hooks) is a
    // replacement module. The list is the shared one in config/next-config-env.js.
    config.resolve.fallback = { ...config.resolve.fallback };
    for (const [name, fallback] of Object.entries(NextConfigEnv.getNodeBuiltinFallbacks())) {
      if (fallback === false) config.resolve.fallback[name] = false;
      else config.resolve.alias[name] = fallback;
    }

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
        // The storefront runtime bundle (`/fc-runtime/runtime-<contenthash>.js`, built by
        // `npm run build:frontend-runtime` into `public/fc-runtime/`) is content-addressed by the hash
        // in its filename — a rebuild mints a new URL — so it is safe to cache immutably for a year,
        // exactly like the hashed build chunks above. Without this rule the document-route rule below
        // would clobber it down to `no-cache`.
        source: '/fc-runtime/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Override Next.js force-dynamic's `no-store` header to allow bfcache.
        // `private, no-cache` lets the browser use bfcache (back/forward navigation)
        // while still revalidating with the server on normal navigations.
        // Scoped to exclude `/_next/static/*` and `/fc-runtime/*` so those hashed
        // assets keep their immutable rule above, and the proxied theme / plugin UI assets
        // (fonts, images, bundles — the API sets their own cache policy; stamping `no-cache` on
        // them made every returning visitor re-download the theme's fonts). HTML/data routes
        // stay private/no-cache (they can contain user-gated content).
        source: '/((?!_next/static/|fc-runtime/|api/v1/themes/|api/v1/plugins/[^/]+/ui/).*)',
        headers: [{ key: 'Cache-Control', value: 'private, no-cache' }],
      },
    ];
  },
};

module.exports = nextConfig;
