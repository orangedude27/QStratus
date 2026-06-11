import express from "express"

import {
  ControllerGetAll,
  ControllerGetByID,
  ControllerScanSteam,
  ControllerGetDiscovered,
  ControllerClaimGame,
  ControllerCreateGame,
  ControllerDeleteGame,
} from "./gamesController.js"

const router = express.Router()

router.get("/:id", ControllerGetByID)

router.get("/", ControllerGetAll)

router.post("/scan", ControllerScanSteam)

router.get("/discovered", ControllerGetDiscovered)

router.post("/discovered/:appid/claim", ControllerClaimGame)

router.post("/", ControllerCreateGame)

router.delete("/:id", ControllerDeleteGame)

export default router
