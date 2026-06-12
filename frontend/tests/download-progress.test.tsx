import { describe, it, expect, vi, beforeEach } from "vitest"
import { getDownloadStatus } from "@/lib/actions/games"

vi.mock("@/lib/actions/games", async () => {
  const actual = await vi.importActual<typeof import("@/lib/actions/games")>(
    "@/lib/actions/games",
  )
  return {
    ...actual,
    getDownloadStatus: vi.fn(),
  }
})

vi.mock("@/lib/static-export", () => ({
  isStaticExport: false,
}))

describe("getDownloadStatus", () => {
  const GamesActions = await import("@/lib/actions/games")
  const mockGetDownloadStatus = GamesActions.getDownloadStatus as ReturnType<
    typeof vi.fn
  >

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return download status data when API succeeds", async () => {
    const mockData = {
      downloading: true,
      appids: [730, 440],
      completed: [730],
      failed: [],
      progress: 50,
    }
    mockGetDownloadStatus.mockResolvedValue(mockData)

    const result = await getDownloadStatus()

    expect(result).toEqual(mockData)
    expect(mockGetDownloadStatus).toHaveBeenCalledTimes(1)
  })

  it("should return null when API returns null", async () => {
    mockGetDownloadStatus.mockResolvedValue(null)

    const result = await getDownloadStatus()

    expect(result).toBeNull()
  })

  it("should return null when API call fails", async () => {
    mockGetDownloadStatus.mockRejectedValue(new Error("Network error"))

    const result = await getDownloadStatus()

    expect(result).toBeNull()
  })

  it("should return idle status when nothing is downloading", async () => {
    const mockData = {
      downloading: false,
      appids: [],
      completed: [],
      failed: [],
      progress: 0,
    }
    mockGetDownloadStatus.mockResolvedValue(mockData)

    const result = await getDownloadStatus()

    expect(result?.downloading).toBe(false)
    expect(result?.appids).toEqual([])
    expect(result?.progress).toBe(0)
  })

  it("should include error in status when present", async () => {
    const mockData = {
      downloading: false,
      appids: [730],
      completed: [],
      failed: [730],
      progress: 100,
      error: "Download failed",
    }
    mockGetDownloadStatus.mockResolvedValue(mockData)

    const result = await getDownloadStatus()

    expect(result?.error).toBe("Download failed")
    expect(result?.failed).toEqual([730])
  })

  it("should return completed games list", async () => {
    const mockData = {
      downloading: false,
      appids: [730, 440, 570],
      completed: [730, 440],
      failed: [],
      progress: 67,
    }
    mockGetDownloadStatus.mockResolvedValue(mockData)

    const result = await getDownloadStatus()

    expect(result?.completed).toEqual([730, 440])
    expect(result?.appids).toEqual([730, 440, 570])
  })
})
