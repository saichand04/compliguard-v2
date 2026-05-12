/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino', 'pino-pretty', '@neondatabase/serverless'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Security headers applied to every response. These are static — anything
  // that needs per-request logic (e.g. nonce-based CSP) belongs in middleware.
  //
  // Note on Content-Security-Policy:
  //   script-src includes 'unsafe-inline' because Next.js currently injects
  //   inline bootstrap scripts during hydration. The CSP working group's
  //   recommended remediation is a nonce-based policy, which requires
  //   middleware integration; that's tracked separately. Until then, the
  //   inline-script gap is partially mitigated by frame-ancestors 'none'
  //   (prevents UI redress), X-Frame-Options DENY (defense-in-depth), and
  //   Referrer-Policy no-referrer (no token bleed via Referer header).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' fonts.gstatic.com; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ]
  },
}
export default nextConfig
