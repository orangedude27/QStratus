import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import request from "supertest"
import express from "express"
import { setupTestEnv, cleanupTestEnv } from "./setup.js"
import gamesRoutes from "../routes/games.js"
import { resetStore } from "../lib/localStore.js"
import { mkdir, writeFile, rm } from "fs/promises"
import path from "path"
import { setSteamLibraryPath } from "../lib/steamScanner.js"

const TEST_LIBRARY_DIR = path.resolve(process.cwd(), "test", "games_controller_steam_lib")

function createApp() {
  const app = express()
  app.use(express.json())
  app.use("/games", gamesRoutes)
  return app
}

function createAcfContent(overrides: Record<string, string> = {}): string {
  const base = {
    appid: "730",
    Name: "Counter-Strike 2",
    installdir: "csgo",
    SizeOnDisk: "15000000000",
    LastUpdated: "1700000000",
    StateFlags: "4",
  }
  const content = Object.entries({ ...base, ...overrides })
    .map(([k, v]) => `"${k}" "${v}"`)
    .join("\n")
  return `[AppState]\n${content}`
}

async function setupLibrary() {
  await mkdir(TEST_LIBRARY_DIR, { recursive: true })
  await writeFile(
    path.join(TEST_LIBRARY_DIR, "appmanifest_730.acf"),
    createAcfContent(),
  )
  await writeFile(
    path.join(TEST_LIBRARY_DIR, "appmanifest_440.acf"),
    createAcfContent({ appid: "440", Name: "Team Fortress 2" }),
  )
}

async function cleanupLibrary() {
  try {
    await rm(TEST_LIBRARY_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

describe("GET /games", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    resetStore()
  })

  it("should return all games", async () => {
    const res = await request(app).get("/games")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it("should include seed games", async () => {
    const res = await request(app).get("/games")
    expect(res.body.length).toBeGreaterThan(0)
  })
})

describe("GET /games/:id", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    resetStore()
  })

  it("should return a game by ID", async () => {
    const res = await request(app).get("/games")
    const gameId = res.body[0].GameID
    const gameRes = await request(app).get(`/games/${gameId}`)
    expect(gameRes.status).toBe(200)
    expect(gameRes.body.GameID).toBe(gameId)
  })

  it("should return 404 for non-existent game", async () => {
    const res = await request(app).get("/games/non-existent-id")
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Game not found")
  })
})

describe("POST /games/scan", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    setSteamLibraryPath(TEST_LIBRARY_DIR)
    await setupLibrary()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    await cleanupLibrary()
    setSteamLibraryPath("/data/steam/steamapps")
    resetStore()
  })

  it("should return discovered games", async () => {
    const res = await request(app).post("/games/scan")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("discovered")
    expect(res.body).toHaveProperty("existing")
    expect(Array.isArray(res.body.discovered)).toBe(true)
    expect(res.body.discovered.length).toBe(2)
  })

  it("should return empty discovered when games are already in catalog", async () => {
    // First scan to add games
    await request(app).post("/games/scan")

    // Claim both games
    await request(app).post("/games/discovered/730/claim")
    await request(app).post("/games/discovered/440/claim")

    // Scan again
    const res = await request(app).post("/games/scan")
    expect(res.body.discovered.length).toBe(0)
    expect(res.body.existing.length).toBe(2)
  })
})

describe("GET /games/discovered", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    setSteamLibraryPath(TEST_LIBRARY_DIR)
    await setupLibrary()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    await cleanupLibrary()
    setSteamLibraryPath("/data/steam/steamapps")
    resetStore()
  })

  it("should return discovered games", async () => {
    const res = await request(app).get("/games/discovered")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("discovered")
    expect(res.body.discovered.length).toBe(2)
  })
})

describe("POST /games/discovered/:appid/claim", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    setSteamLibraryPath(TEST_LIBRARY_DIR)
    await setupLibrary()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    await cleanupLibrary()
    setSteamLibraryPath("/data/steam/steamapps")
    resetStore()
  })

  it("should claim a discovered game", async () => {
    const res = await request(app).post("/games/discovered/730/claim")
    expect(res.status).toBe(201)
    expect(res.body.title).toBeDefined()
    expect(res.body.appid).toBe(730)
    expect(res.body.source).toBe("steam")
  })

  it("should return existing game if already claimed", async () => {
    await request(app).post("/games/discovered/730/claim")
    const res = await request(app).post("/games/discovered/730/claim")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Game already in catalog")
  })

  it("should return 400 for invalid appid", async () => {
    const res = await request(app).post("/games/discovered/abc/claim")
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Invalid AppID")
  })

  it("should return 400 for non-numeric appid", async () => {
    const res = await request(app).post("/games/discovered/abc/claim")
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Invalid AppID")
  })
})

describe("POST /games", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    resetStore()
  })

  it("should create a manual game", async () => {
    const res = await request(app)
      .post("/games")
      .send({
        title: "My Game",
        developer: "Indie Dev",
        genres: ["Indie"],
        lDescript: "A great game",
      })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe("My Game")
    expect(res.body.source).toBe("manual")
  })

  it("should return 400 without title", async () => {
    const res = await request(app).post("/games").send({ developer: "Dev" })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Game title is required")
  })

  it("should set defaults for missing fields", async () => {
    const res = await request(app).post("/games").send({ title: "Simple" })
    expect(res.status).toBe(201)
    expect(res.body.developer).toBe("Unknown")
    expect(res.body.genres).toEqual([])
    expect(res.body.sDescript).toBe("Simple")
  })
})

describe("DELETE /games/:id", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    resetStore()
  })

  it("should delete a game", async () => {
    const createRes = await request(app)
      .post("/games")
      .send({ title: "Delete Me" })
    const deleteRes = await request(app).delete(`/games/${createRes.body.GameID}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.success).toBe(true)
  })

  it("should return 404 for non-existent game", async () => {
    const res = await request(app).delete("/games/non-existent")
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Game not found")
  })

  it("should return 404 for missing ID", async () => {
    const res = await request(app).delete("/games/")
    expect(res.status).toBe(404)
  })
})
