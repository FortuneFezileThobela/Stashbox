import { apiClient } from "./client";
import type {
  Entry,
  EntryProposal,
  EntryType,
  ApprovalStatus,
  DoAndDontRule,
  PaginationMeta,
} from "../types/stashbox";

export interface ListEntriesQuery {
  workspaceId: string;
  language?: string;
  search?: string;
  status?: ApprovalStatus;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface CreateEntryInput {
  workspaceId: string;
  type: EntryType;
  title: string;
  description?: string;
  language?: string;
  code?: string;
  notes?: string;
  gotchas?: string;
  saveAsDraft?: boolean;
  targetRuntimes?: string[];
  tags?: string[];
  dosAndDonts?: DoAndDontRule[];
}

export type UpdateEntryInput = Partial<
  Omit<CreateEntryInput, "workspaceId" | "type">
> & {
  forceApprove?: boolean;
};

export type UpdateOutcome = "updated" | "merged" | "proposed";

export interface UpdateEntryResult {
  outcome: UpdateOutcome;
  entry?: Entry;
  proposal?: EntryProposal;
}

export const EntriesApi = {
  async list(
    query: ListEntriesQuery,
  ): Promise<{ items: Entry[]; pagination: PaginationMeta }> {
    const { data } = await apiClient.get("/entries", {
      params: {
        workspaceId: query.workspaceId,
        language: query.language || undefined,
        search: query.search || undefined,
        status: query.status || undefined,
        tags: query.tags?.length ? query.tags.join(",") : undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
      },
    });
    return data;
  },

  async getById(entryId: string): Promise<Entry> {
    const { data } = await apiClient.get<{ entry: Entry }>(
      `/entries/${entryId}`,
    );
    return data.entry;
  },

  async create(input: CreateEntryInput): Promise<Entry> {
    const { data } = await apiClient.post<{ entry: Entry }>("/entries", input);
    return data.entry;
  },

  async update(
    entryId: string,
    updates: UpdateEntryInput,
  ): Promise<UpdateEntryResult> {
    const { data } = await apiClient.patch(`/entries/${entryId}`, updates);
    return {
      outcome: data.outcome ?? "updated",
      entry: data.entry,
      proposal: data.proposal,
    };
  },

  async submit(entryId: string): Promise<Entry> {
    const { data } = await apiClient.post<{ entry: Entry }>(
      `/entries/${entryId}/submit`,
    );
    return data.entry;
  },

  async approve(entryId: string, forceOverride = false): Promise<Entry> {
    const { data } = await apiClient.post<{ entry: Entry }>(
      `/entries/${entryId}/approve`,
      {
        forceOverride,
      },
    );
    return data.entry;
  },

  async remove(
    entryId: string,
  ): Promise<{ deleted: boolean; entryId: string }> {
    const { data } = await apiClient.delete(`/entries/${entryId}`);
    return data;
  },

  async fork(entryId: string, destinationWorkspaceId: string): Promise<Entry> {
    const { data } = await apiClient.post<{ entry: Entry }>(
      `/entries/${entryId}/fork`,
      {
        destinationWorkspaceId,
      },
    );
    return data.entry;
  },
};
