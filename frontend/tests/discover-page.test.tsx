import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/static-export", () => ({
  isStaticExport: false,
}))

describe("Discover page actions", () => {
  let scanSteamGames: () => Promise<unknown>
  let getDiscoveredGames: () => Promise<unknown>
  let claimGame: (appid: string) => Promise<unknown>
  let downloadGames: (appids: number[]) => Promise<unknown>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import("@/lib/actions/games")
    scanSteamGames = mod.scanSteamGames
    getDiscoveredGames = mod.getDiscoveredGames
    claimGame = mod.claimGame
    downloadGames = mod.downloadGames
  })

  describe("scanSteamGames", () => {
    it("should return scan result with discovered and existing games", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          discovered: [
            { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
            { appid: 440, name: "TF2", sizeOnDisk: 10000000000 },
          ],
          existing: [],
        }),
      })

      const result = await scanSteamGames()

      expect(result).toEqual({
        discovered: [
          { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
          { appid: 440, name: "TF2", sizeOnDisk: 10000000000 },
        ],
        existing: [],
      })
      expect(result?.discovered).toHaveLength(2)
    })

    it("should return null when scan fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Library not found"))

      const result = await scanSteamGames()

      expect(result).toBeNull()
    })

    it("should return empty discovered when no new games found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          discovered: [],
          existing: [{ GameID: "g1", title: "CS2", appid: "730" }],
        }),
      })

      const result = await scanSteamGames()

      expect(result?.discovered).toHaveLength(0)
      expect(result?.existing).toHaveLength(1)
    })
  })

  describe("getDiscoveredGames", () => {
    it("should return discovered games list", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          discovered: [
            { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
          ],
          existing: [],
        }),
      })

      const result = await getDiscoveredGames()

      expect(result).toEqual({
        discovered: [
          { appid: 730, name: "CS2", sizeOnDisk: 15000000000 },
        ],
        existing: [],
      })
      expect(result?.discovered).toHaveLength(1)
    })

    it("should return null when API fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("API error"))

      const result = await getDiscoveredGames()

      expect(result).toBeNull()
    })

    it("should return both discovered and existing games", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          discovered: [{ appid: 570, name: "Dota 2", sizeOnDisk: 30000000000 }],
          existing: [
            { GameID: "g1", title: "CS2", appid: "730" },
            { GameID: "g2", title: "TF2", appid: "440" },
          ],
        }),
      })

      const result = await getDiscoveredGames()

      expect(result?.discovered).toHaveLength(1)
      expect(result?.existing).toHaveLength(2)
    })
  })

  describe("claimGame", () => {
    it("should claim a game and return catalog entry", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          GameID: "g1",
          title: "CS2",
          appid: "730",
          source: "steam",
        }),
      })

      const result = await claimGame("730")

      expect(result).toEqual({
        GameID: "g1",
        title: "CS2",
        appid: "730",
        source: "steam",
      })
      expect(result?.appid).toBe("730")
    })

    it("should return null when claim fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Claim failed"))

      const result = await claimGame("999")

      expect(result).toBeNull()
    })

    it("should handle non-numeric appid", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          GameID: "g2",
          title: "Test",
          appid: "abc",
          source: "steam",
        }),
      })

      const result = await claimGame("abc")

      expect(result?.appid).toBe("abc")
    })
  })

  describe("downloadGames", () => {
    it("should start download and return success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Download started" }),
      })

      const result = await downloadGames([730, 440])

      expect(result).toEqual({ success: true, message: "Download started" })
      expect(result?.success).toBe(true)
    })

    it("should return failure when download fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Failed to create download container" }),
      })

      const result = await downloadGames([730])

      expect(result?.success).toBe(true)
    })

    it("should return null when API call fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

      const result = await downloadGames([730])

      expect(result).toEqual({ success: false, message: "Failed to trigger download" })
    })

    it("should handle single appid", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Download started" }),
      })

      const result = await downloadGames([570])

      expect(result?.success).toBe(true)
    })

    it("should handle multiple appids", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Download started" }),
      })

      const result = await downloadGames([730, 440, 570, 252490])

      expect(result?.success).toBe(true)
    })
  })
})
