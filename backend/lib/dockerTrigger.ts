import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock"
const STEAMCMD_CONTAINER = "qstratus_steamcmd"
const STEAMCMD_IMAGE = "qstratus_steamcmd"
const SHARED_VOLUME = "qstratus_steam_data"
const GAMES_FILE = join(tmpdir(), "games_to_download.json")

type DownloadResult = {
  success: boolean
  message: string
  appids: number[]
}

type DownloadStatus = {
  downloading: boolean
  appids: number[]
  completed: number[]
  failed: number[]
  progress: number
  error?: string
}

async function fetchDocker(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `http://localhost${path}`
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

async function stopContainer(): Promise<void> {
  try {
    const resp = await fetchDocker(`/containers/${STEAMCMD_CONTAINER}/stop`, { method: "POST" })
    if (resp.status !== 204 && resp.status !== 304) {
      console.warn(`Failed to stop container: ${resp.status}`)
    }
  } catch {
    // Container may not exist
  }

  try {
    await fetchDocker(`/containers/${STEAMCMD_CONTAINER}/remove`, { method: "DELETE" })
  } catch {
    // Container may not exist
  }
}

async function getContainerInspect(): Promise<{ State: { Status: string }; Config: { Env?: string[] } } | null> {
  try {
    const resp = await fetchDocker(`/containers/${STEAMCMD_CONTAINER}/json`)
    if (!resp.ok) return null
    return resp.json()
  } catch {
    return null
  }
}

export async function triggerDownload(appids: number[]): Promise<DownloadResult> {
  if (appids.length === 0) {
    return { success: false, message: "No AppIDs provided", appids: [] }
  }

  try {
    const gamesJson = JSON.stringify(appids)

    const env = [
      `GAMES=${gamesJson}`,
      `STEAM_USER=${process.env.STEAM_USER || ""}`,
      `STEAM_PASSWORD=${process.env.STEAM_PASSWORD || ""}`,
    ].filter(Boolean)

    await stopContainer()

    const resp = await fetchDocker("/containers/create", {
      method: "POST",
      body: JSON.stringify({
        Image: STEAMCMD_IMAGE,
        Env: env,
        HostConfig: {
          Binds: [`qstratus_steam_data:/data/steam`],
          RestartPolicy: { Name: "no" },
        },
        AttachStdout: true,
        AttachStderr: true,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error("Failed to create steamcmd container:", err)
      return { success: false, message: `Failed to create download container: ${err}`, appids }
    }

    const body = await resp.json()
    const containerId = body.Id

    const startResp = await fetchDocker(`/containers/${containerId}/start`, { method: "POST" })
    if (!startResp.ok) {
      console.error("Failed to start steamcmd container:", startResp.status)
      return { success: false, message: "Failed to start download container", appids }
    }

    return { success: true, message: "Download started", appids }
  } catch (err) {
    console.error("Error triggering download:", err)
    return { success: false, message: "Failed to trigger download", appids }
  }
}

export async function getDownloadStatus(): Promise<DownloadStatus> {
  const appids = getQueuedAppIds()
  if (appids.length === 0) {
    return { downloading: false, appids: [], completed: [], failed: [], progress: 0 }
  }

  const inspect = await getContainerInspect()
  if (!inspect) {
    return { downloading: false, appids, completed: [], failed: [], progress: 0 }
  }

  const status = inspect.State.Status
  const completed = checkCompletedGames(appids)
  const failed = checkFailedGames(appids)

  if (status === "exited" || status === "dead") {
    return {
      downloading: false,
      appids,
      completed,
      failed,
      progress: 100,
      error: (inspect.State as Record<string, string>).Error || undefined,
    }
  }

  const total = appids.length
  const done = completed.length + failed.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return {
    downloading: status === "running",
    appids,
    completed,
    failed,
    progress,
  }
}

function getQueuedAppIds(): number[] {
  try {
    const data = readFileSync(GAMES_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function checkCompletedGames(appids: number[]): number[] {
  const steamAppsDir = process.env.STEAM_DATA_PATH || "/data/steam/steamapps"
  const completed: number[] = []

  for (const appid of appids) {
    const manifestPath = join(steamAppsDir, `appmanifest_${appid}.acf`)
    if (existsSync(manifestPath)) {
      try {
        const content = readFileSync(manifestPath, "utf-8")
        if (/StateFlags\s*=\s*"[48]"/.test(content)) {
          completed.push(appid)
          continue
        }
        if (/AppState\s*=\s*1/.test(content)) {
          completed.push(appid)
          continue
        }
      } catch {
        // File exists but unreadable
      }
    }
  }

  return completed
}

function checkFailedGames(appids: number[]): number[] {
  const logsDir = process.env.STEAM_DATA_PATH ? join(process.env.STEAM_DATA_PATH, "logs") : "/data/steam/logs"
  const failed: number[] = []

  for (const appid of appids) {
    const errorFile = join(logsDir, `steamcmd_${appid}_error.log`)
    if (existsSync(errorFile)) {
      failed.push(appid)
    }
  }

  return failed
}
