import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import express from "express"
import request from "supertest"
import {
  rateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  generalRateLimiter,
  getStoreSize,
  clearStore,
} from "../lib/rateLimiter.js"

function createAppWithLimiter(limiter: ReturnType<typeof rateLimiter>) {
  const app = express()
  app.use(express.json())
  app.use(limiter)
  app.get("/test", (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe("rateLimiter", () => {
  beforeEach(() => clearStore())
  afterEach(() => clearStore())

  it("should allow requests within the limit", async () => {
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 5 }),
    )
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/test")
      expect(res.status).toBe(200)
    }
  })

  it("should reject requests exceeding the limit", async () => {
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 3 }),
    )
    for (let i = 0; i < 3; i++) {
      await request(app).get("/test")
    }
    const res = await request(app).get("/test")
    expect(res.status).toBe(429)
    expect(res.body).toHaveProperty("error")
    expect(res.body).toHaveProperty("retryAfter")
  })

  it("should include rate limit headers on allowed requests", async () => {
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 10 }),
    )
    const res = await request(app).get("/test")
    expect(res.status).toBe(200)
    expect(res.headers["x-ratelimit-limit"]).toBe("10")
    expect(res.headers["x-ratelimit-remaining"]).toBe("9")
    expect(res.headers["x-ratelimit-reset"]).toBeDefined()
  })

  it("should include Retry-After header on 429 response", async () => {
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 1 }),
    )
    await request(app).get("/test")
    const res = await request(app).get("/test")
    expect(res.status).toBe(429)
    expect(res.headers["retry-after"]).toBeDefined()
  })

  it("should use custom keyGenerator", async () => {
    const app = express()
    app.use(
      rateLimiter({
        windowMs: 60000,
        max: 2,
        keyGenerator: (req) => (req.query.apiKey as string) || "unknown",
      }),
    )
    app.get("/test", (_req, res) => res.json({ ok: true }))

    const res1 = await request(app).get("/test?apiKey=key1")
    expect(res1.status).toBe(200)
    const res2 = await request(app).get("/test?apiKey=key1")
    expect(res2.status).toBe(200)
    const res3 = await request(app).get("/test?apiKey=key1")
    expect(res3.status).toBe(429)

    // Different key should still work
    const res4 = await request(app).get("/test?apiKey=key2")
    expect(res4.status).toBe(200)
  })

  it("should use custom error message", async () => {
    const app = createAppWithLimiter(
      rateLimiter({
        windowMs: 60000,
        max: 1,
        message: "Slow down!",
      }),
    )
    await request(app).get("/test")
    const res = await request(app).get("/test")
    expect(res.status).toBe(429)
    expect(res.body.error).toBe("Slow down!")
  })

  it("should track separate keys independently", async () => {
    const app = express()
    app.use(
      rateLimiter({
        windowMs: 60000,
        max: 1,
        keyGenerator: (req) => req.headers["x-user"] as string || "default",
      }),
    )
    app.get("/test", (_req, res) => res.json({ ok: true }))

    const res1 = await request(app).get("/test").set("x-user", "alice")
    expect(res1.status).toBe(200)
    const res2 = await request(app).get("/test").set("x-user", "alice")
    expect(res2.status).toBe(429)

    const res3 = await request(app).get("/test").set("x-user", "bob")
    expect(res3.status).toBe(200)
  })

  it("should return correct store size", async () => {
    expect(getStoreSize()).toBe(0)
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 100 }),
    )
    await request(app).get("/test")
    expect(getStoreSize()).toBeGreaterThan(0)
  })

  it("should clear store on clearStore call", async () => {
    const app = createAppWithLimiter(
      rateLimiter({ windowMs: 60000, max: 100 }),
    )
    await request(app).get("/test")
    expect(getStoreSize()).toBeGreaterThan(0)
    clearStore()
    expect(getStoreSize()).toBe(0)
  })
})

describe("loginRateLimiter", () => {
  beforeEach(() => clearStore())
  afterEach(() => clearStore())

  it("should limit by username", async () => {
    const app = express()
    app.use(express.json())
    app.use(loginRateLimiter)
    app.post("/login", (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < 20; i++) {
      const res = await request(app).post("/login").send({ username: "attacker" })
      expect(res.status).toBe(200)
    }
    const res = await request(app).post("/login").send({ username: "attacker" })
    expect(res.status).toBe(429)
  })

  it("should allow different usernames independently", async () => {
    const app = express()
    app.use(express.json())
    app.use(loginRateLimiter)
    app.post("/login", (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < 20; i++) {
      await request(app).post("/login").send({ username: "user1" })
    }
    const res = await request(app).post("/login").send({ username: "user2" })
    expect(res.status).toBe(200)
  })
})

describe("registerRateLimiter", () => {
  beforeEach(() => clearStore())
  afterEach(() => clearStore())

  it("should allow 5 registrations per hour per username", async () => {
    const app = express()
    app.use(express.json())
    app.use(registerRateLimiter)
    app.post("/register", (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/register").send({ username: "newuser" })
      expect(res.status).toBe(200)
    }
    const res = await request(app).post("/register").send({ username: "newuser" })
    expect(res.status).toBe(429)
  })
})

describe("generalRateLimiter", () => {
  beforeEach(() => clearStore())
  afterEach(() => clearStore())

  it("should allow 100 requests per 15 minutes", async () => {
    const app = express()
    app.use(express.json())
    app.use(generalRateLimiter)
    app.get("/test", (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < 100; i++) {
      const res = await request(app).get("/test")
      expect(res.status).toBe(200)
    }
    const res = await request(app).get("/test")
    expect(res.status).toBe(429)
  })
})
