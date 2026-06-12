import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdir, writeFile, rm } from "fs/promises"
import path from "path"
import { scanSteamLibrary, getInstalledGamePath, parseAcfFile, setSteamLibraryPath } from "../lib/steamScanner.js"

const TEST_LIBRARY_DIR = path.resolve(process.cwd(), "test", "steam_test_library")

function createAcfContent(overrides: Record<string, string> = {}): string {
  const base = {
    appid: "730",
    Name: "Counter-Strike 2",
    installdir: "csgo",
    SizeOnDisk: "15000000000",
    LastUpdated: "1700000000",
    StateFlags: "4",
  }
  const lines = ["[AppState]", ...Object.entries({ ...base, ...overrides }).map(([k, v]) => `"${k}" "${v}"`)]
  return lines.join("\n")
}

async function setupLibrary(files: Record<string, string>) {
  await mkdir(TEST_LIBRARY_DIR, { recursive: true })
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(path.join(TEST_LIBRARY_DIR, filename), content)
  }
}

async function cleanupLibrary() {
  try {
    await rm(TEST_LIBRARY_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

describe("parseAcfFile", () => {
  it("should parse a valid appmanifest file", () => {
    const content = createAcfContent()
    const result = parseAcfFile(content)
    expect(result).not.toBeNull()
    expect(result!.appid).toBe(730)
    expect(result!.name).toBe("Counter-Strike 2")
    expect(result!.installdir).toBe("csgo")
    expect(result!.sizeOnDisk).toBe(15000000000)
    expect(result!.stateFlags).toBe(4)
  })

  it("should return null for missing appid", () => {
    const content = createAcfContent({ appid: "" })
    expect(parseAcfFile(content)).toBeNull()
  })

  it("should return null for non-numeric appid", () => {
    const content = createAcfContent({ appid: "abc" })
    expect(parseAcfFile(content)).toBeNull()
  })

  it("should handle missing optional fields", () => {
    const content = `[AppState]\n"appid" "730"\n"Name" "Test Game"`
    const result = parseAcfFile(content)
    expect(result).not.toBeNull()
    expect(result!.appid).toBe(730)
    expect(result!.name).toBe("Test Game")
    expect(result!.installdir).toBe("")
    expect(result!.sizeOnDisk).toBe(0)
  })

  it("should use default name when Name is missing", () => {
    const content = `[AppState]\n"appid" "12345"`
    const result = parseAcfFile(content)
    expect(result!.name).toBe("Unknown Game (12345)")
  })

  it("should parse different state flags", () => {
    const content = createAcfContent({ StateFlags: "8" })
    const result = parseAcfFile(content)
    expect(result!.stateFlags).toBe(8)
  })
})

describe("scanSteamLibrary", () => {
  beforeEach(async () => {
    setSteamLibraryPath(TEST_LIBRARY_DIR)
    await cleanupLibrary()
  })

  afterEach(async () => {
    await cleanupLibrary()
    setSteamLibraryPath("/data/steam/steamapps")
  })

  it("should return empty array when no manifest files exist", async () => {
    const result = await scanSteamLibrary()
    expect(result).toEqual([])
  })

  it("should scan and return installed games (StateFlags=4)", async () => {
    await setupLibrary({
      "appmanifest_730.acf": createAcfContent({ StateFlags: "4" }),
      "appmanifest_440.acf": createAcfContent({ appid: "440", Name: "Team Fortress 2", StateFlags: "4" }),
    })
    const result = await scanSteamLibrary()
    expect(result).toHaveLength(2)
    expect(result.map((g) => g.appid)).toContain(730)
    expect(result.map((g) => g.appid)).toContain(440)
  })

  it("should exclude games not installed (StateFlags=0)", async () => {
    await setupLibrary({
      "appmanifest_730.acf": createAcfContent({ StateFlags: "0" }),
      "appmanifest_440.acf": createAcfContent({ StateFlags: "4" }),
    })
    const result = await scanSteamLibrary()
    expect(result).toHaveLength(1)
    expect(result[0].appid).toBe(440)
  })

  it("should skip malformed manifest files", async () => {
    await setupLibrary({
      "appmanifest_730.acf": "this is not valid acf content",
      "appmanifest_440.acf": createAcfContent({ StateFlags: "4" }),
    })
    const result = await scanSteamLibrary()
    expect(result).toHaveLength(1)
    expect(result[0].appid).toBe(440)
  })

  it("should skip non-manifest files", async () => {
    await setupLibrary({
      "appmanifest_730.acf": createAcfContent({ StateFlags: "4" }),
      "readme.txt": "some text",
      "appmanifest_bad.txt": "not an acf",
    })
    const result = await scanSteamLibrary()
    expect(result).toHaveLength(1)
  })

  it("should handle non-existent library path gracefully", async () => {
    process.env.STEAM_LIBRARY_PATH = "/nonexistent/path/that/does/not/exist"
    const result = await scanSteamLibrary()
    expect(result).toEqual([])
  })
})

describe("getInstalledGamePath", () => {
  beforeEach(async () => {
    setSteamLibraryPath(TEST_LIBRARY_DIR)
    await cleanupLibrary()
  })

  afterEach(async () => {
    await cleanupLibrary()
    setSteamLibraryPath("/data/steam/steamapps")
  })

  it("should return path when installdir exists", async () => {
    await mkdir(path.join(TEST_LIBRARY_DIR, "common", "csgo"), { recursive: true })
    const result = await getInstalledGamePath("csgo")
    expect(result).toBe(path.join(TEST_LIBRARY_DIR, "common", "csgo"))
  })

  it("should return null when installdir does not exist", async () => {
    const result = await getInstalledGamePath("nonexistent")
    expect(result).toBeNull()
  })
})
