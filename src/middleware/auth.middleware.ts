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


export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication token required. Use format: Authorization: Bearer <token>",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Bearer token missing" });
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
    }

    const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    const user = await prisma.user.findUnique({
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

    if (!user) {
      res.status(401).json({ error: "User associated with token no longer exists" });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      error: "Invalid or expired authentication token",
    });
  }
}
