import { access, mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

export type UserRecord = {
  UserID: string
  Username: string
  Email: string
  AuthProvider: "google" | "local"
  PasswordHash?: string
}

export type GameRecord = {
  GameID: string
  appid?: number
  source: "steam" | "non-steam" | "manual" | "seed"
  installdir?: string
  developer: string
  genres: string[]
  lDescript: string
  s3: string[]
  sDescript: string
  title: string
}

type StoreData = {
  users: UserRecord[]
  games: GameRecord[]
}

const dataFilePath = process.env.DATA_FILE || path.resolve(process.cwd(), "storage", "store.json")
const seedGamesPath = process.env.SEED_GAMES_FILE || path.resolve(process.cwd(), "data", "games.json")

let storeData: StoreData | null = null
let writeQueue = Promise.resolve()

const pathExists = async (target: string) => {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

const readSeedGames = async (): Promise<GameRecord[]> => {
  if (!(await pathExists(seedGamesPath))) {
    return []
  }

  try {
    const content = await readFile(seedGamesPath, "utf8")
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((g) => typeof g?.GameID === "string")
  } catch {
    return []
  }
}

const persist = async () => {
  if (!storeData) {
    return
  }

  const dir = path.dirname(dataFilePath)
  await mkdir(dir, { recursive: true })

  // Serialize writes to avoid store corruption during concurrent requests.
  writeQueue = writeQueue.then(() =>
    writeFile(dataFilePath, JSON.stringify(storeData, null, 2), "utf8"),
  )

  await writeQueue
}

const ensureLoaded = async () => {
  if (storeData) {
    return
  }

  const dir = path.dirname(dataFilePath)
  await mkdir(dir, { recursive: true })

  if (!(await pathExists(dataFilePath))) {
    storeData = {
      users: [],
      games: await readSeedGames(),
    }
    await persist()
    return
  }

  const raw = await readFile(dataFilePath, "utf8")
  const parsed = JSON.parse(raw) as Partial<StoreData>

  storeData = {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    games: Array.isArray(parsed.games) ? parsed.games : [],
  }
}

export const getAllGames = async (): Promise<GameRecord[]> => {
  await ensureLoaded()
  return [...storeData!.games]
}

export const getGameById = async (gameId: string): Promise<GameRecord | undefined> => {
  await ensureLoaded()
  return storeData!.games.find((game) => game.GameID === gameId)
}

export const getUserById = async (id: string): Promise<UserRecord | undefined> => {
  await ensureLoaded()
  return storeData!.users.find((user) => user.UserID === id)
}

export const getUserByUsername = async (username: string): Promise<UserRecord | undefined> => {
  await ensureLoaded()
  const normalized = username.trim().toLowerCase()
  return storeData!.users.find((user) => user.Username.trim().toLowerCase() === normalized)
}

export const hasUsers = async (): Promise<boolean> => {
  await ensureLoaded()
  return storeData!.users.length > 0
}

export const createUser = async (input: {
  userId?: string
  username: string
  email?: string
  authProvider: "google" | "local"
  passwordHash?: string
}): Promise<UserRecord> => {
  await ensureLoaded()

  const username = input.username.trim()
  if (!username) {
    throw new Error("Username is required")
  }

  const existing = await getUserByUsername(username)
  if (existing) {
    throw new Error("Username already exists")
  }

  const user: UserRecord = {
    UserID: input.userId || randomUUID(),
    Username: username,
    Email: input.email || "",
    AuthProvider: input.authProvider,
    PasswordHash: input.passwordHash,
  }

  storeData!.users.push(user)
  await persist()

  return user
}

export async function createGame(input: Partial<GameRecord>): Promise<GameRecord> {
  await ensureLoaded()

  const game: GameRecord = {
    GameID: input.GameID || randomUUID(),
    appid: input.appid,
    source: input.source || "manual",
    installdir: input.installdir,
    developer: input.developer || "Unknown",
    genres: input.genres || [],
    lDescript: input.lDescript || "",
    s3: input.s3 || [],
    sDescript: input.sDescript || input.title || "",
    title: input.title || "Unknown Game",
  }

  storeData!.games.push(game)
  await persist()

  return game
}

export async function addGameToCatalog(
  discovered: {
    appid: number
    name: string
    installdir: string
    sizeOnDisk: number
  },
  metadata?: {
    title?: string
    description?: string
    shortDescription?: string
    genres?: string[]
    developer?: string
    publisher?: string
    screenshots?: string[]
    headerImage?: string
    isFreeToPlay?: boolean
  },
): Promise<GameRecord> {
  await ensureLoaded()

  const existing = storeData!.games.find((g) => g.appid === discovered.appid)
  if (existing) {
    return existing
  }

  const game: GameRecord = {
    GameID: randomUUID(),
    appid: discovered.appid,
    source: "steam",
    installdir: discovered.installdir,
    developer: metadata?.developer || metadata?.publisher || "Unknown",
    genres: metadata?.genres || [],
    lDescript: metadata?.description || "",
    s3: metadata?.screenshots?.length
      ? [metadata.screenshots[0]]
      : metadata?.headerImage
        ? [metadata.headerImage]
        : [],
    sDescript: metadata?.shortDescription || metadata?.title || discovered.name,
    title: metadata?.title || discovered.name,
  }

  storeData!.games.push(game)
  await persist()

  return game
}

export async function getAllGamesWithSource(): Promise<GameRecord[]> {
  await ensureLoaded()
  return [...storeData!.games]
}

export async function deleteGame(gameId: string): Promise<boolean> {
  await ensureLoaded()

  const index = storeData!.games.findIndex((g) => g.GameID === gameId)
  if (index === -1) {
    return false
  }

  storeData!.games.splice(index, 1)
  await persist()

  return true
}

export async function getGameByAppId(appid: number): Promise<GameRecord | undefined> {
  await ensureLoaded()
  return storeData!.games.find((g) => g.appid === appid)
}
