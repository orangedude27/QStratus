import { describe, it, expect } from "vitest"
import {
  validateUserRecord,
  validateGameRecord,
  validateStoreData,
} from "../lib/storeValidation.js"

describe("validateUserRecord", () => {
  it("should accept a valid user record", () => {
    const data = {
      UserID: "abc-123",
      Username: "testuser",
      Email: "test@example.com",
      AuthProvider: "local",
      PasswordHash: "hashed123",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("should accept user without optional fields", () => {
    const data = {
      UserID: "abc-123",
      Username: "testuser",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("should reject missing UserID", () => {
    const data = {
      Username: "testuser",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("UserID is required and must be a string")
  })

  it("should reject non-string UserID", () => {
    const data = {
      UserID: 123,
      Username: "testuser",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("UserID is required and must be a string")
  })

  it("should reject missing Username", () => {
    const data = {
      UserID: "abc-123",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Username is required and must be a string")
  })

  it("should reject invalid AuthProvider", () => {
    const data = {
      UserID: "abc-123",
      Username: "testuser",
      AuthProvider: "github",
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("AuthProvider must be 'google' or 'local'")
  })

  it("should accept valid AuthProvider values", () => {
    const base = { UserID: "abc-123", Username: "testuser" }
    expect(validateUserRecord({ ...base, AuthProvider: "google" }).valid).toBe(true)
    expect(validateUserRecord({ ...base, AuthProvider: "local" }).valid).toBe(true)
  })

  it("should reject non-string PasswordHash", () => {
    const data = {
      UserID: "abc-123",
      Username: "testuser",
      PasswordHash: 12345,
    }
    const result = validateUserRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("PasswordHash must be a string if provided")
  })

  it("should reject non-object input", () => {
    expect(validateUserRecord(null).valid).toBe(false)
    expect(validateUserRecord("string").valid).toBe(false)
    expect(validateUserRecord(123).valid).toBe(false)
    expect(validateUserRecord([]).valid).toBe(false)
  })
})

describe("validateGameRecord", () => {
  it("should accept a valid game record", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      developer: "Dev Studio",
      genres: ["Action", "RPG"],
      lDescript: "A long description",
      s3: ["https://example.com/img1.jpg"],
      sDescript: "A short description",
      source: "steam",
      appid: 730,
      installdir: "csgo",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("should accept game with minimal required fields", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("should reject missing GameID", () => {
    const data = { title: "Test Game" }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("GameID is required and must be a string")
  })

  it("should reject missing title", () => {
    const data = { GameID: "game-1" }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("title is required and must be a string")
  })

  it("should reject invalid source value", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      source: "epic",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      "source must be one of: steam, non-steam, manual, seed",
    )
  })

  it("should accept all valid source values", () => {
    const base = { GameID: "game-1", title: "Test Game" }
    for (const source of ["steam", "non-steam", "manual", "seed"]) {
      const result = validateGameRecord({ ...base, source })
      expect(result.valid).toBe(true)
    }
  })

  it("should reject non-array genres", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      genres: "Action",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("genres must be an array if provided")
  })

  it("should reject genres array with non-string elements", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      genres: ["Action", 123],
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("genres[1] must be a string")
  })

  it("should reject non-array s3", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      s3: "https://example.com/img.jpg",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("s3 must be an array if provided")
  })

  it("should reject non-number appid", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      appid: "730",
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("appid must be a number if provided")
  })

  it("should reject non-string installdir", () => {
    const data = {
      GameID: "game-1",
      title: "Test Game",
      installdir: 123,
    }
    const result = validateGameRecord(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("installdir must be a string if provided")
  })

  it("should reject non-object input", () => {
    expect(validateGameRecord(null).valid).toBe(false)
    expect(validateGameRecord("string").valid).toBe(false)
    expect(validateGameRecord(123).valid).toBe(false)
  })
})

describe("validateStoreData", () => {
  it("should accept valid store data", () => {
    const data = {
      users: [
        { UserID: "u1", Username: "user1" },
        { UserID: "u2", Username: "user2" },
      ],
      games: [
        { GameID: "g1", title: "Game 1" },
        { GameID: "g2", title: "Game 2" },
      ],
    }
    const result = validateStoreData(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("should accept empty store data", () => {
    const result = validateStoreData({ users: [], games: [] })
    expect(result.valid).toBe(true)
  })

  it("should accept store with no users or games keys", () => {
    const result = validateStoreData({})
    expect(result.valid).toBe(true)
  })

  it("should reject non-array users", () => {
    const data = { users: "not-an-array", games: [] }
    const result = validateStoreData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("users must be an array")
  })

  it("should reject non-array games", () => {
    const data = { users: [], games: "not-an-array" }
    const result = validateStoreData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("games must be an array")
  })

  it("should report errors for invalid users in array", () => {
    const data = {
      users: [
        { UserID: "u1", Username: "user1" },
        { Username: "no-id" },
      ],
      games: [],
    }
    const result = validateStoreData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("users[1]: UserID is required and must be a string")
  })

  it("should report errors for invalid games in array", () => {
    const data = {
      users: [],
      games: [
        { GameID: "g1", title: "Game 1" },
        { title: "no-game-id" },
      ],
    }
    const result = validateStoreData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("games[1]: GameID is required and must be a string")
  })

  it("should reject non-object input", () => {
    expect(validateStoreData(null).valid).toBe(false)
    expect(validateStoreData("string").valid).toBe(false)
    expect(validateStoreData(123).valid).toBe(false)
  })
})
