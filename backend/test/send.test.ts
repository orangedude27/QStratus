import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  startGameSession,
  resolveStart,
  resetPendingStarts,
} from "../socket/send.js"
import { createSession, getSessions, resetSessions } from "../socket/sessions.js"
import {
  updateHeartbeat,
  getAllNodes,
  resetNodes,
} from "../socket/node.js"

function makeMockWS(): WebSocket {
  const mock: WebSocket = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket
  return mock
}

function makeValidPayload(overrides: Record<string, any> = {}) {
  return {
    hostname: "test-node",
    games: ["game-1", "game-2"],
    sessions: [],
    ip: "192.168.1.1",
    ...overrides,
  }
}

function cleanup() {
  resetNodes()
  resetSessions()
  resetPendingStarts()
}

describe("startGameSession", () => {
  let sendMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendMock = vi.fn()
    cleanup()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
    vi.useRealTimers()
  })

  it("should return null when no node has the game", async () => {
    const result = await startGameSession(
      "nonexistent-game",
      "user-1",
      "Test User",
      1920,
      1080,
    )
    expect(result).toBeNull()
  })

  it("should return null when node has game but already has sessions", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({
      games: ["game-1"],
      sessions: ["existing-session"],
    })
    updateHeartbeat(ws, payload)

    const result = await startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )
    expect(result).toBeNull()
  })

  it("should find a node with the game and no sessions", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    // Advance timers to fire the setTimeout (10s timeout)
    await vi.advanceTimersByTimeAsync(10001)
    const result = await promise

    expect(result).toBeNull()
  })

  it("should send start message to the correct node", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    // Check send was called before advancing timers
    expect(sendMock).toHaveBeenCalledTimes(1)
    const sentMessage = JSON.parse(sendMock.mock.calls[0][0])
    expect(sentMessage.type).toBe("start_session")
    expect(sentMessage.payload.session_id).toBeDefined()

    // Advance timers to resolve the promise
    await vi.advanceTimersByTimeAsync(10001)
    await promise
  })

  it("should create a session in the session store", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    // Session is created synchronously when startGameSession is called
    const sessions = getSessions()
    expect(sessions.size).toBeGreaterThan(0)
    const session = sessions.values().next().value
    expect(session?.gameId).toBe("game-1")
    expect(session?.userId).toBe("user-1")
    expect(session?.userName).toBe("Test User")

    // Advance timers to resolve the promise
    await vi.advanceTimersByTimeAsync(10001)
    await promise
  })

  it("should include a request_id in the message", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    // request_id is set synchronously
    const sentMessage = JSON.parse(sendMock.mock.calls[0][0])
    expect(sentMessage.request_id).toBeDefined()
    expect(typeof sentMessage.request_id).toBe("string")

    // Advance timers to resolve the promise
    await vi.advanceTimersByTimeAsync(10001)
    await promise
  })

  it("should include a timestamp in the message", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    const sentMessage = JSON.parse(sendMock.mock.calls[0][0])
    expect(sentMessage.timestamp).toBeDefined()
    expect(new Date(sentMessage.timestamp).getTime()).toBeGreaterThan(0)

    // Advance timers to resolve the promise
    await vi.advanceTimersByTimeAsync(10001)
    await promise
  })

  it("should include session_id in the message payload", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    const sentMessage = JSON.parse(sendMock.mock.calls[0][0])
    expect(sentMessage.payload.session_id).toBeDefined()
    expect(typeof sentMessage.payload.session_id).toBe("string")

    // Advance timers to resolve the promise
    await vi.advanceTimersByTimeAsync(10001)
    await promise
  })

  it("should return null on timeout if node never responds", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()

    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    await vi.advanceTimersByTimeAsync(10001)

    const result = await promise
    expect(result).toBeNull()
  })

  it("should clean up session on timeout", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()

    const promise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )
    await vi.advanceTimersByTimeAsync(10001)
    await promise

    const sessions = getSessions()
    expect(sessions.size).toBe(0)
  })
})

describe("resolveStart", () => {
  let sendMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendMock = vi.fn()
    cleanup()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
    vi.useRealTimers()
  })

  it("should resolve a pending start with confirmation", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const startPromise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    const confirmation = {
      type: "start_confirmed",
      request_id: "",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: "",
        tls_fingerprint: "abc123",
        ip: "192.168.1.1",
      },
    }

    const sentMsg = JSON.parse(sendMock.mock.calls[0][0])
    confirmation.request_id = sentMsg.request_id
    confirmation.payload.session_id = sentMsg.payload.session_id

    resolveStart(confirmation as any)

    const result = await startPromise
    expect(result).not.toBeNull()
    expect(result?.payload.tls_fingerprint).toBe("abc123")
    expect(result?.payload.ip).toBe("192.168.1.1")
  })

  it("should warn for unknown session confirmation", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})

    resolveStart({
      type: "start_confirmed",
      request_id: "unknown-request",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: "unknown-session",
        tls_fingerprint: "abc123",
        ip: "192.168.1.1",
      },
    } as any)

    expect(consoleWarn).toHaveBeenCalledWith(
      "Received start confirmation for unknown session:",
      "unknown-session",
    )

    consoleWarn.mockRestore()
  })

  it("should handle confirmation with matching session_id", async () => {
    const ws = makeMockWS()
    ws.send = sendMock
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })
    updateHeartbeat(ws, payload)

    vi.useFakeTimers()
    const startPromise = startGameSession(
      "game-1",
      "user-1",
      "Test User",
      1920,
      1080,
    )

    const sentMsg = JSON.parse(sendMock.mock.calls[0][0])

    resolveStart({
      type: "start_confirmed",
      request_id: "",
      timestamp: new Date().toISOString(),
      payload: {
        session_id: sentMsg.payload.session_id,
        tls_fingerprint: "fp123",
        ip: "10.0.0.1",
      },
    } as any)

    const result = await startPromise
    expect(result).not.toBeNull()
    expect(result?.payload.tls_fingerprint).toBe("fp123")
  })
})
