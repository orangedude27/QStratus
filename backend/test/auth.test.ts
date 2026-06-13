import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import request from "supertest"
import express from "express"
import { setupTestEnv, cleanupTestEnv } from "./setup.js"

let app: express.Application
let testEnv: ReturnType<typeof setupTestEnv>
let authRoutes: any

beforeEach(async () => {
  vi.resetModules()
  testEnv = await setupTestEnv()
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

describe("POST /auth/local/register", () => {
  it("should register a new user successfully", async () => {
    const response = await request(app)
      .post("/auth/local/register")
      .send({ username: "testuser", password: "password123" })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty("token")
    expect(response.body.user).toHaveProperty("Username", "testuser")
    expect(response.body.user).toHaveProperty("UserID")
  })

  it("should reject missing username", async () => {
    const response = await request(app)
      .post("/auth/local/register")
      .send({ password: "password123" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username and password are required")
  })

  it("should reject missing password", async () => {
    const response = await request(app)
      .post("/auth/local/register")
      .send({ username: "testuser" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username and password are required")
  })

  it("should reject short passwords", async () => {
    const response = await request(app)
      .post("/auth/local/register")
      .send({ username: "testuser", password: "short" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Password must be at least 8 characters")
  })

  it("should reject duplicate usernames", async () => {
    await request(app)
      .post("/auth/local/register")
      .send({ username: "duplicate", password: "password123" })

    const response = await request(app)
      .post("/auth/local/register")
      .send({ username: "duplicate", password: "password456" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username already exists")
  })
})

describe("POST /auth/local/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/auth/local/register")
      .send({ username: "logintest", password: "password123" })
  })

  it("should login with correct credentials", async () => {
    const response = await request(app)
      .post("/auth/local/login")
      .send({ username: "logintest", password: "password123" })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("token")
    expect(response.body.user).toHaveProperty("Username", "logintest")
  })

  it("should reject wrong password", async () => {
    const response = await request(app)
      .post("/auth/local/login")
      .send({ username: "logintest", password: "wrongpassword" })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe("Invalid username or password")
  })

  it("should reject non-existent user", async () => {
    const response = await request(app)
      .post("/auth/local/login")
      .send({ username: "nonexistent", password: "password123" })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe("Invalid username or password")
  })

  it("should reject missing username", async () => {
    const response = await request(app)
      .post("/auth/local/login")
      .send({ password: "password123" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username and password are required")
  })

  it("should reject missing password", async () => {
    const response = await request(app)
      .post("/auth/local/login")
      .send({ username: "logintest" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username and password are required")
  })
})

describe("POST /auth/bootstrap", () => {
  it("should create first user when no users exist", async () => {
    const response = await request(app)
      .post("/auth/bootstrap")
      .send({ username: "admin", password: "password123", email: "admin@example.com" })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty("message", "Admin account created")
    expect(response.body).toHaveProperty("token")
    expect(response.body.user).toHaveProperty("Username", "admin")
  })

  it("should reject bootstrap when users already exist", async () => {
    await request(app)
      .post("/auth/bootstrap")
      .send({ username: "first", password: "password123" })

    const response = await request(app)
      .post("/auth/bootstrap")
      .send({ username: "second", password: "password456" })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe("Bootstrap already completed — users exist")
  })

  it("should reject missing credentials", async () => {
    const response = await request(app)
      .post("/auth/bootstrap")
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Username and password are required")
  })

  it("should reject short passwords", async () => {
    const response = await request(app)
      .post("/auth/bootstrap")
      .send({ username: "admin", password: "short" })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Password must be at least 8 characters")
  })
})

describe("GET /auth/config", () => {
  it("should return auth configuration", async () => {
    const response = await request(app).get("/auth/config")

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("googleEnabled", false)
    expect(response.body).toHaveProperty("localEnabled", true)
    expect(response.body).toHaveProperty("whitelistEnabled", false)
  })
})
