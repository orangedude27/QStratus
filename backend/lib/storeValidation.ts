import type { UserRecord, GameRecord } from "./localStore.js"

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

export function validateUserRecord(data: unknown): ValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["User record must be an object"] }
  }

  const user = data as Partial<UserRecord>

  if (!user.UserID || typeof user.UserID !== "string") {
    errors.push("UserID is required and must be a string")
  }

  if (!user.Username || typeof user.Username !== "string") {
    errors.push("Username is required and must be a string")
  }

  if (user.Email !== undefined && typeof user.Email !== "string") {
    errors.push("Email must be a string if provided")
  }

  if (
    user.AuthProvider !== undefined &&
    user.AuthProvider !== "google" &&
    user.AuthProvider !== "local"
  ) {
    errors.push("AuthProvider must be 'google' or 'local'")
  }

  if (
    user.PasswordHash !== undefined &&
    typeof user.PasswordHash !== "string"
  ) {
    errors.push("PasswordHash must be a string if provided")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateGameRecord(data: unknown): ValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Game record must be an object"] }
  }

  const game = data as Partial<GameRecord>

  if (!game.GameID || typeof game.GameID !== "string") {
    errors.push("GameID is required and must be a string")
  }

  if (!game.title || typeof game.title !== "string") {
    errors.push("title is required and must be a string")
  }

  if (game.developer !== undefined && typeof game.developer !== "string") {
    errors.push("developer must be a string if provided")
  }

  if (game.genres !== undefined && !Array.isArray(game.genres)) {
    errors.push("genres must be an array if provided")
  } else if (Array.isArray(game.genres)) {
    for (let i = 0; i < game.genres.length; i++) {
      if (typeof game.genres[i] !== "string") {
        errors.push(`genres[${i}] must be a string`)
        break
      }
    }
  }

  if (game.lDescript !== undefined && typeof game.lDescript !== "string") {
    errors.push("lDescript must be a string if provided")
  }

  if (game.s3 !== undefined && !Array.isArray(game.s3)) {
    errors.push("s3 must be an array if provided")
  } else if (Array.isArray(game.s3)) {
    for (let i = 0; i < game.s3.length; i++) {
      if (typeof game.s3[i] !== "string") {
        errors.push(`s3[${i}] must be a string`)
        break
      }
    }
  }

  if (game.sDescript !== undefined && typeof game.sDescript !== "string") {
    errors.push("sDescript must be a string if provided")
  }

  if (game.source !== undefined) {
    const validSources = ["steam", "non-steam", "manual", "seed"]
    if (!validSources.includes(game.source)) {
      errors.push("source must be one of: steam, non-steam, manual, seed")
    }
  }

  if (game.appid !== undefined && typeof game.appid !== "number") {
    errors.push("appid must be a number if provided")
  }

  if (game.installdir !== undefined && typeof game.installdir !== "string") {
    errors.push("installdir must be a string if provided")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateStoreData(data: unknown): ValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Store data must be an object"] }
  }

  const store = data as Partial<{ users: unknown[]; games: unknown[] }>

  if (store.users !== undefined) {
    if (!Array.isArray(store.users)) {
      errors.push("users must be an array")
    } else {
      for (let i = 0; i < store.users.length; i++) {
        const result = validateUserRecord(store.users[i])
        if (!result.valid) {
          for (const error of result.errors) {
            errors.push(`users[${i}]: ${error}`)
          }
        }
      }
    }
  }

  if (store.games !== undefined) {
    if (!Array.isArray(store.games)) {
      errors.push("games must be an array")
    } else {
      for (let i = 0; i < store.games.length; i++) {
        const result = validateGameRecord(store.games[i])
        if (!result.valid) {
          for (const error of result.errors) {
            errors.push(`games[${i}]: ${error}`)
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
