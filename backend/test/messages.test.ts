import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { handleMessage } from "../socket/messages.js"
import {
  updateHeartbeat,
  deleteNode,
  getNodeInfo,
  resetNodes,
} from "../socket/node.js"
import {
  createSession,
  deleteSession,
  getSessions,
  resetSessions,
} from "../socket/sessions.js"
import { resetPendingStarts } from "../socket/send.js"

function makeMockWS(): WebSocket {
  return {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket
}

function makeValidPayload(overrides: Record<string, any> = {}) {
  return {
    hostname: "test-node",
    games: ["game-1"],
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

describe("handleMessage - heartbeat", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should call updateHeartbeat for heartbeat message", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()

    handleMessage(ws, {
      type: "heartbeat",
      payload,
    })

    const node = getNodeInfo(ws)
    expect(node).toBeDefined()
    expect(node?.name).toBe("test-node")
  })

  it("should update heartbeat with new payload data", async () => {
    const ws = makeMockWS()

    handleMessage(ws, {
      type: "heartbeat",
      payload: makeValidPayload({
        games: ["game-1"],
        sessions: ["s1"],
      }),
    })

    handleMessage(ws, {
      type: "heartbeat",
      payload: makeValidPayload({
        games: ["game-1", "game-2"],
        sessions: [],
      }),
    })

    const node = getNodeInfo(ws)
    expect(node?.node_payload.games).toEqual(["game-1", "game-2"])
    expect(node?.node_payload.sessions).toEqual([])
  })
})

describe("handleMessage - start_confirmed", () => {
  let resolveStartMock: ReturnType<typeof vi.fn>
  let getNodeInfoMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    cleanup()
    const sendModule = await import("../socket/send.js")
    resolveStartMock = vi
      .spyOn(sendModule, "resolveStart")
      .mockImplementation(() => {})

    const nodeModule = await import("../socket/node.js")
    getNodeInfoMock = vi
      .spyOn(nodeModule, "getNodeInfo")
      .mockReturnValue(undefined)
  })

  afterEach(() => {
    resolveStartMock.mockRestore()
    getNodeInfoMock.mockRestore()
    cleanup()
  })

  it("should call resolveStart for start_confirmed message", async () => {
    const ws = makeMockWS()

    handleMessage(ws, {
      type: "start_confirmed",
      payload: {
        session_id: "session-1",
        tls_fingerprint: "abc123",
      },
    })

    expect(resolveStartMock).toHaveBeenCalledTimes(1)
    const callArg = resolveStartMock.mock.calls[0][0]
    expect(callArg.payload.session_id).toBe("session-1")
    expect(callArg.payload.tls_fingerprint).toBe("abc123")
  })

  it("should throw when session_id is missing", async () => {
    const ws = makeMockWS()

    expect(() => {
      handleMessage(ws, {
        type: "start_confirmed",
        payload: { tls_fingerprint: "abc123" },
      })
    }).toThrow("Missing required fields")
  })

  it("should throw when tls_fingerprint is missing", async () => {
    const ws = makeMockWS()

    expect(() => {
      handleMessage(ws, {
        type: "start_confirmed",
        payload: { session_id: "session-1" },
      })
    }).toThrow("Missing required fields")
  })

  it("should pass ip from nodeInfo to payload", async () => {
    const ws = makeMockWS()
    const nodeInfo = {
      node_payload: { ip: "10.0.0.1" },
    }
    getNodeInfoMock.mockReturnValue(nodeInfo as any)

    handleMessage(ws, {
      type: "start_confirmed",
      payload: {
        session_id: "session-1",
        tls_fingerprint: "abc123",
      },
    })

    expect(resolveStartMock).toHaveBeenCalledTimes(1)
    const callArg = resolveStartMock.mock.calls[0][0]
    expect(callArg.payload.ip).toBe("10.0.0.1")
  })
})

describe("handleMessage - stop_session", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should delete the session", async () => {
    createSession({
      start: Date.now(),
      node: "test-node",
      sessionId: "session-to-stop",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Test User",
    })

    handleMessage(null as any, {
      type: "stop_session",
      payload: { session_id: "session-to-stop" },
    })

    const sessions = getSessions()
    expect(sessions.has("session-to-stop")).toBe(false)
  })

  it("should not error when session does not exist", async () => {
    expect(() => {
      handleMessage(null as any, {
        type: "stop_session",
        payload: { session_id: "non-existent" },
      })
    }).not.toThrow()
  })
})

describe("handleMessage - session_error", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should delete the session on error", async () => {
    createSession({
      start: Date.now(),
      node: "test-node",
      sessionId: "error-session",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Test User",
    })

    handleMessage(null as any, {
      type: "session_error",
      payload: { session_id: "error-session" },
    })

    const sessions = getSessions()
    expect(sessions.has("error-session")).toBe(false)
  })

  it("should not error when session does not exist", async () => {
    expect(() => {
      handleMessage(null as any, {
        type: "session_error",
        payload: { session_id: "non-existent" },
      })
    }).not.toThrow()
  })
})

describe("handleMessage - node_disconnect", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should delete the node", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()
    updateHeartbeat(ws, payload)

    handleMessage(ws, {
      type: "node_disconnect",
      payload: {},
    })

    const { getAllNodes } = await import("../socket/node.js")
    expect(getAllNodes().size).toBe(0)
  })

  it("should not error when node does not exist", async () => {
    const ws = makeMockWS()

    expect(() => {
      handleMessage(ws, {
        type: "node_disconnect",
        payload: {},
      })
    }).not.toThrow()
  })
})

describe("handleMessage - unknown type", () => {
  let consoleWarnMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    cleanup()
    consoleWarnMock = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnMock.mockRestore()
    cleanup()
  })

  it("should log warning for unknown message type", async () => {
    const ws = makeMockWS()

    handleMessage(ws, {
      type: "unknown_type",
      payload: {},
    })

    expect(consoleWarnMock).toHaveBeenCalledWith(
      "Unknown message type:",
      "unknown_type",
    )
  })

  it("should not throw for unknown message type", async () => {
    const ws = makeMockWS()

    expect(() => {
      handleMessage(ws, {
        type: "completely_unknown",
        payload: { anything: true },
      })
    }).not.toThrow()
  })
})

describe("handleMessage - message structure", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should handle heartbeat with complex payload", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({
      hostname: "complex-node",
      games: ["g1", "g2", "g3"],
      sessions: ["s1", "s2"],
      ip: "10.20.30.40",
      cpu_load: 0.5,
      memory: 4096,
    })

    handleMessage(ws, {
      type: "heartbeat",
      payload,
    })

    const { getNodeInfo } = await import("../socket/node.js")
    const node = getNodeInfo(ws)
    expect(node?.name).toBe("complex-node")
    expect(node?.node_payload.games).toEqual(["g1", "g2", "g3"])
    expect(node?.node_payload.sessions).toEqual(["s1", "s2"])
    expect(node?.node_payload.ip).toBe("10.20.30.40")
  })

  it("should handle stop_session with valid session_id", async () => {
    createSession({
      start: Date.now(),
      node: "test",
      sessionId: "valid-session",
      gameId: "g1",
      width: 1920,
      height: 1080,
      userId: "u1",
      userName: "User",
    })

    handleMessage(null as any, {
      type: "stop_session",
      payload: { session_id: "valid-session" },
    })

    const sessions = getSessions()
    expect(sessions.has("valid-session")).toBe(false)
  })
})
