import { readdir, readFile, stat } from "fs/promises"
import path from "path"

const STEAM_LIBRARY_PATH =
  process.env.STEAM_LIBRARY_PATH || "/data/steam/steamapps"

export type DiscoveredGame = {
  appid: number
  name: string
  installdir: string
  sizeOnDisk: number
  lastUpdated: number
  stateFlags: number
}

function parseAcfFile(content: string): DiscoveredGame | null {
  const result: Record<string, string> = {}

  const lines = content.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^"(\w+)"\s+"(.+)"$/)
    if (match) {
      result[match[1]] = match[2]
    }
  }

  const appid = parseInt(result.appid || "0", 10)
  if (!appid || isNaN(appid)) {
    return null
  }

  const sizeOnDisk = parseInt(result.SizeOnDisk || "0", 10)
  const lastUpdated = parseInt(result.LastUpdated || "0", 10)
  const stateFlags = parseInt(result.StateFlags || "0", 10)

  return {
    appid,
    name: result.name || `Unknown Game (${appid})`,
    installdir: result.installdir || "",
    sizeOnDisk,
    lastUpdated,
    stateFlags,
  }
}

export async function scanSteamLibrary(): Promise<DiscoveredGame[]> {
  try {
    const files = await readdir(STEAM_LIBRARY_PATH)
    const manifestFiles = files.filter((f) =>
      f.startsWith("appmanifest_") && f.endsWith(".acf"),
    )

    const games: DiscoveredGame[] = []

    for (const file of manifestFiles) {
      try {
        const filePath = path.join(STEAM_LIBRARY_PATH, file)
        const content = await readFile(filePath, "utf8")
        const game = parseAcfFile(content)

        if (game && game.stateFlags === 4) {
          games.push(game)
        }
      } catch (err) {
        console.warn(`Failed to parse ${file}:`, err)
      }
    }

    return games
  } catch (err) {
    console.error("Failed to scan Steam library:", err)
    return []
  }
}

export async function getInstalledGamePath(
  installdir: string,
): Promise<string | null> {
  const commonPath = path.join(STEAM_LIBRARY_PATH, "common", installdir)
  try {
    await stat(commonPath)
    return commonPath
  } catch {
    return null
  }
}
