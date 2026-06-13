import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import request from "supertest"
import express from "express"
import { setupTestEnv, cleanupTestEnv } from "./setup.js"
import playRoutes from "../routes/play.js"
import * as playController from "../routes/playController.js"
import * as authToken from "../lib/authToken.js"
import * as sendModule from "../socket/send.js"
import * as nodeModule from "../socket/node.js"
import * as sessionsModule from "../socket/sessions.js"
import * as localStore from "../lib/localStore.js"

function createApp() {
  const app = express()
  app.use(express.json())
  app.use("/play", playRoutes)
  return app
}

function makeValidToken() {
  return require("jsonwebtoken").sign(
    { userId: "user-123", email: "test@example.com" },
    "test-secret-key-for-vitest-only",
  )
}

function makeMockWS() {
  return {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn(),
  } as any
}

function makeValidPayload() {
  return {
    hostname: "test-node",
    games: ["game-1"],
    sessions: [],
    ip: "192.168.1.1",
  }
}

describe("GET /play/sessions", () => {
  let app: express.Application
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>
  let getSessionsSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    testEnv = await setupTestEnv()
    app = createApp()
    getSessionsSpy = vi
      .spyOn(sessionsModule, "getSessions")
      .mockImplementation(() => new Map())
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    vi.restoreAllMocks()
  })

  it("should return empty array when no sessions exist", async () => {
    const res = await request(app).get("/play/sessions")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual([])
  })

  it("should return all sessions", async () => {
    getSessionsSpy.mockImplementation(() => {
      const map = new Map()
      map.set("s1", {
        start: 1700000000,
        node: "test-node",
        sessionId: "s1",
        gameId: "game-1",
        width: 1920,
        height: 1080,
        userId: "user-1",
        userName: "Test User",
      })
      map.set("s2", {
        start: 1700000001,
        node: "test-node",
        sessionId: "s2",
        gameId: "game-2",
        width: 1280,
        height: 720,
        userId: "user-2",
        userName: "User Two",
      })
      return map
    })

    const res = await request(app).get("/play/sessions")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)
    expect(res.body[0].sessionId).toBe("s1")
    expect(res.body[1].sessionId).toBe("s2")
  })
})

describe("POST /play/session", () => {
  let app: express.Application
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>
  let verifyTokenSpy: ReturnType<typeof vi.spyOn>
  let startSessionSpy: ReturnType<typeof vi.spyOn>
  let getUserSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    testEnv = await setupTestEnv()
    app = createApp()
    verifyTokenSpy = vi
      .spyOn(authToken, "verifyAuthToken")
      .mockReturnValue({ userId: "user-123", email: "test@example.com" })
    startSessionSpy = vi
      .spyOn(sendModule, "startGameSession")
      .mockResolvedValue(null)
    getUserSpy = vi
      .spyOn(localStore, "getUserById")
      .mockResolvedValue({
        UserID: "user-123",
        Username: "testuser",
        Email: "test@example.com",
        AuthProvider: "local",
      })
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    vi.restoreAllMocks()
  })

  it("should return 400 when game_id is missing", async () => {
    const res = await request(app)
      .post("/play/session")
      .send({ height: 1080, width: 1920 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Missing requested data are required")
  })

  it("should return 400 when height is missing", async () => {
    const res = await request(app)
      .post("/play/session")
      .send({ game_id: "game-1", width: 1920 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Missing requested data are required")
  })

  it("should return 400 when width is missing", async () => {
    const res = await request(app)
      .post("/play/session")
      .send({ game_id: "game-1", height: 1080 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Missing requested data are required")
  })

  it("should return 400 when body is empty", async () => {
    const res = await request(app).post("/play/session").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Missing requested data are required")
  })

  it("should return 401 when authorization header is missing", async () => {
    const res = await request(app)
      .post("/play/session")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Authorization header missing or malformed")
  })

  it("should return 401 when token is invalid", async () => {
    verifyTokenSpy.mockImplementation(() => {
      throw new Error("Invalid or expired token")
    })

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer invalid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Invalid or expired token")
  })

  it("should return 403 when token has no userId", async () => {
    verifyTokenSpy.mockReturnValue({ userId: undefined, email: "test@example.com" })

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Invalid token for user")
  })

  it("should return 403 when user is not found", async () => {
    getUserSpy.mockResolvedValue(undefined)

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe("User not found")
  })

  it("should return 403 when user is not whitelisted", async () => {
    process.env.WHITELISTED_USERS = '["admin", "moderator"]'
    vi.resetModules()

    vi.doMock("../lib/authToken.js", () => ({
      getTokenFromAuthorizationHeader: () => "valid-token",
      verifyAuthToken: () => ({ userId: "user-123", email: "test@example.com" }),
    }))
    vi.doMock("../lib/localStore.js", () => ({
      getUserById: () => Promise.resolve({
        UserID: "user-123",
        Username: "unauthorized-user",
        Email: "test@example.com",
        AuthProvider: "local",
      }),
    }))
    vi.doMock("../socket/send.js", () => ({
      startGameSession: () => Promise.resolve(null),
    }))

    const { default: playRoutes } = await import("../routes/play.js")
    const testApp = express()
    testApp.use(express.json())
    testApp.use("/play", playRoutes)

    const res = await request(testApp)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Sorry, access is temporarily restricted")

    delete process.env.WHITELISTED_USERS
  })

  it("should return 201 when session starts successfully", async () => {
    startSessionSpy.mockResolvedValue({
      type: "start_confirmed",
      request_id: "req-123",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: "session-abc",
        tls_fingerprint: "fp123",
        ip: "192.168.1.1",
      },
    })

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(201)
    expect(res.body.session_id).toBe("session-abc")
    expect(res.body.tls_fingerprint).toBe("fp123")
    expect(res.body.ip).toBe("192.168.1.1")
  })

  it("should return 503 when no node is available", async () => {
    startSessionSpy.mockResolvedValue(null)

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(503)
    expect(res.body.error).toBe("No node available or session timed out")
  })

  it("should pass correct parameters to startGameSession", async () => {
    startSessionSpy.mockResolvedValue({
      type: "start_confirmed",
      request_id: "req-123",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: "session-abc",
        tls_fingerprint: "fp123",
        ip: "192.168.1.1",
      },
    })

    await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "cs2", height: 1440, width: 2560 })

    expect(startSessionSpy).toHaveBeenCalledWith(
      "cs2",
      "user-123",
      "testuser",
      2560,
      1440,
    )
  })

  it("should allow whitelisted users when whitelist is set", async () => {
    process.env.WHITELISTED_USERS = '["testuser", "admin"]'
    getUserSpy.mockResolvedValue({
      UserID: "user-123",
      Username: "testuser",
      Email: "test@example.com",
      AuthProvider: "local",
    })

    startSessionSpy.mockResolvedValue({
      type: "start_confirmed",
      request_id: "req-123",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: "session-abc",
        tls_fingerprint: "fp123",
        ip: "192.168.1.1",
      },
    })

    const res = await request(app)
      .post("/play/session")
      .set("Authorization", "Bearer valid-token")
      .send({ game_id: "game-1", height: 1080, width: 1920 })

    expect(res.status).toBe(201)

    delete process.env.WHITELISTED_USERS
  })
})

describe("GET /play/nodes", () => {
  let app: express.Application
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>
  let getAllNodesSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    testEnv = await setupTestEnv()
    app = createApp()
    getAllNodesSpy = vi
      .spyOn(nodeModule, "getAllNodes")
      .mockImplementation(() => new Map())
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    vi.restoreAllMocks()
  })

  it("should return empty array when no nodes exist", async () => {
    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual([])
  })

  it("should return all nodes", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()

    getAllNodesSpy.mockImplementation(() => {
      const map = new Map()
      map.set(ws1, {
        name: "node-1",
        last_heartbeat: Date.now(),
        node_payload: {
          hostname: "host-a",
          ip: "192.168.1.1",
          games: ["game-1"],
          sessions: [],
        },
      })
      map.set(ws2, {
        name: "node-2",
        last_heartbeat: Date.now(),
        node_payload: {
          hostname: "host-b",
          ip: "192.168.1.2",
          games: ["game-2", "game-3"],
          sessions: ["session-1"],
        },
      })
      return map
    })

    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(2)
  })

  it("should deduplicate nodes by hostname:ip identity", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()

    getAllNodesSpy.mockImplementation(() => {
      const map = new Map()
      map.set(ws1, {
        name: "node-1-old",
        last_heartbeat: Date.now() - 60000,
        node_payload: {
          hostname: "host-a",
          ip: "192.168.1.1",
          games: ["game-1"],
          sessions: [],
        },
      })
      map.set(ws2, {
        name: "node-1-new",
        last_heartbeat: Date.now(),
        node_payload: {
          hostname: "host-a",
          ip: "192.168.1.1",
          games: ["game-1", "game-2"],
          sessions: [],
        },
      })
      return map
    })

    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].name).toBe("node-1-new")
  })

  it("should return node with latest heartbeat when duplicates exist", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()

    getAllNodesSpy.mockImplementation(() => {
      const map = new Map()
      map.set(ws1, {
        name: "old-node",
        last_heartbeat: Date.now() - 120000,
        node_payload: {
          hostname: "host-a",
          ip: "192.168.1.1",
          games: ["game-1"],
          sessions: [],
        },
      })
      map.set(ws2, {
        name: "new-node",
        last_heartbeat: Date.now(),
        node_payload: {
          hostname: "host-a",
          ip: "192.168.1.1",
          games: ["game-2"],
          sessions: [],
        },
      })
      return map
    })

    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].name).toBe("new-node")
  })

  it("should include payload in response", async () => {
    const ws = makeMockWS()

    getAllNodesSpy.mockImplementation(() => {
      const map = new Map()
      map.set(ws, {
        name: "test-node",
        last_heartbeat: Date.now(),
        node_payload: {
          hostname: "test-host",
          ip: "10.0.0.1",
          games: ["game-1", "game-2"],
          sessions: ["s1"],
        },
      })
      return map
    })

    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(res.body[0].payload.hostname).toBe("test-host")
    expect(res.body[0].payload.ip).toBe("10.0.0.1")
    expect(res.body[0].payload.games).toEqual(["game-1", "game-2"])
    expect(res.body[0].payload.sessions).toEqual(["s1"])
  })

  it("should include name and last_heartbeat in response", async () => {
    const ws = makeMockWS()
    const now = Date.now()

    getAllNodesSpy.mockImplementation(() => {
      const map = new Map()
      map.set(ws, {
        name: "my-node",
        last_heartbeat: now,
        node_payload: {
          hostname: "host",
          ip: "1.2.3.4",
          games: [],
          sessions: [],
        },
      })
      return map
    })

    const res = await request(app).get("/play/nodes")
    expect(res.status).toBe(200)
    expect(res.body[0].name).toBe("my-node")
    expect(res.body[0].last_heartbeat).toBe(now)
  })
})
