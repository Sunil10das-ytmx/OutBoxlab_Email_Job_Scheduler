import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { loginWithGoogle } from "./auth.service.js";
import { redis } from "../../config/redis.js";


function extractTokenFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("token="));
  return match ? decodeURIComponent(match.slice("token=".length)) : undefined;
}

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

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

export async function logout(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  const token = bearerToken || extractTokenFromCookie(req.headers.cookie);

  if (token) {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const ttlSeconds = decoded?.exp
        ? Math.max(60, decoded.exp - Math.floor(Date.now() / 1000))
        : 7 * 24 * 60 * 60;
      await redis.set(`auth:blacklist:${token}`, "1", "EX", ttlSeconds);
    } catch {
    }
  }

  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}
