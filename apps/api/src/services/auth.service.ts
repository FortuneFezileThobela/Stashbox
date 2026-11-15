import crypto from "node:crypto";
import { eq, and, or } from "drizzle-orm";
import { db } from "@stashbox/db";
import { apiTokens, users } from "@stashbox/db/schema";
import {
  generatePersonalAccessToken,
  hashApiToken,
} from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";


export interface UpdateProfileParams {
  fullName?: string;
  jobTitle?: string | null;
  organization?: string | null;
  bio?: string | null;
  githubId?: string | null;
  profileUrl?: string | null;
  primaryLanguages?: string[];
  themePreference?: "dark" | "light";
}
export interface CreateTokenParams {
  userId: string;
  name: string;
  expiresInDays?: number;
}

export interface RegisterUserParams {
  email: string;
  username: string;
  fullName: string;
  password: string;
  jobTitle?: string;
  organization?: string;
  bio?: string;
  primaryLanguages?: string[];
  githubId?: string;
  profileUrl?: string;
}

export interface LoginUserParams {
  email: string;
  password: string;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export class AuthService {


  static async updateProfile(userId: string, updates: UpdateProfileParams) {
  const cleanGithubId = updates.githubId?.trim().replace(/^@/, "") || null;
  const cleanProfileUrl =
    updates.profileUrl?.trim() ||
    (cleanGithubId ? `https://github.com/${cleanGithubId}.png` : null);

  const [updated] = await db
    .update(users)
    .set({
      ...(updates.fullName ? { fullName: updates.fullName.trim() } : {}),
      jobTitle: updates.jobTitle?.trim() ?? null,
      organization: updates.organization?.trim() ?? null,
      bio: updates.bio?.trim() ?? null,
      githubId: cleanGithubId,
      profileUrl: cleanProfileUrl,
      ...(updates.primaryLanguages ? { primaryLanguages: updates.primaryLanguages } : {}),
      ...(updates.themePreference ? { themePreference: updates.themePreference } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.userId, userId))
    .returning();

  if (!updated) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  return {
    id: updated.userId,
    userId: updated.userId,
    email: updated.email,
    username: updated.username,
    fullName: updated.fullName,
    jobTitle: updated.jobTitle,
    organization: updated.organization,
    bio: updated.bio,
    primaryLanguages: updated.primaryLanguages,
    githubId: updated.githubId,
    profileUrl: updated.profileUrl,
    themePreference: updated.themePreference,
  };
}

  static async verifyPersonalAccessToken(rawToken: string) {
    const tokenHash = hashApiToken(rawToken);

    const [record] = await db
      .select({
        userId: users.userId,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        jobTitle: users.jobTitle,
        organization: users.organization,
        bio: users.bio,
        primaryLanguages: users.primaryLanguages,
        githubId: users.githubId,
        profileUrl: users.profileUrl,
        themePreference: users.themePreference,
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

    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiTokens.tokenHash, tokenHash));

    return {
      id: record.userId,
      userId: record.userId,
      email: record.email,
      username: record.username,
      fullName: record.fullName,
      jobTitle: record.jobTitle,
      organization: record.organization,
      bio: record.bio,
      primaryLanguages: record.primaryLanguages,
      githubId: record.githubId,
      profileUrl: record.profileUrl,
      themePreference: record.themePreference,
    };
  }

  static async register(input: RegisterUserParams) {
    const email = input.email?.trim().toLowerCase();
    const username = input.username
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const fullName = input.fullName?.trim();
    const password = input.password;
    const githubId = input.githubId?.trim().replace(/^@/, "") || null;
    const profileUrl =
      input.profileUrl?.trim() ||
      (githubId ? `https://github.com/${githubId}.png` : null);

    if (!email || !username || !fullName || !password) {
      throw new AppError(
        400,
        "Full name, username, email, and password are required",
        "BAD_REQUEST"
      );
    }

    if (password.length < 8) {
      throw new AppError(
        400,
        "Password must be at least 8 characters",
        "BAD_REQUEST"
      );
    }

    const [existingUser] = await db
      .select({
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)));

    if (existingUser) {
      const conflictField =
        existingUser.email === email ? "Email" : "Username";
      throw new AppError(
        409,
        `${conflictField} is already taken`,
        "USER_ALREADY_EXISTS"
      );
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        username,
        fullName,
        passwordHash: hashPassword(password),
        jobTitle: input.jobTitle?.trim() || null,
        organization: input.organization?.trim() || null,
        bio: input.bio?.trim() || null,
        primaryLanguages: input.primaryLanguages ?? [],
        githubId,
        profileUrl,
      })
      .returning();

    if (!createdUser) {
      throw new AppError(500, "Failed to register user", "INTERNAL_ERROR");
    }

    const tokenData = await this.createToken({
      userId: createdUser.userId,
      name: "Web Session",
      expiresInDays: 30,
    });

    return {
      token: tokenData.token,
      user: {
        id: createdUser.userId,
        userId: createdUser.userId,
        email: createdUser.email,
        username: createdUser.username,
        fullName: createdUser.fullName,
        jobTitle: createdUser.jobTitle,
        organization: createdUser.organization,
        bio: createdUser.bio,
        primaryLanguages: createdUser.primaryLanguages,
        githubId: createdUser.githubId,
        profileUrl: createdUser.profileUrl,
        themePreference: createdUser.themePreference,
      },
    };
  }

  static async login(input: LoginUserParams) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      throw new AppError(400, "Email and password are required", "BAD_REQUEST");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    if (user.passwordHash !== hashPassword(password)) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const tokenData = await this.createToken({
      userId: user.userId,
      name: "Web Session",
      expiresInDays: 30,
    });

    return {
      token: tokenData.token,
      user: {
        id: user.userId,
        userId: user.userId,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        organization: user.organization,
        bio: user.bio,
        primaryLanguages: user.primaryLanguages,
        githubId: user.githubId,
        profileUrl: user.profileUrl,
        themePreference: user.themePreference,
      },
    };
  }

  static async createToken({ userId, name, expiresInDays }: CreateTokenParams) {
    const { rawToken, tokenHash } = generatePersonalAccessToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

    const [insertedToken] = await db
      .insert(apiTokens)
      .values({ userId, name, tokenHash, expiresAt })
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
      token: rawToken,
      expiresAt: insertedToken.expiresAt?.toISOString() || null,
      createdAt: insertedToken.createdAt.toISOString(),
    };
  }

  static async revokeToken(userId: string, tokenId: string) {
    if (!tokenId) {
      throw new AppError(400, "Token ID is required", "BAD_REQUEST");
    }

    const [deletedToken] = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.tokenId, tokenId), eq(apiTokens.userId, userId)))
      .returning({ id: apiTokens.tokenId });

    if (!deletedToken) {
      throw new AppError(404, "Token not found or unauthorized", "TOKEN_NOT_FOUND");
    }

    return { revoked: true, tokenId: deletedToken.id };
  }
}