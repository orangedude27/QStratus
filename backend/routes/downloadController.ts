import type { Request, Response } from "express"

import { triggerDownload, getDownloadStatus } from "../lib/dockerTrigger.js"

type DownloadRequest = {
  appids: number[]
}

export const ControllerTriggerDownload = async (
  req: Request<{}, {}, DownloadRequest>,
  res: Response,
): Promise<void> => {
  const { appids } = req.body

  if (!appids || !Array.isArray(appids) || appids.length === 0) {
    res.status(400).json({ error: "Valid appids array is required" })
    return
  }

  try {
    const result = await triggerDownload(appids)

    if (!result.success) {
      res.status(500).json({ error: result.message })
      return
    }

    res.status(202).json({
      message: result.message,
      appids: result.appids,
    })
  } catch (err) {
    console.error("Error triggering download:", err)
    res.status(500).json({ error: "Failed to trigger download" })
  }
}

export const ControllerGetDownloadStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status = await getDownloadStatus()
    res.status(200).json(status)
  } catch (err) {
    console.error("Error getting download status:", err)
    res.status(500).json({ error: "Failed to get download status" })
  }
}
