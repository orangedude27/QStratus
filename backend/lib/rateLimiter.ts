import type { Request, Response, NextFunction } from "express"

export interface RateLimiterOptions {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: (req: Request) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

const stores: Map<string, RateLimitEntry> = new Map()

function cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of stores.entries()) {
    if (entry.resetTime < now) {
      stores.delete(key)
    }
  }
}

const cleanupInterval = setInterval(() => {
  cleanup()
}, 60000)

export const rateLimiter = (
  options: RateLimiterOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  },
) => {
  const { windowMs, max, message, keyGenerator } = options

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || "unknown"
    const now = Date.now()
    const entry = stores.get(key)

    if (!entry || entry.resetTime < now) {
      stores.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      next()
      return
    }

    entry.count++

    if (entry.count > max) {
      res.set({
        "Retry-After": String(Math.ceil((entry.resetTime - now) / 1000)),
      })
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      })
      return
    }

    res.set({
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(max - entry.count),
      "X-RateLimit-Reset": String(entry.resetTime),
    })
    next()
  }
}

export const loginRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts, please try again after 15 minutes.",
  keyGenerator: (req: Request) => {
    const body = req.body as { username?: string }
    return body.username || req.ip || "unknown"
  },
})

export const registerRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts, please try again later.",
  keyGenerator: (req: Request) => {
    const body = req.body as { username?: string }
    return body.username || req.ip || "unknown"
  },
})

export const generalRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
})

export function getStoreSize(): number {
  return stores.size
}

export function clearStore(): void {
  stores.clear()
}
