import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
  
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("JWT_SECRET must contain at least 32 bytes");
    }
  
    return secret;
  }
  
  const JWT_SECRET = getJwtSecret();

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}