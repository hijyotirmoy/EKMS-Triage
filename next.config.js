/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable aggressive webpack disk caching in dev mode
      // to prevent stale chunk hashes and 404 Not Found chunk errors
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
