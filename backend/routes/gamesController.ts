import type { Request, Response } from "express"

import { getAllGames, getGameById } from "../lib/localStore.js"

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
    const games = await getAllGames()
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
