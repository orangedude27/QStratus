import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import request from "supertest"
import express from "express"
import { setupTestEnv, cleanupTestEnv } from "./setup.js"

let app: express.Application
let testEnv: ReturnType<typeof setupTestEnv>
let authRoutes: any

beforeEach(async () => {
  vi.resetModules()
  testEnv = setupTestEnv()
  const authModule = await import("../routes/auth.js")
  authRoutes = authModule.default
  app = express()
  app.use(express.json())
  app.use("/auth", authRoutes)
})

afterEach(async () => {
  await cleanupTestEnv(testEnv.dataFile)
  vi.restoreAllMocks()
})

describe("Integration: Local auth flow", () => {
  it("should complete full local auth flow: register -> login -> get user", async () => {
    // Step 1: Register
    const registerRes = await request(app)
      .post("/auth/local/register")
      .send({ username: "integration_user", password: "password123" })

    expect(registerRes.status).toBe(201)
    const token = registerRes.body.token
    expect(token).toBeDefined()

    // Step 2: Login with same credentials
    const loginRes = await request(app)
      .post("/auth/local/login")
      .send({ username: "integration_user", password: "password123" })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.token).toBeDefined()
    expect(loginRes.body.user.Username).toBe("integration_user")

    // Step 3: Use token to get user info
    const userRes = await request(app)
      .get("/auth/")
      .set("Authorization", `Bearer ${loginRes.body.token}`)

    expect(userRes.status).toBe(200)
    expect(userRes.body.user.Username).toBe("integration_user")
  })

  it("should reject login with wrong password after successful registration", async () => {
    await request(app)
      .post("/auth/local/register")
      .send({ username: "secure_user", password: "password123" })

    const loginRes = await request(app)
      .post("/auth/local/login")
      .send({ username: "secure_user", password: "wrongpassword" })

    expect(loginRes.status).toBe(401)

    // Verify correct login still works
    const correctLogin = await request(app)
      .post("/auth/local/login")
      .send({ username: "secure_user", password: "password123" })

    expect(correctLogin.status).toBe(200)
  })

  it("should handle case-insensitive username lookup on login", async () => {
    await request(app)
      .post("/auth/local/register")
      .send({ username: "CaseSensitive", password: "password123" })

    const loginRes = await request(app)
      .post("/auth/local/login")
      .send({ username: "casesensitive", password: "password123" })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.user.Username).toBe("CaseSensitive")
  })
})

describe("Integration: Bootstrap then register", () => {
  it("should allow registration after bootstrap", async () => {
    // Bootstrap creates first user
    await request(app)
      .post("/auth/bootstrap")
      .send({ username: "admin", password: "password123" })

    // Regular registration should work for new users
    const registerRes = await request(app)
      .post("/auth/local/register")
      .send({ username: "regular_user", password: "password456" })

    expect(registerRes.status).toBe(201)
    expect(registerRes.body.user.Username).toBe("regular_user")
  })

  it("should allow bootstrap user to login", async () => {
    await request(app)
      .post("/auth/bootstrap")
      .send({ username: "admin", password: "password123" })

    const loginRes = await request(app)
      .post("/auth/local/login")
      .send({ username: "admin", password: "password123" })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.user.Username).toBe("admin")
  })
})

describe("Integration: Auth config endpoint", () => {
  it("should show googleEnabled=false when no GOOGLE_CLIENT_ID", async () => {
    const response = await request(app).get("/auth/config")
    expect(response.body.googleEnabled).toBe(false)
  })

  it("should show localEnabled=true always", async () => {
    const response = await request(app).get("/auth/config")
    expect(response.body.localEnabled).toBe(true)
  })
})
