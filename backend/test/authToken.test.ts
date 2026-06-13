import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import jwt from "jsonwebtoken"
import {
  verifyAuthToken,
  getTokenFromAuthorizationHeader,
  type Token,
} from "../lib/authToken.js"

describe("verifyAuthToken", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env.AUTH_SECRET = "test-secret-key-for-vitest-only"
  })

  afterEach(() => {
    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key]
    })
    if (!process.env.AUTH_SECRET) {
      delete process.env.AUTH_SECRET
    }
  })

  it("should return decoded token for valid token", () => {
    const token = jwt.sign(
      { userId: "user-123", email: "test@example.com" },
      process.env.AUTH_SECRET,
    )

    const result = verifyAuthToken(token)
    expect(result.userId).toBe("user-123")
    expect(result.email).toBe("test@example.com")
  })

  it("should return token without email when not present", () => {
    const token = jwt.sign(
      { userId: "user-456" },
      process.env.AUTH_SECRET,
    )

    const result = verifyAuthToken(token)
    expect(result.userId).toBe("user-456")
    expect(result.email).toBeUndefined()
  })

  it("should throw for invalid token", () => {
    expect(() => verifyAuthToken("invalid-token-string")).toThrow(
      "Invalid or expired token",
    )
  })

  it("should throw for token signed with wrong secret", () => {
    const wrongSecret = "wrong-secret-key"
    const token = jwt.sign(
      { userId: "user-123" },
      wrongSecret,
    )

    expect(() => verifyAuthToken(token)).toThrow("Invalid or expired token")
  })

  it("should throw for empty string token", () => {
    expect(() => verifyAuthToken("")).toThrow("Invalid or expired token")
  })

  it("should throw when AUTH_SECRET is not defined", async () => {
    const originalAuthSecret = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET

    const { verifyAuthToken: verify } = await import("../lib/authToken.js")
    const token = jwt.sign({ userId: "user-123" }, "some-secret")

    expect(() => verify(token)).toThrow(
      "AUTH_SECRET is not defined in environment variables",
    )

    process.env.AUTH_SECRET = originalAuthSecret
  })
})

describe("getTokenFromAuthorizationHeader", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("should extract token from valid Bearer header", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: { authorization: "Bearer my-jwt-token-here" } } as any
    const token = getTokenFromAuthorizationHeader(req)
    expect(token).toBe("my-jwt-token-here")
  })

  it("should extract token with complex JWT format", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const complexToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    const req = { headers: { authorization: `Bearer ${complexToken}` } } as any
    const token = getTokenFromAuthorizationHeader(req)
    expect(token).toBe(complexToken)
  })

  it("should throw when authorization header is missing", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: {} } as any
    expect(() => getTokenFromAuthorizationHeader(req)).toThrow(
      "Authorization header missing or malformed",
    )
  })

  it("should throw when authorization header is empty string", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: { authorization: "" } } as any
    expect(() => getTokenFromAuthorizationHeader(req)).toThrow(
      "Authorization header missing or malformed",
    )
  })

  it("should throw when header does not start with Bearer", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" } } as any
    expect(() => getTokenFromAuthorizationHeader(req)).toThrow(
      "Authorization header missing or malformed",
    )
  })

  it("should handle Bearer with no token after space", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: { authorization: "Bearer " } } as any
    const token = getTokenFromAuthorizationHeader(req)
    expect(token).toBe("")
  })

  it("should preserve leading whitespace in token", async () => {
    const { getTokenFromAuthorizationHeader } = await import("../lib/authToken.js")
    const req = { headers: { authorization: "Bearer  token-with-leading-space" } } as any
    const token = getTokenFromAuthorizationHeader(req)
    expect(token).toBe(" token-with-leading-space")
  })
})
