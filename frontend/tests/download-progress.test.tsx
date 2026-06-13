import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/static-export", () => ({
  isStaticExport: false,
}))

describe("getDownloadStatus", () => {
  let getDownloadStatus: () => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import("@/lib/actions/games")
    getDownloadStatus = mod.getDownloadStatus
  })

  it("should return download status data when API succeeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        downloading: true,
        appids: [730, 440],
        completed: [730],
        failed: [],
        progress: 50,
      }),
    })

    const result = await getDownloadStatus()

    expect(result).toEqual({
      downloading: true,
      appids: [730, 440],
      completed: [730],
      failed: [],
      progress: 50,
    })
  })

  it("should return null when API returns null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    })

    const result = await getDownloadStatus()

    expect(result).toBeNull()
  })

  it("should return null when API call fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    const result = await getDownloadStatus()

    expect(result).toBeNull()
  })

  it("should return idle status when nothing is downloading", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        downloading: false,
        appids: [],
        completed: [],
        failed: [],
        progress: 0,
      }),
    })

    const result = await getDownloadStatus()

    expect(result?.downloading).toBe(false)
    expect(result?.appids).toEqual([])
    expect(result?.progress).toBe(0)
  })

  it("should include error in status when present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        downloading: false,
        appids: [730],
        completed: [],
        failed: [730],
        progress: 100,
        error: "Download failed",
      }),
    })

    const result = await getDownloadStatus()

    expect(result?.error).toBe("Download failed")
    expect(result?.failed).toEqual([730])
  })

  it("should return completed games list", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        downloading: false,
        appids: [730, 440, 570],
        completed: [730, 440],
        failed: [],
        progress: 67,
      }),
    })

    const result = await getDownloadStatus()

    expect(result?.completed).toEqual([730, 440])
    expect(result?.appids).toEqual([730, 440, 570])
  })
})
