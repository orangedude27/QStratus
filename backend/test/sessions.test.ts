import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  createSession,
  deleteSession,
  getSessions,
  resetSessions,
  Session,
} from "../socket/sessions.js"

function cleanup() {
  resetSessions()
}

describe("createSession", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should create a new session", async () => {
    const session: Session = {
      start: Math.floor(Date.now() / 1000),
      node: "test-node",
      sessionId: "session-1",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Test User",
    }

    createSession(session)

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    expect(sessions.has("session-1")).toBe(true)
  })

  it("should store all session fields correctly", async () => {
    const session: Session = {
      start: 1700000000,
      node: "node-alpha",
      sessionId: "unique-session-id",
      gameId: "cs2",
      width: 2560,
      height: 1440,
      userId: "user-abc",
      userName: "Player One",
    }

    createSession(session)

    const sessions = getSessions()
    const stored = sessions.get("unique-session-id")
    expect(stored).toBeDefined()
    expect(stored?.node).toBe("node-alpha")
    expect(stored?.gameId).toBe("cs2")
    expect(stored?.width).toBe(2560)
    expect(stored?.height).toBe(1440)
    expect(stored?.userId).toBe("user-abc")
    expect(stored?.userName).toBe("Player One")
  })

  it("should overwrite existing session with same ID", async () => {
    const session1: Session = {
      start: 1700000000,
      node: "node-old",
      sessionId: "session-dup",
      gameId: "game-old",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Old User",
    }

    const session2: Session = {
      start: 1700000001,
      node: "node-new",
      sessionId: "session-dup",
      gameId: "game-new",
      width: 2560,
      height: 1440,
      userId: "user-2",
      userName: "New User",
    }

    createSession(session1)
    createSession(session2)

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    const stored = sessions.get("session-dup")
    expect(stored?.node).toBe("node-new")
    expect(stored?.gameId).toBe("game-new")
    expect(stored?.userName).toBe("New User")
  })

  it("should return undefined from getSessions for non-existent ID", async () => {
    const sessions = getSessions()
    expect(sessions.has("non-existent")).toBe(false)
  })

  it("should store multiple sessions with different IDs", async () => {
    createSession({
      start: 1700000000,
      node: "node-1",
      sessionId: "s1",
      gameId: "g1",
      width: 1920,
      height: 1080,
      userId: "u1",
      userName: "User 1",
    })
    createSession({
      start: 1700000001,
      node: "node-2",
      sessionId: "s2",
      gameId: "g2",
      width: 1280,
      height: 720,
      userId: "u2",
      userName: "User 2",
    })
    createSession({
      start: 1700000002,
      node: "node-1",
      sessionId: "s3",
      gameId: "g1",
      width: 1920,
      height: 1080,
      userId: "u3",
      userName: "User 3",
    })

    const sessions = getSessions()
    expect(sessions.size).toBe(3)
  })
})

describe("deleteSession", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should delete an existing session", async () => {
    createSession({
      start: 1700000000,
      node: "node-1",
      sessionId: "session-to-delete",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Test User",
    })

    deleteSession("session-to-delete")

    const sessions = getSessions()
    expect(sessions.has("session-to-delete")).toBe(false)
  })

  it("should not error when deleting non-existent session", async () => {
    expect(() => deleteSession("non-existent")).not.toThrow()

    const sessions = getSessions()
    expect(sessions.size).toBe(0)
  })

  it("should reduce session count after deletion", async () => {
    createSession({
      start: 1700000000,
      node: "node-1",
      sessionId: "s1",
      gameId: "g1",
      width: 1920,
      height: 1080,
      userId: "u1",
      userName: "User 1",
    })
    createSession({
      start: 1700000001,
      node: "node-2",
      sessionId: "s2",
      gameId: "g2",
      width: 1280,
      height: 720,
      userId: "u2",
      userName: "User 2",
    })

    deleteSession("s1")

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    expect(sessions.has("s2")).toBe(true)
  })
})

describe("getSessions", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should return empty map when no sessions exist", async () => {
    const sessions = getSessions()
    expect(sessions.size).toBe(0)
  })

  it("should return a Map with all sessions", async () => {
    createSession({
      start: 1700000000,
      node: "node-1",
      sessionId: "s1",
      gameId: "g1",
      width: 1920,
      height: 1080,
      userId: "u1",
      userName: "User 1",
    })
    createSession({
      start: 1700000001,
      node: "node-2",
      sessionId: "s2",
      gameId: "g2",
      width: 1280,
      height: 720,
      userId: "u2",
      userName: "User 2",
    })

    const sessions = getSessions()
    expect(sessions).toBeInstanceOf(Map)
    expect(sessions.size).toBe(2)
  })
})
