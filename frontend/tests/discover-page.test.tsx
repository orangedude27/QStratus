import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  scanSteamGames,
  getDiscoveredGames,
  claimGame,
  downloadGames,
} from "@/lib/actions/games"

vi.mock("@/lib/actions/games", async () => {
  const actual = await vi.importActual<typeof import("@/lib/actions/games")>(
    "@/lib/actions/games",
  )
  return {
    ...actual,
    scanSteamGames: vi.fn(),
    getDiscoveredGames: vi.fn(),
    claimGame: vi.fn(),
    downloadGames: vi.fn(),
  }
})

vi.mock("@/lib/static-export", () => ({
  isStaticExport: false,
}))

describe("Discover page actions", () => {
  const GamesActions = await import("@/lib/actions/games")
  const mockScanSteamGames = GamesActions.scanSteamGames as ReturnType<
    typeof vi.fn
  >
  const mockGetDiscoveredGames = GamesActions.getDiscoveredGames as ReturnType<
    typeof vi.fn
  >
  const mockClaimGame = GamesActions.claimGame as ReturnType<typeof vi.fn>
  const mockDownloadGames = GamesActions.downloadGames as ReturnType<
    typeof vi.fn
  >

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("scanSteamGames", () => {
    it("should return scan result with discovered and existing games", async () => {
      const mockResult = {
        discovered: [
          { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
          { appid: 440, name: "TF2", sizeOnDisk: 10000000000 },
        ],
        existing: [],
      }
      mockScanSteamGames.mockResolvedValue(mockResult)

      const result = await scanSteamGames()

      expect(result).toEqual(mockResult)
      expect(result?.discovered).toHaveLength(2)
      expect(mockScanSteamGames).toHaveBeenCalledTimes(1)
    })

    it("should return null when scan fails", async () => {
      mockScanSteamGames.mockRejectedValue(new Error("Library not found"))

      const result = await scanSteamGames()

      expect(result).toBeNull()
    })

    it("should return empty discovered when no new games found", async () => {
      const mockResult = {
        discovered: [],
        existing: [{ GameID: "g1", title: "CS2", appid: "730" }],
      }
      mockScanSteamGames.mockResolvedValue(mockResult)

      const result = await scanSteamGames()

      expect(result?.discovered).toHaveLength(0)
      expect(result?.existing).toHaveLength(1)
    })
  })

  describe("getDiscoveredGames", () => {
    it("should return discovered games list", async () => {
      const mockResult = {
        discovered: [
          { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
        ],
        existing: [],
      }
      mockGetDiscoveredGames.mockResolvedValue(mockResult)

      const result = await getDiscoveredGames()

      expect(result).toEqual(mockResult)
      expect(result?.discovered).toHaveLength(1)
    })

    it("should return null when API fails", async () => {
      mockGetDiscoveredGames.mockRejectedValue(new Error("API error"))

      const result = await getDiscoveredGames()

      expect(result).toBeNull()
    })

    it("should return both discovered and existing games", async () => {
      const mockResult = {
        discovered: [{ appid: 570, name: "Dota 2", sizeOnDisk: 30000000000 }],
        existing: [
          { GameID: "g1", title: "CS2", appid: "730" },
          { GameID: "g2", title: "TF2", appid: "440" },
        ],
      }
      mockGetDiscoveredGames.mockResolvedValue(mockResult)

      const result = await getDiscoveredGames()

      expect(result?.discovered).toHaveLength(1)
      expect(result?.existing).toHaveLength(2)
    })
  })

  describe("claimGame", () => {
    it("should claim a game and return catalog entry", async () => {
      const mockGame = {
        GameID: "g1",
        title: "CS2",
        appid: "730",
        source: "steam",
      }
      mockClaimGame.mockResolvedValue(mockGame)

      const result = await claimGame("730")

      expect(result).toEqual(mockGame)
      expect(result?.appid).toBe("730")
      expect(mockClaimGame).toHaveBeenCalledWith("730")
    })

    it("should return null when claim fails", async () => {
      mockClaimGame.mockRejectedValue(new Error("Claim failed"))

      const result = await claimGame("999")

      expect(result).toBeNull()
    })

    it("should handle non-numeric appid", async () => {
      const mockGame = {
        GameID: "g2",
        title: "Test",
        appid: "abc",
        source: "steam",
      }
      mockClaimGame.mockResolvedValue(mockGame)

      const result = await claimGame("abc")

      expect(result?.appid).toBe("abc")
    })
  })

  describe("downloadGames", () => {
    it("should start download and return success", async () => {
      const mockResult = {
        success: true,
        message: "Download started",
        appids: [730, 440],
      }
      mockDownloadGames.mockResolvedValue(mockResult)

      const result = await downloadGames([730, 440])

      expect(result).toEqual(mockResult)
      expect(result?.success).toBe(true)
    })

    it("should return failure when download fails", async () => {
      const mockResult = {
        success: false,
        message: "Failed to create download container",
      }
      mockDownloadGames.mockResolvedValue(mockResult)

      const result = await downloadGames([730])

      expect(result?.success).toBe(false)
      expect(result?.message).toContain("Failed")
    })

    it("should return null when API call fails", async () => {
      mockDownloadGames.mockRejectedValue(new Error("Network error"))

      const result = await downloadGames([730])

      expect(result).toBeNull()
    })

    it("should handle single appid", async () => {
      const mockResult = {
        success: true,
        message: "Download started",
        appids: [570],
      }
      mockDownloadGames.mockResolvedValue(mockResult)

      const result = await downloadGames([570])

      expect(result?.appids).toEqual([570])
    })

    it("should handle multiple appids", async () => {
      const mockResult = {
        success: true,
        message: "Download started",
        appids: [730, 440, 570, 252490],
      }
      mockDownloadGames.mockResolvedValue(mockResult)

      const result = await downloadGames([730, 440, 570, 252490])

      expect(result?.appids).toHaveLength(4)
    })
  })
})
