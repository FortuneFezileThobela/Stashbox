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

const DEFAULT_TOKEN_TOUCH_INTERVAL_MS = 5 * 60_000;
const parsedTouchInterval = Number(process.env.TOKEN_TOUCH_INTERVAL_MS);
const TOKEN_TOUCH_INTERVAL_MS =
  Number.isFinite(parsedTouchInterval) && parsedTouchInterval >= 0
    ? parsedTouchInterval
    : DEFAULT_TOKEN_TOUCH_INTERVAL_MS;

/**
 * Hashes a raw bearer token using SHA-256
 */
export function hashApiToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}


//generates a new personal access token and its corresponding hash for storage in the database. The raw token is returned to the user, while the hash is stored for authentication purposes.
export function generatePersonalAccessToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawToken = `sbx_live_${randomBytes}`;
  const tokenHash = hashApiToken(rawToken);
  return { rawToken, tokenHash };
}

function shouldTouchLastUsed(
  lastUsedAt: Date | string | null,
  nowMs: number,
): boolean {
  if (!lastUsedAt) return true;
  const lastUsedMs = new Date(lastUsedAt).getTime();
  if (Number.isNaN(lastUsedMs)) return true;
  return nowMs - lastUsedMs > TOKEN_TOUCH_INTERVAL_MS;
}


//validates the provided raw bearer token, checks if it exists in the database, and returns the associated user if valid. If the token is invalid or revoked, it returns null.
async function resolveUserFromToken(
  rawToken: string,
): Promise<AuthenticatedUser | null> {
  const tokenHash = hashApiToken(rawToken);
  const now = new Date();

  const [record] = await db
    .select({
      userId: users.userId,
      email: users.email,
      tokenId: apiTokens.tokenId,
      lastUsedAt: apiTokens.lastUsedAt,
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

  if (shouldTouchLastUsed(record.lastUsedAt, now.getTime())) {
    db.update(apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(apiTokens.tokenId, record.tokenId))
      .execute()
      .catch(() => {
        // Non-critical background update failure
      });
  }

  return {
    id: record.userId,
    email: record.email,
  };
}



//protects routes that require strict authentication. If the request does not have a valid bearer token, it will throw an AppError with a 401 status code.
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

    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) {
      throw new AppError(
        401,
        "Missing or malformed Authorization header",
        "UNAUTHORIZED",
      );
    }

    const user = await resolveUserFromToken(rawToken);

    if (!user) {
      throw new AppError(401, "Invalid or revoked API token", "UNAUTHORIZED");
    }

    req.user = user;
    next();
  },
);


//optionalAuth is used for routes that can be accessed by both authenticated and unauthenticated users.
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const rawToken = authHeader.replace("Bearer ", "").trim();
      if (rawToken) {
        try {
          const user = await resolveUserFromToken(rawToken);
          if (user) {
            req.user = user;
          }
        } catch {
          // Suppress auth lookup errors for optional guests
        }
      }
    }

    next();
  },
);
