import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@stashbox/db";
import { apiTokens, users } from "@stashbox/db/schema";
import {
  generatePersonalAccessToken,
  hashApiToken,
} from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

export interface CreateTokenParams {
  userId: string;
  name: string;
  expiresInDays?: number;
}

export class AuthService {
  /**
   * Resolves a user session from a raw Bearer token (SHA-256 hash lookup + expiry check)
   */
  static async verifyPersonalAccessToken(rawToken: string) {
    const tokenHash = hashApiToken(rawToken);

    const [record] = await db
      .select({
        userId: users.userId,
        email: users.email,
        expiresAt: apiTokens.expiresAt,
      })
      .from(apiTokens)
      .innerJoin(users, eq(apiTokens.userId, users.userId))
      .where(eq(apiTokens.tokenHash, tokenHash));

    if (!record) {
      throw new AppError(401, "Invalid or revoked API token", "UNAUTHORIZED");
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      throw new AppError(401, "API token has expired", "TOKEN_EXPIRED");
    }

    return {
      id: record.userId,
      email: record.email,
    };
  }

  /**
   * Generates a new PAT and stores only its SHA-256 hash in the database
   */
  static async createToken({ userId, name, expiresInDays }: CreateTokenParams) {
    const { rawToken, tokenHash } = generatePersonalAccessToken();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

    const [insertedToken] = await db
      .insert(apiTokens)
      .values({
        userId,
        name,
        tokenHash,
        expiresAt,
      })
      .returning({
        id: apiTokens.tokenId,
        name: apiTokens.name,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt,
      });

    if (!insertedToken) {
      throw new AppError(500, "Failed to create API token", "INTERNAL_ERROR");
    }

    return {
      id: insertedToken.id,
      name: insertedToken.name,
      token: rawToken, // Returned once to the user
      expiresAt: insertedToken.expiresAt?.toISOString() || null,
      createdAt: insertedToken.createdAt.toISOString(),
    };
  }

  /**
   * Revokes an existing API token owned by the user
   */
  static async revokeToken(userId: string, tokenId: string) {
    if (!tokenId) {
      throw new AppError(400, "Token ID is required", "BAD_REQUEST");
    }

    const [deletedToken] = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.tokenId, tokenId), eq(apiTokens.userId, userId)))
      .returning({ id: apiTokens.tokenId });

    if (!deletedToken) {
      throw new AppError(
        404,
        "Token not found or unauthorized",
        "TOKEN_NOT_FOUND",
      );
    }

    return { revoked: true, tokenId: deletedToken.id };
  }
}
