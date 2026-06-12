import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  triggerDownload,
  getDownloadStatus,
} from "../lib/dockerTrigger.js"
import { writeFileSync } from "node:fs"

const GAMES_FILE = "/tmp/games_to_download.json"

function writeGamesFile(appids: number[]) {
  writeFileSync(GAMES_FILE, JSON.stringify(appids), "utf-8")
}

function removeGamesFile() {
  try {
    require("fs").unlinkSync(GAMES_FILE)
  } catch {
    // ignore
  }
}

function createMockResponse(options: {
  ok?: boolean
  status?: number
  json?: () => any
  text?: () => string
}): Response {
  return {
    ok: options.ok ?? false,
    status: options.status ?? 500,
    json: options.json ?? (() => Promise.resolve({})),
    text: options.text ?? (() => Promise.resolve("")),
  } as Response
}

describe("triggerDownload", () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    global.fetch = vi.fn()
    process.env.DOCKER_SOCKET = "http://localhost"
    removeGamesFile()
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key]
    })
    process.env.STEAM_USER = undefined
    process.env.STEAM_PASSWORD = undefined
    removeGamesFile()
  })

  it("should return failure when appids is empty", async () => {
    const result = await triggerDownload([])
    expect(result.success).toBe(false)
    expect(result.message).toBe("No AppIDs provided")
    expect(result.appids).toEqual([])
  })

  it("should return failure when Docker API fails to create container", async () => {
    const fetchMock = vi.mocked(global.fetch)
    fetchMock
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // stop
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // remove
      .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500, text: () => "Docker error" })) // create

    const result = await triggerDownload([730])
    expect(result.success).toBe(false)
    expect(result.message).toContain("Failed to create download container")
    expect(result.appids).toEqual([730])
  })

  it("should return failure when Docker API fails to start container", async () => {
    const fetchMock = vi.mocked(global.fetch)
    fetchMock
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // stop
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // remove
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        }),
      ) // create
      .mockResolvedValueOnce(createMockResponse({ ok: false, status: 500 })) // start

    const result = await triggerDownload([730, 440])
    expect(result.success).toBe(false)
    expect(result.message).toBe("Failed to start download container")
    expect(result.appids).toEqual([730, 440])
  })

  it("should return success when container is created and started", async () => {
    const fetchMock = vi.mocked(global.fetch)
    fetchMock
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // stop
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 204 })) // remove
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        }),
      ) // create
      .mockResolvedValueOnce(createMockResponse({ ok: true, status: 200 })) // start

    const result = await triggerDownload([730])
    expect(result.success).toBe(true)
    expect(result.message).toBe("Download started")
    expect(result.appids).toEqual([730])
  })

  it("should pass Steam credentials as environment variables", async () => {
    process.env.STEAM_USER = "testuser"
    process.env.STEAM_PASSWORD = "testpass"

    let createBody: any
    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (url: any, options?: any) => {
      const urlString = url.toString()
      if (urlString.includes("/stop")) {
        return createMockResponse({ ok: true, status: 204 })
      }
      if (urlString.includes("/remove")) {
        return createMockResponse({ ok: true, status: 204 })
      }
      if (urlString.includes("/create")) {
        createBody = JSON.parse(options.body)
        return createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        })
      }
      if (urlString.includes("/start")) {
        return createMockResponse({ ok: true, status: 200 })
      }
      return createMockResponse({ ok: false })
    })

    await triggerDownload([730])

    expect(createBody.Env).toContain("STEAM_USER=testuser")
    expect(createBody.Env).toContain("STEAM_PASSWORD=testpass")
  })

  it("should use empty credentials when not set", async () => {
    process.env.STEAM_USER = ""
    process.env.STEAM_PASSWORD = ""

    let createBody: any
    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (url: any, options?: any) => {
      const urlString = url.toString()
      if (urlString.includes("/stop")) {
        return createMockResponse({ ok: true, status: 204 })
      }
      if (urlString.includes("/remove")) {
        return createMockResponse({ ok: true, status: 204 })
      }
      if (urlString.includes("/create")) {
        createBody = JSON.parse(options.body)
        return createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        })
      }
      if (urlString.includes("/start")) {
        return createMockResponse({ ok: true, status: 200 })
      }
      return createMockResponse({ ok: false })
    })

    await triggerDownload([730])

    const steamEnv = createBody.Env.filter((e: string) =>
      e.startsWith("STEAM_"),
    )
    expect(steamEnv).toEqual(["STEAM_USER=", "STEAM_PASSWORD="])
  })

  it("should include GAMES env variable with appids", async () => {
    let createBody: any
    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (url: any, options?: any) => {
      const urlString = url.toString()
      if (urlString.includes("/create")) {
        createBody = JSON.parse(options.body)
        return createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        })
      }
      return createMockResponse({ ok: true, status: 200 })
    })

    await triggerDownload([730, 440, 570])

    expect(createBody.Env).toContain('GAMES=[730,440,570]')
  })

  it("should set Binds with shared volume", async () => {
    let createBody: any
    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (url: any, options?: any) => {
      const urlString = url.toString()
      if (urlString.includes("/create")) {
        createBody = JSON.parse(options.body)
        return createMockResponse({
          ok: true,
          json: () => Promise.resolve({ Id: "abc123" }),
        })
      }
      return createMockResponse({ ok: true, status: 200 })
    })

    await triggerDownload([730])

    expect(createBody.HostConfig.Binds).toContain("qstratus_steam_data:/data/steam")
  })

  it("should handle network errors gracefully", async () => {
    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"))

    const result = await triggerDownload([730])
    expect(result.success).toBe(false)
    expect(result.message).toBe("Failed to trigger download")
    expect(result.appids).toEqual([730])
  })
})

describe("getDownloadStatus", () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    global.fetch = vi.fn()
    removeGamesFile()
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key]
    })
    removeGamesFile()
  })

  it("should return idle status when no games are queued", async () => {
    const status = await getDownloadStatus()
    expect(status.downloading).toBe(false)
    expect(status.appids).toEqual([])
    expect(status.completed).toEqual([])
    expect(status.failed).toEqual([])
    expect(status.progress).toBe(0)
  })

  it("should return idle when container does not exist", async () => {
    writeGamesFile([730])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({ ok: false }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(false)
    expect(status.appids).toEqual([730])
    expect(status.progress).toBe(0)
  })

  it("should return running status when container is running", async () => {
    writeGamesFile([730, 440])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            State: { Status: "running" },
          }),
      }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(true)
    expect(status.appids).toEqual([730, 440])
  })

  it("should return completed status when container exited", async () => {
    writeGamesFile([730])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            State: { Status: "exited", Error: "" },
          }),
      }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(false)
    expect(status.progress).toBe(100)
  })

  it("should include error message when container has error", async () => {
    writeGamesFile([730])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            State: { Status: "dead", Error: "OOM killed" },
          }),
      }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(false)
    expect(status.error).toBe("OOM killed")
  })

  it("should return dead status when container is dead", async () => {
    writeGamesFile([730])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            State: { Status: "dead" },
          }),
      }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(false)
    expect(status.progress).toBe(100)
  })

  it("should calculate progress based on completed games", async () => {
    writeGamesFile([730, 440, 570])
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        json: () =>
          Promise.resolve({
            State: { Status: "running" },
          }),
      }),
    )

    const status = await getDownloadStatus()
    expect(status.downloading).toBe(true)
    expect(status.appids).toEqual([730, 440, 570])
  })
})
