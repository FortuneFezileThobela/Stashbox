import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "@stashbox/db";
import { apiTokens, users } from "@stashbox/db/schema";
import { eq, and, gt, isNull, or } from "drizzle-orm";
import { AppError, asyncHandler } from "./errorHandler.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Augment Express Request type so req.user is strictly typed across routes
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Generates a raw Personal Access Token and its SHA-256 hash for DB storage
 */
export function generatePersonalAccessToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawToken = `sbx_live_${randomBytes}`;
  const tokenHash = hashApiToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hashes a raw bearer token using SHA-256
 */
export function hashApiToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Core token validation logic used by both requireAuth and optionalAuth
 */
async function resolveUserFromToken(
  rawToken: string,
): Promise<AuthenticatedUser | null> {
  const tokenHash = hashApiToken(rawToken);
  const now = new Date();

  // Query database for valid, non-expired API token joined with user record
  const [record] = await db
    .select({
      userId: users.userId,
      email: users.email,
      tokenId: apiTokens.tokenId,
    })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.userId))
    .where(
      and(
        eq(apiTokens.tokenHash, tokenHash),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  // Asynchronously update lastUsedAt without blocking request flow
  db.update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.tokenId, record.tokenId))
    .execute()
    .catch(() => {
      // Non critical background update failure
    });

  return {
    id: record.userId,
    email: record.email,
  };
}

/**
 * Middleware: Protects routes requiring strict authentication
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(
        401,
        "Missing or malformed Authorization header",
        "UNAUTHORIZED",
      );
    }

    console.log("Authorization header:", authHeader); // Debug log
    const rawToken = authHeader.replace("Bearer ", "").trim();
    const user = await resolveUserFromToken(rawToken);

    if (!user) {
      throw new AppError(401, "Invalid or revoked API token", "UNAUTHORIZED");
    }

    req.user = user;
    next();
  },
);

/**
 * Middleware: Optional auth for public routes (e.g. public workspaces & snippets)
 */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const rawToken = authHeader.replace("Bearer ", "").trim();
      try {
        const user = await resolveUserFromToken(rawToken);
        if (user) {
          req.user = user;
        }
      } catch {
        // Suppress auth lookup errors for optional guests
      }
    }

    next();
  },
);
