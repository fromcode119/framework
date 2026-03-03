const path = require('path');
const fs = require('fs');

// Dynamically discover all extensions in the packages directory
const packagesDir = path.resolve(__dirname, '..');
const extensions = fs.readdirSync(packagesDir).filter(name => {
  const ext = path.join(packagesDir, name);
  return fs.statSync(ext).isDirectory() && !['core', 'react', 'sdk', 'api', 'admin', 'auth', 'media', 'cache', 'database', 'scheduler'].includes(name);
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '',
  reactStrictMode: true,
  transpilePackages: [
    '@fromcode119/core',
    '@fromcode119/react',
    '@fromcode119/sdk',
    ...extensions.map(ext => `@fromcode119/${ext}`),
  ],
  turbopack: {
    resolveAlias: {
      '@fromcode119/react': '../react/src',
      '@fromcode119/react/*': '../react/src/*',
      '@fromcode119/core': '../core/src',
      '@fromcode119/core/*': '../core/src/*',
      '@fromcode119/sdk': '../sdk/src',
      '@fromcode119/sdk/*': '../sdk/src/*',
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
    remotePatterns: [
      {
        protocol: 'http',
        hostname: process.env.NEXT_PUBLIC_API_URL 
          ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname 
          : 'api.framework.local',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      }
    ],
  },
  webpack: (config, { isServer, dev }) => {
    // Force aliasing of @ to handle cases where the package is inside node_modules
    config.resolve.alias['@'] = path.resolve(__dirname);
    config.resolve.alias['@fromcode119/react$'] = path.resolve(__dirname, '../react/src/index.ts');
    config.resolve.alias['@fromcode119/core$'] = path.resolve(__dirname, '../core/src/index.ts');
    config.resolve.alias['@fromcode119/sdk$'] = path.resolve(__dirname, '../sdk/src/index.ts');

    config.resolve.alias['@fromcode119/react/'] = path.resolve(__dirname, '../react/src/');
    config.resolve.alias['@fromcode119/core/'] = path.resolve(__dirname, '../core/src/');
    config.resolve.alias['@fromcode119/sdk/'] = path.resolve(__dirname, '../sdk/src/');

    config.resolve.alias['@fromcode119/react'] = path.resolve(__dirname, '../react/src/');
    config.resolve.alias['@fromcode119/core'] = path.resolve(__dirname, '../core/src/');
    config.resolve.alias['@fromcode119/sdk'] = path.resolve(__dirname, '../sdk/src/');

    // Dynamically add aliases for all discovered extensions
    extensions.forEach(ext => {
      config.resolve.alias[`@fromcode119/${ext}$`] = path.resolve(__dirname, `../${ext}/src/index.ts`);
      config.resolve.alias[`@fromcode119/${ext}/`] = path.resolve(__dirname, `../${ext}/src/`);
      config.resolve.alias[`@fromcode119/${ext}`] = path.resolve(__dirname, `../${ext}/src/`);
    });

    config.resolve.symlinks = false;

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
