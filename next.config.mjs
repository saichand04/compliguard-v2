/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino', 'pino-pretty', '@neondatabase/serverless'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}
export default nextConfig
