import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { unlink, writeFile } from "fs/promises"
import path from "path"

let localStore: typeof import("../lib/localStore.js")

const TEST_DIR = path.resolve(process.cwd(), "test")
const TEST_DATA_FILE = path.join(TEST_DIR, "test_localstore_isolated.json")
const SEED_FILE = path.resolve(process.cwd(), "data", "games.json")

function setupTestEnv() {
  process.env.DATA_FILE = TEST_DATA_FILE
  process.env.SEED_GAMES_FILE = SEED_FILE
}

async function cleanup() {
  try {
    await unlink(TEST_DATA_FILE)
  } catch {
    // ignore
  }
}

describe("createUser", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should create a user with all fields", async () => {
    const ts = Date.now()
    const user = await localStore.createUser({
      username: `user_${ts}_full`,
      email: "test@example.com",
      authProvider: "local",
      passwordHash: "hashed123",
    })
    expect(user.Username).toBe(`user_${ts}_full`)
    expect(user.Email).toBe("test@example.com")
    expect(user.AuthProvider).toBe("local")
    expect(user.PasswordHash).toBe("hashed123")
    expect(user.UserID).toBeDefined()
  })

  it("should create a user without optional fields", async () => {
    const ts = Date.now()
    const user = await localStore.createUser({
      username: `user_${ts}_minimal`,
      authProvider: "google",
    })
    expect(user.Username).toBe(`user_${ts}_minimal`)
    expect(user.Email).toBe("")
    expect(user.AuthProvider).toBe("google")
    expect(user.PasswordHash).toBeUndefined()
  })

  it("should trim whitespace from username", async () => {
    const user = await localStore.createUser({
      username: "  spaced_user  ",
      authProvider: "local",
    })
    expect(user.Username).toBe("spaced_user")
  })

  it("should throw on duplicate username", async () => {
    const unique = `dup_${Date.now()}`
    await localStore.createUser({ username: unique, authProvider: "local" })
    await expect(
      localStore.createUser({ username: unique, authProvider: "local" }),
    ).rejects.toThrow("Username already exists")
  })

  it("should be case-insensitive for duplicate check", async () => {
    const unique = `case_${Date.now()}`
    await localStore.createUser({ username: unique, authProvider: "local" })
    await expect(
      localStore.createUser({ username: unique.toLowerCase(), authProvider: "local" }),
    ).rejects.toThrow("Username already exists")
  })

  it("should throw on empty username", async () => {
    await expect(
      localStore.createUser({ username: "  ", authProvider: "local" }),
    ).rejects.toThrow("Username is required")
  })

  it("should generate a UUID for UserID", async () => {
    const user = await localStore.createUser({
      username: `uuid_${Date.now()}`,
      authProvider: "local",
    })
    expect(user.UserID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it("should accept a custom userId", async () => {
    const ts = Date.now()
    const user = await localStore.createUser({
      userId: `custom-${ts}`,
      username: `custom_user`,
      authProvider: "local",
    })
    expect(user.UserID).toBe(`custom-${ts}`)
  })
})

describe("getUserById / getUserByUsername", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should find user by ID", async () => {
    const ts = Date.now()
    const user = await localStore.createUser({
      username: `finduser_${ts}`,
      authProvider: "local",
    })
    const found = await localStore.getUserById(user.UserID)
    expect(found).toBeDefined()
    expect(found!.Username).toBe(`finduser_${ts}`)
  })

  it("should return undefined for non-existent user ID", async () => {
    const found = await localStore.getUserById("non-existent-id-12345")
    expect(found).toBeUndefined()
  })

  it("should find user by username (case-insensitive)", async () => {
    const unique = `Mixed_${Date.now()}`
    const user = await localStore.createUser({ username: unique, authProvider: "local" })
    const found = await localStore.getUserByUsername(unique.toLowerCase())
    expect(found).toBeDefined()
    expect(found!.Username).toBe(unique)
  })

  it("should return undefined for non-existent username", async () => {
    const found = await localStore.getUserByUsername(`nobody_${Date.now()}`)
    expect(found).toBeUndefined()
  })
})

describe("hasUsers", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should return false when no users exist", async () => {
    expect(await localStore.hasUsers()).toBe(false)
  })

  it("should return true after creating a user", async () => {
    await localStore.createUser({
      username: `hasuser_${Date.now()}`,
      authProvider: "local",
    })
    expect(await localStore.hasUsers()).toBe(true)
  })
})

describe("createGame / getGameById", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should create a game with defaults", async () => {
    const ts = Date.now()
    const game = await localStore.createGame({ title: `Default_${ts}` })
    expect(game.title).toBe(`Default_${ts}`)
    expect(game.developer).toBe("Unknown")
    expect(game.genres).toEqual([])
    expect(game.source).toBe("manual")
    expect(game.GameID).toBeDefined()
  })

  it("should create a game with full data", async () => {
    const ts = Date.now()
    const game = await localStore.createGame({
      title: `Full_${ts}`,
      developer: "Studio X",
      genres: ["Action", "Adventure"],
      lDescript: "A full description",
      sDescript: "Short desc",
      s3: ["https://img.com/1.jpg"],
      source: "steam",
      appid: 730,
      installdir: "csgo",
    })
    expect(game.title).toBe(`Full_${ts}`)
    expect(game.developer).toBe("Studio X")
    expect(game.genres).toEqual(["Action", "Adventure"])
    expect(game.appid).toBe(730)
    expect(game.installdir).toBe("csgo")
  })

  it("should find game by ID", async () => {
    const ts = Date.now()
    const game = await localStore.createGame({ title: `FindMe_${ts}` })
    const found = await localStore.getGameById(game.GameID)
    expect(found).toBeDefined()
    expect(found!.title).toBe(`FindMe_${ts}`)
  })

  it("should return undefined for non-existent game", async () => {
    const found = await localStore.getGameById("non-existent-game-12345")
    expect(found).toBeUndefined()
  })
})

describe("getAllGames / getAllGamesWithSource", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should return seed games when no games exist", async () => {
    const games = await localStore.getAllGames()
    expect(games.length).toBeGreaterThan(0)
    const seedGames = games.filter((g) => g.source === "seed")
    expect(seedGames.length).toBeGreaterThan(0)
  })

  it("should return all created games plus seed games", async () => {
    const ts = Date.now()
    await localStore.createGame({ title: `Game1_${ts}` })
    await localStore.createGame({ title: `Game2_${ts}` })
    const games = await localStore.getAllGames()
    const manualGames = games.filter((g) => g.source === "manual")
    expect(manualGames.length).toBe(2)
  })

  it("should return games with source info", async () => {
    const ts = Date.now()
    await localStore.createGame({ title: `Steam_${ts}`, source: "steam", appid: 730 })
    await localStore.createGame({ title: `Manual_${ts}`, source: "manual" })
    const games = await localStore.getAllGamesWithSource()
    const steamGames = games.filter((g) => g.source === "steam")
    const manualGames = games.filter((g) => g.source === "manual")
    expect(steamGames.length).toBe(1)
    expect(manualGames.length).toBe(1)
  })
})

describe("addGameToCatalog", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should add a discovered game to catalog", async () => {
    const game = await localStore.addGameToCatalog({
      appid: 730,
      name: "Counter-Strike 2",
      installdir: "csgo",
      sizeOnDisk: 15000000000,
    })
    expect(game.appid).toBe(730)
    expect(game.source).toBe("steam")
    expect(game.title).toBe("Counter-Strike 2")
  })

  it("should use metadata when provided", async () => {
    const game = await localStore.addGameToCatalog(
      { appid: 440, name: "TF2", installdir: "tf", sizeOnDisk: 0 },
      {
        title: "Team Fortress 2",
        developer: "Valve",
        genres: ["FPS"],
        shortDescription: "Tactical FPS",
        screenshots: ["https://img.com/1.jpg", "https://img.com/2.jpg"],
        headerImage: "https://img.com/header.jpg",
      },
    )
    expect(game.title).toBe("Team Fortress 2")
    expect(game.developer).toBe("Valve")
    expect(game.genres).toEqual(["FPS"])
    expect(game.sDescript).toBe("Tactical FPS")
    expect(game.s3).toContain("https://img.com/1.jpg")
  })

  it("should return existing game if appid already exists", async () => {
    await localStore.addGameToCatalog({ appid: 440, name: "TF2", installdir: "tf", sizeOnDisk: 0 })
    const existing = await localStore.addGameToCatalog({
      appid: 440,
      name: "TF2 Updated",
      installdir: "tf",
      sizeOnDisk: 20000000000,
    })
    expect(existing.title).toBe("TF2")
  })

  it("should find game by appid", async () => {
    await localStore.addGameToCatalog({ appid: 10, name: "Source SDK", installdir: "sdk", sizeOnDisk: 0 })
    const found = await localStore.getGameByAppId(10)
    expect(found).toBeDefined()
    expect(found!.title).toBe("Source SDK")
  })
})

describe("deleteGame", () => {
  beforeEach(async () => {
    vi.resetModules()
    setupTestEnv()
    localStore = await import("../lib/localStore.js")
  })

  afterEach(async () => {
    await cleanup()
    vi.restoreAllMocks()
  })

  it("should delete an existing game", async () => {
    const ts = Date.now()
    const game = await localStore.createGame({ title: `DeleteMe_${ts}` })
    const success = await localStore.deleteGame(game.GameID)
    expect(success).toBe(true)
    const found = await localStore.getGameById(game.GameID)
    expect(found).toBeUndefined()
  })

  it("should return false for non-existent game", async () => {
    const success = await localStore.deleteGame("non-existent-game-12345")
    expect(success).toBe(false)
  })

  it("should reduce manual game count", async () => {
    const ts = Date.now()
    const g1 = await localStore.createGame({ title: `Count1_${ts}` })
    await localStore.createGame({ title: `Count2_${ts}` })
    await localStore.deleteGame(g1.GameID)
    const games = await localStore.getAllGames()
    const manualGames = games.filter((g) => g.source === "manual")
    expect(manualGames.length).toBe(1)
  })
})
