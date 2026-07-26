/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "manifest-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:"
    ].join('; ')
  },
  {
    key: 'Permissions-Policy',
    value: 'local-network-access=()'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  }
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      },
      {
        source: '/sw.js',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          }
        ]
      }
    ];
  }
};
export default nextConfig;
