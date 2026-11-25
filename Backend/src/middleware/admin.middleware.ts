import type { Request, Response, NextFunction } from "express";


export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board Admin"');
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  const base64 = authHeader.slice("Basic ".length);
  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const colonIndex = decoded.indexOf(":");
  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  const expectedUser = process.env.ADMIN_USER ?? "admin";
  const expectedPass = process.env.ADMIN_PASS ?? "changeme";

  if (user !== expectedUser || pass !== expectedPass) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board Admin"');
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  next();
}
