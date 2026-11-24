import { Router } from "express";
import { googleLogin, getCurrentUser, logout } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/google", googleLogin);
authRouter.get("/me", authenticate, getCurrentUser);
authRouter.post("/logout", authenticate, logout);

export default authRouter;
