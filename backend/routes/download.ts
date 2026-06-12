import { Router } from "express"

import {
  ControllerTriggerDownload,
  ControllerGetDownloadStatus,
} from "./downloadController.js"

const router = Router()

router.post("/download", ControllerTriggerDownload)
router.get("/download/status", ControllerGetDownloadStatus)

export default router
