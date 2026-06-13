import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { Request, Response } from "express"
import {
  ControllerRegisterLocal,
  ControllerLoginLocal,
  ControllerBootstrap,
  ControllerGetUserByToken,
  ControllerCreateUser,
  ControllerLogout,
  ControllerGetAuthConfig,
} from "../routes/authController.js"
import * as localStore from "../lib/localStore.js"
import * as authToken from "../lib/authToken.js"

const mockRes = () => {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const mockReq = (body: Record<string, any> = {}, headers: Record<string, string> = {}) => {
  return {
    body,
    headers,
  } as any
}

describe("ControllerRegisterLocal", () => {
  let res: ReturnType<typeof mockRes>
  let createUserSpy: ReturnType<typeof vi.spyOn>
  let createAuthTokenMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    res = mockRes()
    createAuthTokenMock = vi.fn().mockReturnValue("mock-token")
    createUserSpy = vi
      .spyOn(localStore, "createUser")
      .mockResolvedValue({
        UserID: "user-123",
        Username: "newuser",
        Email: "",
        AuthProvider: "local",
        PasswordHash: "salt:hash",
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should register a user with valid credentials", async () => {
    process.env.AUTH_SECRET = "test-secret-key-for-vitest-only"
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerRegisterLocal: ctrl } = await import("../routes/authController.js")
    await ctrl(mockReq({ username: "newuser", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ Username: "newuser" }),
      }),
    )
    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "newuser",
        authProvider: "local",
      }),
    )
  })

  it("should reject missing username", async () => {
    await ControllerRegisterLocal(mockReq({ password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject missing password", async () => {
    await ControllerRegisterLocal(mockReq({ username: "newuser" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject short passwords", async () => {
    await ControllerRegisterLocal(mockReq({ username: "newuser", password: "short" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Password must be at least 8 characters" })
  })

  it("should reject createUser errors", async () => {
    createUserSpy.mockRejectedValue(new Error("Username already exists"))

    await ControllerRegisterLocal(mockReq({ username: "newuser", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username already exists" })
  })

  it("should create user with empty email", async () => {
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerRegisterLocal: ctrl } = await import("../routes/authController.js")
    await ctrl(mockReq({ username: "newuser", password: "password123" }), res)

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "",
      }),
    )
  })

  it("should hash the password before storing", async () => {
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerRegisterLocal: ctrl } = await import("../routes/authController.js")
    await ctrl(mockReq({ username: "newuser", password: "password123" }), res)

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.stringContaining(":"),
      }),
    )
  })
})

describe("ControllerLoginLocal", () => {
  let res: ReturnType<typeof mockRes>
  let getUserSpy: ReturnType<typeof vi.spyOn>
  let createAuthTokenMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    res = mockRes()
    createAuthTokenMock = vi.fn().mockReturnValue("mock-token")
    getUserSpy = vi
      .spyOn(localStore, "getUserByUsername")
      .mockResolvedValue({
        UserID: "user-123",
        Username: "logintest",
        Email: "test@example.com",
        AuthProvider: "local",
        PasswordHash: "salt:hash",
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  

  it("should reject missing username", async () => {
    await ControllerLoginLocal(mockReq({ password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject missing password", async () => {
    await ControllerLoginLocal(mockReq({ username: "logintest" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject non-existent user", async () => {
    getUserSpy.mockResolvedValue(undefined)

    await ControllerLoginLocal(mockReq({ username: "nobody", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid username or password" })
  })

  it("should reject non-local auth provider", async () => {
    getUserSpy.mockResolvedValue({
      UserID: "user-123",
      Username: "googleuser",
      Email: "test@example.com",
      AuthProvider: "google",
      PasswordHash: undefined,
    })

    await ControllerLoginLocal(mockReq({ username: "googleuser", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid username or password" })
  })

  it("should reject user without password hash", async () => {
    getUserSpy.mockResolvedValue({
      UserID: "user-123",
      Username: "testuser",
      Email: "test@example.com",
      AuthProvider: "local",
      PasswordHash: undefined,
    })

    await ControllerLoginLocal(mockReq({ username: "testuser", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid username or password" })
  })

  it("should handle createUser errors", async () => {
    getUserSpy.mockRejectedValue(new Error("DB error"))

    await ControllerLoginLocal(mockReq({ username: "logintest", password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "DB error" })
  })
})

describe("ControllerBootstrap", () => {
  let res: ReturnType<typeof mockRes>
  let hasUsersSpy: ReturnType<typeof vi.spyOn>
  let createUserSpy: ReturnType<typeof vi.spyOn>
  let createAuthTokenMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    res = mockRes()
    createAuthTokenMock = vi.fn().mockReturnValue("mock-token")
    hasUsersSpy = vi.spyOn(localStore, "hasUsers").mockResolvedValue(false)
    createUserSpy = vi
      .spyOn(localStore, "createUser")
      .mockResolvedValue({
        UserID: "admin-123",
        Username: "admin",
        Email: "admin@example.com",
        AuthProvider: "local",
        PasswordHash: "salt:hash",
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should create admin account when no users exist", async () => {
    process.env.AUTH_SECRET = "test-secret-key-for-vitest-only"
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerBootstrap: ctrl } = await import("../routes/authController.js")
    await ctrl(
      mockReq({ username: "admin", password: "password123", email: "admin@example.com" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Admin account created",
        user: expect.objectContaining({ Username: "admin" }),
      }),
    )
  })

  it("should reject when users already exist", async () => {
    hasUsersSpy.mockResolvedValue(true)

    await ControllerBootstrap(
      mockReq({ username: "admin", password: "password123" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      error: "Bootstrap already completed — users exist",
    })
  })

  it("should reject missing username", async () => {
    await ControllerBootstrap(mockReq({ password: "password123" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject missing password", async () => {
    await ControllerBootstrap(mockReq({ username: "admin" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username and password are required" })
  })

  it("should reject short passwords", async () => {
    await ControllerBootstrap(mockReq({ username: "admin", password: "short" }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Password must be at least 8 characters" })
  })

  it("should create user with provided email", async () => {
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerBootstrap: ctrl } = await import("../routes/authController.js")
    await ctrl(
      mockReq({ username: "admin", password: "password123", email: "admin@example.com" }),
      res,
    )

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@example.com",
      }),
    )
  })

  it("should create user with empty email when not provided", async () => {
    vi.doMock("../lib/authToken.js", () => ({
      ...authToken,
      createAuthToken: createAuthTokenMock,
    }))

    const { ControllerBootstrap: ctrl } = await import("../routes/authController.js")
    await ctrl(
      mockReq({ username: "admin", password: "password123" }),
      res,
    )

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "",
      }),
    )
  })

  it("should reject createUser errors", async () => {
    createUserSpy.mockRejectedValue(new Error("DB error"))

    await ControllerBootstrap(
      mockReq({ username: "admin", password: "password123" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "DB error" })
  })
})

describe("ControllerGetUserByToken", () => {
  let res: ReturnType<typeof mockRes>
  let getUserByIdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    res = mockRes()
    getUserByIdSpy = vi
      .spyOn(localStore, "getUserById")
      .mockResolvedValue({
        UserID: "user-123",
        Username: "tokenuser",
        Email: "token@example.com",
        AuthProvider: "local",
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should return user for valid token", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "user-123",
      email: "token@example.com",
    })

    await ControllerGetUserByToken(
      mockReq({}, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ Username: "tokenuser" }),
      }),
    )
  })

  it("should return 404 when user not found", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "user-123",
      email: "token@example.com",
    })
    getUserByIdSpy.mockResolvedValue(undefined)

    await ControllerGetUserByToken(
      mockReq({}, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" })
  })

  it("should return 401 for invalid token", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockImplementation(() => {
      throw new Error("Invalid or expired token")
    })

    await ControllerGetUserByToken(
      mockReq({}, { authorization: "Bearer bad-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" })
  })

  it("should return 401 for missing authorization header", async () => {
    vi.spyOn(authToken, "getTokenFromAuthorizationHeader").mockImplementation(() => {
      throw new Error("Authorization header missing or malformed")
    })

    await ControllerGetUserByToken(mockReq({}, {}), res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: "Authorization header missing or malformed",
    })
  })
})

describe("ControllerCreateUser", () => {
  let res: ReturnType<typeof mockRes>
  let createUserSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    res = mockRes()
    createUserSpy = vi
      .spyOn(localStore, "createUser")
      .mockResolvedValue({
        UserID: "user-456",
        Username: "subuser",
        Email: "sub@example.com",
        AuthProvider: "google",
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should create a sub-user for Google auth flow", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "parent-123",
      email: "parent@example.com",
    })

    await ControllerCreateUser(
      mockReq({ username: "subuser" }, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ Username: "subuser" }),
      }),
    )
    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "subuser",
        authProvider: "google",
      }),
    )
  })

  it("should reject missing username", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "parent-123",
      email: "parent@example.com",
    })

    await ControllerCreateUser(
      mockReq({}, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Username is required" })
  })

  it("should reject invalid token", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockImplementation(() => {
      throw new Error("Invalid or expired token")
    })

    await ControllerCreateUser(
      mockReq({ username: "subuser" }, { authorization: "Bearer bad-token" }),
      res,
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" })
  })

  it("should reject missing authorization header", async () => {
    vi.spyOn(authToken, "getTokenFromAuthorizationHeader").mockImplementation(() => {
      throw new Error("Authorization header missing or malformed")
    })

    await ControllerCreateUser(mockReq({ username: "subuser" }, {}), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: "Authorization header missing or malformed",
    })
  })

  it("should pass parent userId to createUser", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "parent-123",
      email: "parent@example.com",
    })

    await ControllerCreateUser(
      mockReq({ username: "subuser" }, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "parent-123",
      }),
    )
  })

  it("should pass parent email to createUser", async () => {
    vi.spyOn(authToken, "verifyAuthToken").mockReturnValue({
      userId: "parent-123",
      email: "parent@example.com",
    })

    await ControllerCreateUser(
      mockReq({ username: "subuser" }, { authorization: "Bearer valid-token" }),
      res,
    )

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "parent@example.com",
      }),
    )
  })
})

describe("ControllerLogout", () => {
  it("should return ok response", async () => {
    const res = mockRes()

    await ControllerLogout(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })
})

describe("ControllerGetAuthConfig", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key]
    })
  })

  it("should return config with all features disabled by default", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    process.env.WHITELISTED_USERS = "[]"

    const res = mockRes()
    await ControllerGetAuthConfig(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      googleEnabled: false,
      whitelistEnabled: false,
      localEnabled: true,
    })
  })

  it("should enable google when GOOGLE_CLIENT_ID is set", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
    process.env.WHITELISTED_USERS = "[]"

    const res = mockRes()
    await ControllerGetAuthConfig(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      googleEnabled: true,
      whitelistEnabled: false,
      localEnabled: true,
    })
  })

  it("should enable whitelist when WHITELISTED_USERS has entries", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    process.env.WHITELISTED_USERS = '["user1", "user2"]'

    const res = mockRes()
    await ControllerGetAuthConfig(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      googleEnabled: false,
      whitelistEnabled: true,
      localEnabled: true,
    })
  })

  it("should disable whitelist when WHITELISTED_USERS is empty array", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    process.env.WHITELISTED_USERS = "[]"

    const res = mockRes()
    await ControllerGetAuthConfig(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      googleEnabled: false,
      whitelistEnabled: false,
      localEnabled: true,
    })
  })

  it("should handle missing WHITELISTED_USERS gracefully", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.WHITELISTED_USERS

    const res = mockRes()
    await ControllerGetAuthConfig(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      googleEnabled: false,
      whitelistEnabled: false,
      localEnabled: true,
    })
  })
})
