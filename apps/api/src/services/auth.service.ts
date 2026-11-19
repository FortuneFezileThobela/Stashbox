import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@stashbox/db";
import { users, apiTokens } from "@stashbox/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
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

type UserRecord = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  jobTitle: string | null;
  organization: string | null;
  bio: string | null;
  primaryLanguages: string[] | null;
  githubId: string | null;
  profileUrl: string | null;
  themePreference: "dark" | "light" | string;
};

const MS_PER_DAY = 86_400_000;
const DEFAULT_SESSION_EXPIRY_DAYS = 30;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const isLegacyHash = (hash: string) => /^[a-f0-9]{64}$/.test(hash);

export const hashPassword = (password: string) =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const hashApiToken = (rawToken: string) => sha256(rawToken);

export function generatePersonalAccessToken() {
  const rawToken = `sbx_${crypto.randomBytes(32).toString("hex")}`;
  return {
    rawToken,
    tokenHash: hashApiToken(rawToken),
  };
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (isLegacyHash(stored)) {
    const a = Buffer.from(sha256(password), "utf8");
    const b = Buffer.from(stored, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return bcrypt.compare(password, stored);
}

function normalizeGithubProfile(
  rawGithubId?: string | null,
  rawProfileUrl?: string | null,
) {
  const githubId = rawGithubId?.trim().replace(/^@/, "") || null;
  const profileUrl =
    rawProfileUrl?.trim() ||
    (githubId ? `https://github.com/${githubId}.png` : null);

  return { githubId, profileUrl };
}

function formatUserProfile(user: UserRecord) {
  return {
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
  };
}

export class AuthService {
  static async getProfile(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    return formatUserProfile(user);
  }

  static async listTokens(userId: string, currentTokenHash?: string) {
    const now = new Date();
    const rows = await db
      .select({
        id: apiTokens.tokenId,
        name: apiTokens.name,
        tokenHash: apiTokens.tokenHash,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));

    return rows.map(({ tokenHash, ...token }) => ({
      ...token,
      isCurrent: Boolean(currentTokenHash && tokenHash === currentTokenHash),
      expired: Boolean(token.expiresAt && token.expiresAt < now),
    }));
  }

  static async updateProfile(userId: string, updates: UpdateProfileParams) {
    const { githubId, profileUrl } = normalizeGithubProfile(
      updates.githubId,
      updates.profileUrl,
    );

    const [updated] = await db
      .update(users)
      .set({
        ...(updates.fullName ? { fullName: updates.fullName.trim() } : {}),
        jobTitle: updates.jobTitle?.trim() || null,
        organization: updates.organization?.trim() || null,
        bio: updates.bio?.trim() || null,
        githubId,
        profileUrl,
        ...(updates.primaryLanguages
          ? { primaryLanguages: updates.primaryLanguages }
          : {}),
        ...(updates.themePreference
          ? { themePreference: updates.themePreference }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId))
      .returning();

    if (!updated) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    return formatUserProfile(updated);
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
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record) {
      throw new AppError(401, "Invalid or revoked API token", "UNAUTHORIZED");
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      throw new AppError(401, "API token has expired", "TOKEN_EXPIRED");
    }

    const now = new Date();
    await db
      .update(apiTokens)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(apiTokens.tokenHash, tokenHash));

    return formatUserProfile(record);
  }

  static async register(input: RegisterUserParams) {
    const email = input.email?.trim().toLowerCase();
    const username = input.username
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const fullName = input.fullName?.trim();
    const password = input.password;
    const { githubId, profileUrl } = normalizeGithubProfile(
      input.githubId,
      input.profileUrl,
    );

    if (!email || !username || !fullName || !password) {
      throw new AppError(
        400,
        "Full name, username, email, and password are required",
        "BAD_REQUEST",
      );
    }

    if (password.length < 8) {
      throw new AppError(
        400,
        "Password must be at least 8 characters",
        "BAD_REQUEST",
      );
    }

    const [existingUser] = await db
      .select({
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existingUser) {
      const conflictField = existingUser.email === email ? "Email" : "Username";
      throw new AppError(
        409,
        `${conflictField} is already taken`,
        "USER_ALREADY_EXISTS",
      );
    }

    const passwordHash = await hashPassword(password);

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        username,
        fullName,
        passwordHash,
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
      expiresInDays: DEFAULT_SESSION_EXPIRY_DAYS,
    });

    return {
      token: tokenData.token,
      user: formatUserProfile(createdUser),
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
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new AppError(
        401,
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError(
        401,
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    if (isLegacyHash(user.passwordHash)) {
      const upgradedHash = await hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash: upgradedHash, updatedAt: new Date() })
        .where(eq(users.userId, user.userId));
    }

    const tokenData = await this.createToken({
      userId: user.userId,
      name: "Web Session",
      expiresInDays: DEFAULT_SESSION_EXPIRY_DAYS,
    });

    return {
      token: tokenData.token,
      user: formatUserProfile(user),
    };
  }

  static async createToken({ userId, name, expiresInDays }: CreateTokenParams) {
    const { rawToken, tokenHash } = generatePersonalAccessToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * MS_PER_DAY)
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
      throw new AppError(
        404,
        "Token not found or unauthorized",
        "TOKEN_NOT_FOUND",
      );
    }

    return { revoked: true, tokenId: deletedToken.id };
  }
}
