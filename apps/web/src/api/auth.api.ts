import { apiClient, TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "./client";

export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  username: string;
  fullName: string;
  jobTitle?: string | null;
  organization?: string | null;
  bio?: string | null;
  primaryLanguages: string[];
  githubId?: string | null;
  profileUrl?: string | null;
  themePreference?: "dark" | "light";
}

export interface RegisterUserInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  jobTitle?: string;
  primaryLanguages?: string[];
}

export interface LoginCredentialsInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  jobTitle?: string | null;
  organization?: string | null;
  bio?: string | null;
  githubId?: string | null;
  profileUrl?: string | null;
  primaryLanguages?: string[];
  themePreference?: "dark" | "light";
}

export interface CreatePatResponse {
  id: string;
  name: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
  /** The token this very session is using */
  isCurrent: boolean;
  expired: boolean;
}

export const AuthApi = {
 
  async getMe(): Promise<AuthenticatedUser> {
    const { data } = await apiClient.get<{ user: AuthenticatedUser }>(
      "/auth/me",
      { silent: true },
    );
    return { ...data.user, userId: data.user.userId ?? data.user.id };
  },

  async login(input: LoginCredentialsInput): Promise<AuthenticatedUser> {
    const { data } = await apiClient.post<{
      token: string;
      user: AuthenticatedUser;
    }>("/auth/login", input);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    return data.user;
  },

  async register(input: RegisterUserInput): Promise<AuthenticatedUser> {
    const { data } = await apiClient.post<{
      token: string;
      user: AuthenticatedUser;
    }>("/auth/register", input);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    return data.user;
  },

  async updateProfile(input: UpdateProfileInput): Promise<AuthenticatedUser> {
    const { data } = await apiClient.patch<{ user: AuthenticatedUser }>(
      "/auth/me",
      input,
    );
    return data.user;
  },

  async listTokens(): Promise<ApiTokenSummary[]> {
    const { data } = await apiClient.get<{ tokens: ApiTokenSummary[] }>(
      "/auth/tokens",
    );
    return data.tokens ?? [];
  },

  async createToken(
    name: string,
    expiresInDays?: number,
  ): Promise<CreatePatResponse> {
    const { data } = await apiClient.post<CreatePatResponse>("/auth/tokens", {
      name,
      expiresInDays,
    });
    return data;
  },

  async revokeToken(
    tokenId: string,
  ): Promise<{ revoked: boolean; tokenId: string }> {
    const { data } = await apiClient.delete<{
      revoked: boolean;
      tokenId: string;
    }>(`/auth/tokens/${tokenId}`);
    return data;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  },
};
