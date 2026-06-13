import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import request from "supertest"
import express from "express"
import { setupTestEnv, cleanupTestEnv } from "./setup.js"
import downloadRoutes from "../routes/download.js"
import * as dockerTrigger from "../lib/dockerTrigger.js"

function createApp() {
  const app = express()
  app.use(express.json())
  app.use("/games", downloadRoutes)
  return app
}

describe("POST /games/download", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = await setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    vi.restoreAllMocks()
  })

  it("should trigger download and return 202", async () => {
    vi.spyOn(dockerTrigger, "triggerDownload").mockResolvedValue({
      success: true,
      message: "Download started",
      appids: [730, 440],
    })

    const res = await request(app)
      .post("/games/download")
      .send({ appids: [730, 440] })

    expect(res.status).toBe(202)
    expect(res.body).toHaveProperty("message", "Download started")
    expect(res.body.appids).toEqual([730, 440])
  })

  it("should return 500 when download trigger fails", async () => {
    vi.spyOn(dockerTrigger, "triggerDownload").mockResolvedValue({
      success: false,
      message: "Failed to create download container",
      appids: [730],
    })

    const res = await request(app)
      .post("/games/download")
      .send({ appids: [730] })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Failed to create download container")
  })

  it("should return 400 when appids is missing", async () => {
    const res = await request(app).post("/games/download").send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Valid appids array is required")
  })

  it("should return 400 when appids is not an array", async () => {
    const res = await request(app)
      .post("/games/download")
      .send({ appids: "730" })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Valid appids array is required")
  })

  it("should return 400 when appids is empty", async () => {
    const res = await request(app)
      .post("/games/download")
      .send({ appids: [] })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Valid appids array is required")
  })

  it("should return 500 on unexpected error", async () => {
    vi.spyOn(dockerTrigger, "triggerDownload").mockRejectedValue(
      new Error("Network error"),
    )

    const res = await request(app)
      .post("/games/download")
      .send({ appids: [730] })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Failed to trigger download")
  })
})

describe("GET /games/download/status", () => {
  let app: express.Application
  let testEnv: ReturnType<typeof setupTestEnv>

  beforeEach(async () => {
    vi.resetModules()
    testEnv = await setupTestEnv()
    app = createApp()
  })

  afterEach(async () => {
    await cleanupTestEnv(testEnv.dataFile)
    vi.restoreAllMocks()
  })

  it("should return download status", async () => {
    vi.spyOn(dockerTrigger, "getDownloadStatus").mockResolvedValue({
      downloading: true,
      appids: [730],
      completed: [],
      failed: [],
      progress: 45,
    })

    const res = await request(app).get("/games/download/status")

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("downloading", true)
    expect(res.body).toHaveProperty("appids", [730])
    expect(res.body).toHaveProperty("progress", 45)
    expect(res.body).toHaveProperty("completed")
    expect(res.body).toHaveProperty("failed")
  })

  it("should return idle status when nothing is downloading", async () => {
    vi.spyOn(dockerTrigger, "getDownloadStatus").mockResolvedValue({
      downloading: false,
      appids: [],
      completed: [],
      failed: [],
      progress: 0,
    })

    const res = await request(app).get("/games/download/status")

    expect(res.status).toBe(200)
    expect(res.body.downloading).toBe(false)
    expect(res.body.progress).toBe(0)
  })

  it("should return 500 on unexpected error", async () => {
    vi.spyOn(dockerTrigger, "getDownloadStatus").mockRejectedValue(
      new Error("Docker API error"),
    )

    const res = await request(app).get("/games/download/status")

    expect(res.status).toBe(500)
    expect(res.body.error).toBe("Failed to get download status")
  })
})
