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

const router = express.Router()

router.post("/bootstrap", ControllerBootstrap)
router.post("/google", ControllerGoogleAuth)
router.post("/local/register", ControllerRegisterLocal)
router.post("/local/login", ControllerLoginLocal)
router.post("/create", ControllerCreateUser)
router.get("/", ControllerGetUserByToken)
router.post("/logout", ControllerLogout)

export default router
