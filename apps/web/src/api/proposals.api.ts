import { apiClient } from "./client";
import type {
  Entry,
  EntryProposal,
  EntryType,
  DoAndDontRule,
  PaginationMeta,
} from "../types/stashbox";

export interface ProposalPayload {
  title: string;
  description: string;
  code?: string;
  language?: string;
  notes: string;
  gotchas?: string;
  dosAndDonts?: DoAndDontRule[];
  targetRuntimes?: string[];
}

export interface CreateProposalInput extends ProposalPayload {
  targetWorkspaceId: string;
  targetEntryId?: string;
  sourceEntryId?: string;
  entryType?: EntryType;
  status?: "draft" | "pending";
}

export type UpdateProposalInput = Partial<ProposalPayload>;

export const ProposalsApi = {
  async listByWorkspace(
    workspaceId: string,
    page = 1,
    limit = 100,
  ): Promise<{ proposals: EntryProposal[]; pagination?: PaginationMeta }> {
    const { data } = await apiClient.get(
      `/proposals/workspace/${workspaceId}`,
      {
        params: { page, limit },
      },
    );
    return data;
  },

  async getById(proposalId: string): Promise<EntryProposal> {
    const { data } = await apiClient.get<{ proposal: EntryProposal }>(
      `/proposals/${proposalId}`,
    );
    return data.proposal;
  },

  async create(input: CreateProposalInput): Promise<EntryProposal> {
    const { data } = await apiClient.post<{ proposal: EntryProposal }>(
      "/proposals",
      input,
    );
    return data.proposal;
  },

  // Drafts only
  async update(
    proposalId: string,
    updates: UpdateProposalInput,
  ): Promise<EntryProposal> {
    const { data } = await apiClient.patch<{ proposal: EntryProposal }>(
      `/proposals/${proposalId}`,
      updates,
    );
    return data.proposal;
  },

  // Drafts only
  async remove(
    proposalId: string,
  ): Promise<{ deleted: boolean; proposalId: string }> {
    const { data } = await apiClient.delete(`/proposals/${proposalId}`);
    return data;
  },

  async submit(proposalId: string): Promise<EntryProposal> {
    const { data } = await apiClient.post<{ proposal: EntryProposal }>(
      `/proposals/${proposalId}/submit`,
    );
    return data.proposal;
  },

  async approve(
    proposalId: string,
    forceOverride = false,
  ): Promise<{ proposalId: string; status: string; entry: Entry }> {
    const { data } = await apiClient.post(`/proposals/${proposalId}/approve`, {
      forceOverride,
    });
    return data;
  },

  async reject(
    proposalId: string,
    reviewFeedback?: string,
  ): Promise<EntryProposal> {
    const { data } = await apiClient.post(`/proposals/${proposalId}/reject`, {
      reviewFeedback: reviewFeedback || undefined,
    });
    return data;
  },

  async fork(
    proposalId: string,
    destinationWorkspaceId: string,
  ): Promise<Entry> {
    const { data } = await apiClient.post<{ entry: Entry }>(
      `/proposals/${proposalId}/fork`,
      {
        destinationWorkspaceId,
      },
    );
    return data.entry;
  },
};
