/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/admin-api/:path*',
        destination: 'http://localhost:8000/api/v1/admin/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
