import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

// Redact sensitive values from any log payload before they hit transports.
// Paths use pino's fast-redact syntax (https://github.com/davidmarkclements/fast-redact).
// '*' matches any single property; nested paths walk into objects.
// Add new patterns conservatively — over-redaction is preferable to leaking
// secrets, but missing a path defeats the purpose.
const redactPaths = [
  '*.password',
  '*.passwordHash',
  '*.apiKey',
  '*.api_key',
  '*.clientSecret',
  '*.client_secret',
  '*.secretAccessKey',
  '*.secret_access_key',
  '*.token',
  '*.refreshToken',
  '*.refresh_token',
  '*.accessToken',
  '*.access_token',
  '*.encryptedCredentials',
  '*.encrypted_credentials',
  '*.privateKey',
  '*.private_key',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.NEXTAUTH_SECRET',
  '*.JWT_SECRET',
  '*.ENCRYPTION_KEY',
  'body.password',
  'body.newPassword',
  'body.token',
]

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  base: { service: 'compliguard', version: process.env.APP_VERSION || '2.0.0' },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
})

export default logger
