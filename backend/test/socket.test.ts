import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  updateHeartbeat,
  findNodeByGame,
  deleteNode,
  getAllNodes,
  getNodeInfo,
  resetNodes,
  getNodesMap,
} from "../socket/node.js"
import {
  pruneNodeSessions,
  deleteNodeSessions,
  createSession,
  resetSessions,
  getSessions,
} from "../socket/sessions.js"

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
    hostname: "test-host",
    games: ["game-1", "game-2"],
    sessions: [],
    ip: "192.168.1.1",
    ...overrides,
  }
}

function cleanup() {
  resetNodes()
  resetSessions()
}

describe("updateHeartbeat", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should register a new node on first heartbeat", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()

    updateHeartbeat(ws, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(1)
    const node = nodes.get(ws)
    expect(node?.name).toBe("test-host")
    expect(node?.node_payload.ip).toBe("192.168.1.1")
  })

  it("should update heartbeat timestamp on subsequent heartbeats", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()

    updateHeartbeat(ws, payload)

    const node1 = getNodeInfo(ws)
    expect(node1).toBeDefined()
    const time1 = node1?.last_heartbeat

    await new Promise((r) => setTimeout(r, 10))

    updateHeartbeat(ws, payload)

    const node2 = getNodeInfo(ws)
    expect(node2?.last_heartbeat).toBeGreaterThanOrEqual(time1!)
  })

  it("should reject invalid payload without hostname", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ hostname: null })

    updateHeartbeat(ws, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(0)
  })

  it("should reject invalid payload without games array", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: null })

    updateHeartbeat(ws, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(0)
  })

  it("should reject invalid payload without sessions array", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ sessions: null })

    updateHeartbeat(ws, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(0)
  })

  it("should reject invalid payload without ip", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ ip: null })

    updateHeartbeat(ws, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(0)
  })

  it("should delete duplicate nodes with same identity", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()
    const payload = makeValidPayload({ hostname: "same-host", ip: "10.0.0.1" })

    updateHeartbeat(ws1, payload)
    updateHeartbeat(ws2, payload)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(1)
  })

  it("should keep nodes with different identities", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()
    const payload1 = makeValidPayload({ hostname: "host-a", ip: "10.0.0.1" })
    const payload2 = makeValidPayload({ hostname: "host-b", ip: "10.0.0.2" })

    updateHeartbeat(ws1, payload1)
    updateHeartbeat(ws2, payload2)

    const nodes = getAllNodes()
    expect(nodes.size).toBe(2)
  })

  it("should update node payload on heartbeat", async () => {
    const ws = makeMockWS()
    const payload1 = makeValidPayload({ games: ["game-1"] })
    const payload2 = makeValidPayload({ games: ["game-1", "game-2", "game-3"] })

    updateHeartbeat(ws, payload1)
    updateHeartbeat(ws, payload2)

    const node = getNodeInfo(ws)
    expect(node?.node_payload.games).toEqual(["game-1", "game-2", "game-3"])
  })
})

describe("findNodeByGame", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should return null when no nodes exist", async () => {
    const result = findNodeByGame("game-999", "session-1")
    expect(result).toBeNull()
  })

  it("should find a node that has the game and no active sessions", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })

    updateHeartbeat(ws, payload)

    const result = findNodeByGame("game-1", "session-1")
    expect(result).toBe(ws)
  })

  it("should skip nodes that don't have the requested game", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-2"], sessions: [] })

    updateHeartbeat(ws, payload)

    const result = findNodeByGame("game-1", "session-1")
    expect(result).toBeNull()
  })

  it("should skip nodes that already have active sessions", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({
      games: ["game-1"],
      sessions: ["existing-session"],
    })

    updateHeartbeat(ws, payload)

    const result = findNodeByGame("game-1", "session-1")
    expect(result).toBeNull()
  })

  it("should add session ID to node when found", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })

    updateHeartbeat(ws, payload)

    findNodeByGame("game-1", "session-1")

    const node = getNodeInfo(ws)
    expect(node?.node_payload.sessions).toContain("session-1")
  })

  it("should return null for unresponsive node (heartbeat > 2 min)", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ games: ["game-1"], sessions: [] })

    updateHeartbeat(ws, payload)

    const node = getNodeInfo(ws)
    if (node) {
      node.last_heartbeat = Date.now() - 130000
    }

    const result = findNodeByGame("game-1", "session-1")
    expect(result).toBeNull()
  })

  it("should handle multiple nodes and pick one with the game", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()
    const payload1 = makeValidPayload({
      hostname: "host-a",
      games: ["game-1"],
      sessions: [],
    })
    const payload2 = makeValidPayload({
      hostname: "host-b",
      games: ["game-2"],
      sessions: [],
    })

    updateHeartbeat(ws1, payload1)
    updateHeartbeat(ws2, payload2)

    const result = findNodeByGame("game-1", "session-1")
    expect(result).toBe(ws1)
  })
})

describe("deleteNode", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should remove a node from the nodes map", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()

    updateHeartbeat(ws, payload)
    expect(getAllNodes().size).toBe(1)

    deleteNode(ws)
    expect(getAllNodes().size).toBe(0)
  })

  it("should delete node sessions when node is removed", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ hostname: "test-host" })

    updateHeartbeat(ws, payload)
    createSession({
      start: Date.now(),
      node: "test-host",
      sessionId: "session-1",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "Test User",
    })

    deleteNode(ws)

    const sessions = getSessions()
    expect(sessions.size).toBe(0)
  })

  it("should not error when deleting non-existent node", async () => {
    const ws = makeMockWS()
    expect(() => deleteNode(ws)).not.toThrow()
  })
})

describe("getNodeInfo", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should return node info for registered node", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload()

    updateHeartbeat(ws, payload)

    const info = getNodeInfo(ws)
    expect(info).toBeDefined()
    expect(info?.name).toBe("test-host")
    expect(info?.node_payload.ip).toBe("192.168.1.1")
  })

  it("should return undefined for unregistered node", async () => {
    const ws = makeMockWS()
    const info = getNodeInfo(ws)
    expect(info).toBeUndefined()
  })
})

describe("pruneNodeSessions", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should remove sessions not in nodeSessions list", async () => {
    const ws = makeMockWS()
    const payload = makeValidPayload({ hostname: "test-host" })

    updateHeartbeat(ws, payload)
    createSession({
      start: Date.now(),
      node: "test-host",
      sessionId: "session-1",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "User 1",
    })
    createSession({
      start: Date.now(),
      node: "test-host",
      sessionId: "session-2",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-2",
      userName: "User 2",
    })

    pruneNodeSessions("test-host", ["session-1"])

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    expect(sessions.has("session-1")).toBe(true)
    expect(sessions.has("session-2")).toBe(false)
  })

  it("should not remove sessions from other nodes", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()

    updateHeartbeat(ws1, makeValidPayload({ hostname: "host-a" }))
    updateHeartbeat(ws2, makeValidPayload({ hostname: "host-b" }))

    createSession({
      start: Date.now(),
      node: "host-a",
      sessionId: "session-a",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "User A",
    })
    createSession({
      start: Date.now(),
      node: "host-b",
      sessionId: "session-b",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-2",
      userName: "User B",
    })

    pruneNodeSessions("host-a", [])

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    expect(sessions.has("session-b")).toBe(true)
  })
})

describe("deleteNodeSessions", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("should delete all sessions for a given node", async () => {
    const ws = makeMockWS()
    updateHeartbeat(ws, makeValidPayload({ hostname: "test-host" }))

    createSession({
      start: Date.now(),
      node: "test-host",
      sessionId: "session-1",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "User 1",
    })
    createSession({
      start: Date.now(),
      node: "test-host",
      sessionId: "session-2",
      gameId: "game-2",
      width: 1920,
      height: 1080,
      userId: "user-2",
      userName: "User 2",
    })

    deleteNodeSessions("test-host")

    const sessions = getSessions()
    expect(sessions.size).toBe(0)
  })

  it("should not delete sessions for other nodes", async () => {
    const ws1 = makeMockWS()
    const ws2 = makeMockWS()

    updateHeartbeat(ws1, makeValidPayload({ hostname: "host-a" }))
    updateHeartbeat(ws2, makeValidPayload({ hostname: "host-b" }))

    createSession({
      start: Date.now(),
      node: "host-a",
      sessionId: "session-a",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-1",
      userName: "User A",
    })
    createSession({
      start: Date.now(),
      node: "host-b",
      sessionId: "session-b",
      gameId: "game-1",
      width: 1920,
      height: 1080,
      userId: "user-2",
      userName: "User B",
    })

    deleteNodeSessions("host-a")

    const sessions = getSessions()
    expect(sessions.size).toBe(1)
    expect(sessions.has("session-b")).toBe(true)
  })
})
