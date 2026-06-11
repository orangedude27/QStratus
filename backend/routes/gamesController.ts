import type { Request, Response } from "express"

import {
  getAllGames,
  getGameById,
  createGame,
  addGameToCatalog,
  getAllGamesWithSource,
  deleteGame,
  getGameByAppId,
} from "../lib/localStore.js"
import { scanSteamLibrary } from "../lib/steamScanner.js"
import { fetchSteamDBMetadata } from "../lib/steamdb.js"

type GameItem = {
  GameID: string // Partition key
  developer: string // Developer name
  genres: string[] // Genres (String array)
  lDescript: string // Long description
  s3: string[] // S3 links (String array)
  sDescript: string // Short description
  title: string // Game title
}

export const ControllerGetAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const games = await getAllGamesWithSource()
    res.status(200).json(games)
  } catch (err) {
    console.error("Error fetching games:", err)
    res.status(500).json({ error: "Failed to fetch games" })
  }
}

export const ControllerGetByID = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: "Game ID is required" })
    return
  }
  try {
    const game = await getGameById(id)

    if (!game) {
      res.status(404).json({ error: "Game not found" })
      return
    }

    res.status(200).json(game)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch game" })
  }
}

export const ControllerScanSteam = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const discovered = await scanSteamLibrary()

    const existingAppIds = new Set<string>()
    const existingGames: GameItem[] = []

    for (const game of discovered) {
      const existing = await getGameByAppId(game.appid)
      if (existing) {
        existingAppIds.add(String(game.appid))
        existingGames.push(existing)
      }
    }

    const newlyDiscovered = discovered.filter(
      (g) => !existingAppIds.has(String(g.appid)),
    )

    res.status(200).json({
      discovered: newlyDiscovered,
      existing: existingGames,
    })
  } catch (err) {
    console.error("Error scanning Steam library:", err)
    res.status(500).json({ error: "Failed to scan Steam library" })
  }
}

export const ControllerGetDiscovered = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const discovered = await scanSteamLibrary()

    const existingAppIds = new Set<string>()
    const existingGames: GameItem[] = []

    for (const game of discovered) {
      const existing = await getGameByAppId(game.appid)
      if (existing) {
        existingAppIds.add(String(game.appid))
        existingGames.push(existing)
      }
    }

    const newlyDiscovered = discovered.filter(
      (g) => !existingAppIds.has(String(g.appid)),
    )

    res.status(200).json({
      discovered: newlyDiscovered,
      existing: existingGames,
    })
  } catch (err) {
    console.error("Error fetching discovered games:", err)
    res.status(500).json({ error: "Failed to fetch discovered games" })
  }
}

export const ControllerClaimGame = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { appid } = req.params

  if (!appid) {
    res.status(400).json({ error: "AppID is required" })
    return
  }

  try {
    const appidNum = parseInt(appid, 10)
    if (isNaN(appidNum)) {
      res.status(400).json({ error: "Invalid AppID" })
      return
    }

    const existing = await getGameByAppId(appidNum)
    if (existing) {
      res.status(200).json({
        message: "Game already in catalog",
        game: existing,
      })
      return
    }

    const metadata = await fetchSteamDBMetadata(appidNum)

    const game = await addGameToCatalog(
      {
        appid: appidNum,
        name: metadata?.title || `Game ${appidNum}`,
        installdir: metadata ? "" : "",
        sizeOnDisk: 0,
      },
      metadata || undefined,
    )

    res.status(201).json(game)
  } catch (err) {
    console.error("Error claiming game:", err)
    res.status(500).json({ error: "Failed to claim game" })
  }
}

export const ControllerCreateGame = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { title, developer, genres, lDescript, sDescript, s3, source, installdir } =
    req.body

  if (!title) {
    res.status(400).json({ error: "Game title is required" })
    return
  }

  try {
    const game = await createGame({
      title,
      developer: developer || "Unknown",
      genres: genres || [],
      lDescript: lDescript || "",
      sDescript: sDescript || title,
      s3: s3 || [],
      source: source || "manual",
      installdir,
    })

    res.status(201).json(game)
  } catch (err) {
    console.error("Error creating game:", err)
    res.status(500).json({ error: "Failed to create game" })
  }
}

export const ControllerDeleteGame = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params

  if (!id) {
    res.status(400).json({ error: "Game ID is required" })
    return
  }

  try {
    const success = await deleteGame(id)

    if (!success) {
      res.status(404).json({ error: "Game not found" })
      return
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error("Error deleting game:", err)
    res.status(500).json({ error: "Failed to delete game" })
  }
}
