/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/admin',
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/admin-api/:path*',
        destination: `${process.env.API_REWRITE_DESTINATION || 'http://localhost:8000'}/api/v1/admin/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
