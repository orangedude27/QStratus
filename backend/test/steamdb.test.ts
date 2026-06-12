import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchSteamDBMetadata, clearMetadataCache } from "../lib/steamdb.js"

const realFetch = global.fetch

function mockFetch(response: any, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  })
}

describe("fetchSteamDBMetadata", () => {
  beforeEach(() => {
    clearMetadataCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = realFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("should return metadata for a valid appid", async () => {
    const mockData = {
      "730": {
        success: true,
        data: {
          name: "Counter-Strike 2",
          description: "The description",
          short_description: "Short desc",
          genres: [{ description: "FPS" }, { description: "Action" }],
          developers: ["Valve"],
          publishers: ["Valve"],
          release_date: { date: "Oct 27, 2023" },
          screenshots: [{ id: "abc123" }],
          header_image: "https://example.com/header.jpg",
          is_free: false,
        },
      },
    }
    mockFetch(mockData)

    const result = await fetchSteamDBMetadata(730)
    expect(result).not.toBeNull()
    expect(result!.title).toBe("Counter-Strike 2")
    expect(result!.description).toBe("The description")
    expect(result!.shortDescription).toBe("Short desc")
    expect(result!.genres).toEqual(["FPS", "Action"])
    expect(result!.developer).toBe("Valve")
    expect(result!.publisher).toBe("Valve")
    expect(result!.releaseDate).toBe("Oct 27, 2023")
    expect(result!.headerImage).toBe("https://example.com/header.jpg")
    expect(result!.isFreeToPlay).toBe(false)
    expect(result!.screenshots).toContain(
      "https://cdn.akamai.steamstatic.com/steam/apps/730/library_abc123.jpg",
    )
  })

  it("should handle missing optional fields", async () => {
    mockFetch({
      "4000": {
        success: true,
        data: {
          name: "Garry's Mod",
        },
      },
    })

    const result = await fetchSteamDBMetadata(4000)
    expect(result).not.toBeNull()
    expect(result!.title).toBe("Garry's Mod")
    expect(result!.description).toBe("")
    expect(result!.shortDescription).toBe("Garry's Mod")
    expect(result!.genres).toEqual([])
    expect(result!.developer).toBe("")
    expect(result!.screenshots).toEqual([])
  })

  it("should return null for failed API response", async () => {
    mockFetch({}, false)
    const result = await fetchSteamDBMetadata(99999)
    expect(result).toBeNull()
  })

  it("should return null when success is false", async () => {
    mockFetch({ "12345": { success: false } })
    const result = await fetchSteamDBMetadata(12345)
    expect(result).toBeNull()
  })

  it("should return null when data is missing", async () => {
    mockFetch({ "12345": { success: true } })
    const result = await fetchSteamDBMetadata(12345)
    expect(result).toBeNull()
  })

  it("should cache results and not refetch within TTL", async () => {
    mockFetch({
      "730": {
        success: true,
        data: { name: "Counter-Strike 2" },
      },
    })

    const result1 = await fetchSteamDBMetadata(730)
    expect(result1).not.toBeNull()

    // Advance time by 1 hour (still within 24h TTL)
    vi.advanceTimersByTime(60 * 60 * 1000)

    const result2 = await fetchSteamDBMetadata(730)
    expect(result2).not.toBeNull()
    expect(result2!.title).toBe("Counter-Strike 2")

    // fetch should only have been called once
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("should refetch after cache TTL expires", async () => {
    mockFetch({
      "730": {
        success: true,
        data: { name: "Counter-Strike 2" },
      },
    })

    await fetchSteamDBMetadata(730)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Advance past 24h TTL
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000)

    mockFetch({
      "730": {
        success: true,
        data: { name: "Counter-Strike 3" },
      },
    })

    vi.useRealTimers()
    await fetchSteamDBMetadata(730)
    vi.useFakeTimers()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("should handle fetch errors gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
    const result = await fetchSteamDBMetadata(730)
    expect(result).toBeNull()
  })

  it("should handle free-to-play games", async () => {
    mockFetch({
      "570": {
        success: true,
        data: {
          name: "Dota 2",
          is_free: true,
        },
      },
    })

    const result = await fetchSteamDBMetadata(570)
    expect(result!.isFreeToPlay).toBe(true)
  })

  it("should use short_description when description is missing", async () => {
    mockFetch({
      "10": {
        success: true,
        data: {
          name: "Source SDK",
          short_description: "The original SDK",
        },
      },
    })

    const result = await fetchSteamDBMetadata(10)
    expect(result!.description).toBe("")
    expect(result!.shortDescription).toBe("The original SDK")
  })
})

describe("clearMetadataCache", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          "730": { success: true, data: { name: "CS2" } },
        }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("should clear cached metadata", async () => {
    await fetchSteamDBMetadata(730)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    clearMetadataCache()

    mockFetch({
      "730": { success: true, data: { name: "CS2 Updated" } },
    })

    vi.useRealTimers()
    await fetchSteamDBMetadata(730)
    vi.useFakeTimers()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
