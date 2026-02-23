const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '',
  reactStrictMode: true,
  transpilePackages: ['@fromcode/react'],
  turbopack: {},
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
