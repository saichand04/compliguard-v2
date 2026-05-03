import { RateLimiterMemory } from 'rate-limiter-flexible'

// In-memory rate limiters — for production with multiple instances, swap to Redis:
// import { RateLimiterRedis } from 'rate-limiter-flexible'
// import { createClient } from 'ioredis'
// const redisClient = new Redis(process.env.REDIS_URL)

/** Auth endpoints: 10 attempts per 15 minutes */
export const authLimiter = new RateLimiterMemory({
  keyPrefix: 'auth',
  points: 10,
  duration: 900,     // 15 minutes
  blockDuration: 900, // block for 15 minutes after exhaustion
})

/** General API endpoints: 100 requests per minute */
export const apiLimiter = new RateLimiterMemory({
  keyPrefix: 'api',
  points: 100,
  duration: 60,
})

/** Evidence upload endpoint: 20 uploads per hour */
export const uploadLimiter = new RateLimiterMemory({
  keyPrefix: 'upload',
  points: 20,
  duration: 3600,
})

/** Setup wizard endpoints: 30 requests per minute */
export const setupLimiter = new RateLimiterMemory({
  keyPrefix: 'setup',
  points: 30,
  duration: 60,
})

/**
 * Consume a rate limit point for the given key.
 * Throws with message 'RATE_LIMITED' if the limit is exceeded.
 */
export async function checkRateLimit(limiter: RateLimiterMemory, key: string): Promise<void> {
  try {
    await limiter.consume(key)
  } catch {
    throw new Error('RATE_LIMITED')
  }
}

/**
 * Get remaining points for a key without consuming.
 */
export async function getRemainingPoints(
  limiter: RateLimiterMemory,
  key: string
): Promise<number> {
  const res = await limiter.get(key)
  return res ? limiter.points - res.consumedPoints : limiter.points
}
