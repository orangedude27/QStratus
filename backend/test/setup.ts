import { unlink, access } from "fs/promises"
import path from "path"
import { clearStore } from "../lib/rateLimiter.js"
import { resetStore } from "../lib/localStore.js"

const ensureDeleted = async (file: string) => {
  try {
    await access(file)
    await unlink(file)
  } catch {
    // File doesn't exist, nothing to do
  }
}

export const setupTestEnv = async () => {
  const testDir = path.resolve(process.cwd(), "test")
  const dataFile = path.join(testDir, "test_store.json")
  const seedFile = path.join(process.cwd(), "data", "games.json")

  process.env.AUTH_SECRET = "test-secret-key-for-vitest-only"
  process.env.DATA_FILE = dataFile
  process.env.SEED_GAMES_FILE = seedFile
  process.env.GOOGLE_CLIENT_ID = ""
  process.env.WHITELISTED_USERS = "[]"
  process.env.STRATUSD_PASSWORD = "test-password"

  clearStore()
  resetStore()
  await ensureDeleted(dataFile)

  return { dataFile, seedFile }
}

export const cleanupTestEnv = async (dataFile: string) => {
  try {
    await unlink(dataFile)
  } catch {
    // File may not exist
  }
}
