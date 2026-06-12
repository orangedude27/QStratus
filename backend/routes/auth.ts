import express from "express"

import {
  ControllerBootstrap,
  ControllerCreateUser,
  ControllerGetUserByToken,
  ControllerGoogleAuth,
  ControllerLoginLocal,
  ControllerRegisterLocal,
  ControllerLogout,
} from "./authController.js"
import {
  loginRateLimiter,
  registerRateLimiter,
  generalRateLimiter,
} from "../lib/rateLimiter.js"

const router = express.Router()

router.post("/bootstrap", loginRateLimiter, ControllerBootstrap)
router.post("/google", generalRateLimiter, ControllerGoogleAuth)
router.post("/local/register", registerRateLimiter, ControllerRegisterLocal)
router.post("/local/login", loginRateLimiter, ControllerLoginLocal)
router.post("/create", generalRateLimiter, ControllerCreateUser)
router.get("/", generalRateLimiter, ControllerGetUserByToken)
router.post("/logout", generalRateLimiter, ControllerLogout)

export default router
