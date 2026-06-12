import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto"
import { promisify } from "util"
import { OAuth2Client } from "google-auth-library"
import jwt from "jsonwebtoken"
import type { Request, Response } from "express"

import {
  createUser,
  getUserById,
  getUserByUsername,
  hasUsers,
  type UserRecord,
} from "../lib/localStore.js"

import type { Token } from "../lib/authToken.js"
import {
  getTokenFromAuthorizationHeader,
  verifyAuthToken,
} from "../lib/authToken.js"

const scrypt = promisify(scryptCallback)

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`)
  }
  return value
}

const toPublicUser = (user: UserRecord) => {
  return {
    UserID: user.UserID,
    Username: user.Username,
    Email: user.Email,
  }
}

const createAuthToken = (tokenPayload: Token): string => {
  return jwt.sign(tokenPayload, getEnv("AUTH_SECRET"), {
    expiresIn: "7d",
  })
}

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex")
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${key.toString("hex")}`
}

const verifyPassword = async (password: string, storedHash: string) => {
  const [salt, keyHex] = storedHash.split(":")
  if (!salt || !keyHex) {
    return false
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const expectedKey = Buffer.from(keyHex, "hex")

  if (derivedKey.length !== expectedKey.length) {
    return false
  }

  return timingSafeEqual(derivedKey, expectedKey)
}

export const ControllerGoogleAuth = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    if (!googleClient) {
      return res.status(503).json({ error: "Google auth is not configured" })
    }

    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ error: "Missing credential" })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()

    if (!payload) {
      return res.status(401).json({ error: "Invalid token" })
    }

    const googleUser = {
      googleSub: payload.sub,
      email: payload.email,
    }

    const whitelisted_domain = process.env.WHITELISTED_DOMAIN
    if (whitelisted_domain && !googleUser.email?.endsWith(`@${whitelisted_domain}`)) {
      return res.status(401).json({
        error: `Please use your @${whitelisted_domain} email to sign in.`,
      })
    }

    const existingUser = await getUserById(googleUser.googleSub)
    const authToken = createAuthToken({
      userId: googleUser.googleSub,
      email: googleUser.email,
    })

    if (!existingUser) {
      return res.status(403).json({
        error: "User not found",
        token: authToken,
      })
    }

    return res.status(200).json({
      token: authToken,
      user: toPublicUser(existingUser),
    })
  } catch (error) {
    console.error(error)
    return res.status(401).json({ error: "Google auth failed" })
  }
}

export const ControllerRegisterLocal = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username, password } = req.body as {
      username?: string
      password?: string
    }

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" })
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" })
    }

    const passwordHash = await hashPassword(password)
    const createdUser = await createUser({
      username,
      email: "",
      authProvider: "local",
      passwordHash,
    })

    const token = createAuthToken({ userId: createdUser.UserID })

    return res.status(201).json({
      token,
      user: toPublicUser(createdUser),
    })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}

export const ControllerLoginLocal = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username, password } = req.body as {
      username?: string
      password?: string
    }

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" })
    }

    const user = await getUserByUsername(username)
    if (!user || user.AuthProvider !== "local" || !user.PasswordHash) {
      return res.status(401).json({ error: "Invalid username or password" })
    }

    const isValid = await verifyPassword(password, user.PasswordHash)
    if (!isValid) {
      return res.status(401).json({ error: "Invalid username or password" })
    }

    const token = createAuthToken({
      userId: user.UserID,
      email: user.Email || undefined,
    })

    return res.status(200).json({
      token,
      user: toPublicUser(user),
    })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}

export const ControllerCreateUser = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username } = req.body as { username?: string }

    if (!username) {
      throw new Error("Username is required")
    }

    const token = getTokenFromAuthorizationHeader(req)
    const decodedToken = verifyAuthToken(token)

    const createdUser = await createUser({
      userId: decodedToken.userId,
      username,
      email: decodedToken.email ?? "",
      authProvider: "google",
    })

    return res.status(201).json({ user: toPublicUser(createdUser) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}

export const ControllerGetUserByToken = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const token = getTokenFromAuthorizationHeader(req)
    const decodedToken = verifyAuthToken(token)
    const user = await getUserById(decodedToken.userId)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.status(200).json({ user: toPublicUser(user) })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}

export const ControllerLogout = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.status(200).json({ ok: true })
}

export const ControllerGetAuthConfig = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID)
  const whitelistEnabled = process.env.WHITELISTED_USERS
    ? JSON.parse(process.env.WHITELISTED_USERS).length > 0
    : false

  res.status(200).json({
    googleEnabled,
    whitelistEnabled,
    localEnabled: true,
  })
}

export const ControllerBootstrap = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username, password, email } = req.body as {
      username?: string
      password?: string
      email?: string
    }

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" })
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" })
    }

    const usersExist = await hasUsers()
    if (usersExist) {
      return res
        .status(409)
        .json({ error: "Bootstrap already completed — users exist" })
    }

    const passwordHash = await hashPassword(password)
    const createdUser = await createUser({
      username,
      email: email || "",
      authProvider: "local",
      passwordHash,
    })

    const token = createAuthToken({ userId: createdUser.UserID })

    return res.status(201).json({
      message: "Admin account created",
      token,
      user: toPublicUser(createdUser),
    })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}
