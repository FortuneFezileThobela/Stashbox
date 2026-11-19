import { apiClient } from "./client";
import type {
  Workspace,
  WorkspaceType,
  WorkspaceVisibility,
  WorkspaceRole,
  WorkspaceMember,
  MemberCandidate,
  PaginationMeta,
} from "../types/stashbox";

export interface CreateWorkspaceInput {
  name: string;
  handle: string;
  type?: WorkspaceType;
  visibility?: WorkspaceVisibility;
  parentId?: string;
}

export interface ForkWorkspaceInput {
  name?: string;
  handle: string;
  visibility?: WorkspaceVisibility;
  destinationParentId?: string;
  includeChildren?: boolean;
}

export const WorkspacesApi = {
  // Workspaces the signed-in user belongs to 
  async listWorkspaces(
    page = 1,
    limit = 50,
  ): Promise<{ workspaces: Workspace[]; pagination: PaginationMeta }> {
    const { data } = await apiClient.get("/workspaces", {
      params: { page, limit },
    });

    const normalized: Workspace[] = (data.workspaces || []).map((row: any) => {
      // Older responses nested the join result; newer ones are already flat.
      if (row.workspaces) {
        return {
          ...row.workspaces,
          role: row.workspace_members?.role ?? "member",
        };
      }
      return row;
    });

    return { workspaces: normalized, pagination: data.pagination };
  },


  async listPublic(
    search?: string,
    page = 1,
    limit = 12,
  ): Promise<{ workspaces: Workspace[]; pagination?: PaginationMeta }> {
    const { data } = await apiClient.get("/workspaces/public", {
      params: { search: search || undefined, page, limit },
    });
    return { workspaces: data.workspaces || [], pagination: data.pagination };
  },

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const { data } = await apiClient.post<{ workspace: Workspace }>(
      "/workspaces",
      input,
    );
    return { ...data.workspace, role: "owner" };
  },

  async listMembers(
    workspaceId: string,
    page = 1,
    limit = 100,
  ): Promise<{ members: WorkspaceMember[]; pagination?: PaginationMeta }> {
    const { data } = await apiClient.get(`/workspaces/${workspaceId}/members`, {
      params: { page, limit },
    });
    return { members: data.members || [], pagination: data.pagination };
  },

  //find people by name or username to add.
  async searchMemberCandidates(
    workspaceId: string,
    q: string,
  ): Promise<MemberCandidate[]> {
    const { data } = await apiClient.get<{ candidates: MemberCandidate[] }>(
      `/workspaces/${workspaceId}/member-candidates`,
      { params: { q } },
    );
    return data.candidates ?? [];
  },

  // Pass either a user id or a username (with or without the @)
  async addMember(
    workspaceId: string,
    who: { userId?: string; username?: string },
    role: WorkspaceRole,
  ) {
    const { data } = await apiClient.post(
      `/workspaces/${workspaceId}/members`,
      { ...who, role },
    );
    return data.membership;
  },

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ) {
    const { data } = await apiClient.patch(
      `/workspaces/${workspaceId}/members/${userId}`,
      { role },
    );
    return data.membership;
  },

  async removeMember(workspaceId: string, userId: string) {
    const { data } = await apiClient.delete(
      `/workspaces/${workspaceId}/members/${userId}`,
    );
    return data;
  },

  async forkWorkspace(
    workspaceId: string,
    input: ForkWorkspaceInput,
  ): Promise<Workspace> {
    const { data } = await apiClient.post<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}/fork`,
      input,
    );
    return { ...data.workspace, role: "owner" };
  },
};
