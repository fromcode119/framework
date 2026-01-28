const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fromcode/core', '@fromcode/react'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'api.fromcode.local',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      }
    ],
  },
  webpack: (config) => {
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
