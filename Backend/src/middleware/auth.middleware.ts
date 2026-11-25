import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";

interface JwtPayload {
  userId: string;
  email: string;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        googleId: string;
        name: string;
        email: string;
        avatar: string | null;
        createdAt: Date;
      };
    }
  }
}


function extractTokenFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("token="));
  return match ? decodeURIComponent(match.slice("token=".length)) : undefined;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  const token = bearerToken || extractTokenFromCookie(req.headers.cookie);

  if (!token) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    try {
      const isBlacklisted = await redis.get(`auth:blacklist:${token}`);
      if (isBlacklisted) {
        res.status(401).json({ error: "Session has been logged out" });
        return;
      }
    } catch {
      // Redis unavailable; continue token verification
    }

    const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (jwtError) {
      res.status(401).json({
        error: "Invalid or expired authentication token",
      });
      return;
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          googleId: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
        },
      });
    } catch (dbError: any) {
      console.error("[Auth] Database error verifying user:", dbError.message);
      res.status(503).json({
        error: "Database temporarily unavailable, please retry",
      });
      return;
    }

    if (!user) {
      res.status(401).json({ error: "User associated with token no longer exists" });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(500).json({
      error: "Internal authentication error",
    });
  }
}
