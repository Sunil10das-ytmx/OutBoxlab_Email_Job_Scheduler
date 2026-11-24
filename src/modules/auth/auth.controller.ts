import type { Request, Response } from "express";
import { loginWithGoogle } from "./auth.service.js";


export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    const idToken =
      req.body.credential || req.body.idToken || req.body.token;

    if (!idToken || typeof idToken !== "string") {
      res.status(400).json({
        error: "Google credential/idToken is required in request body",
      });
      return;
    }

    const { user, token } = await loginWithGoogle(idToken);

    res.status(200).json({
      success: true,
      user,
      token,
    });
  } catch (error: any) {
    console.error("Google authentication error:", error.message);
    res.status(401).json({
      error: error.message || "Google authentication failed",
    });
  }
}


export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    user: req.user,
  });
}
