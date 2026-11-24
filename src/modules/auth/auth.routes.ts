import { Router } from "express";
import { googleLogin, getCurrentUser } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/google", googleLogin);
authRouter.get("/me", authenticate, getCurrentUser);

export default authRouter;
