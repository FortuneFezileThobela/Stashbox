import { apiClient } from "./client";
import type {
  DiscussionComment,
  DiscussionThread,
  DiscussionThreadDetail,
  ThreadStatus,
} from "../types/stashbox";

export interface CreateThreadInput {
  entryId: string;
  title: string;
  body: string;
  // Both or neither
  lineStart?: number;
  lineEnd?: number;
}

export interface AddCommentInput {
  content: string;
  codeBlock?: string;
  codeLanguage?: string;
  isSuggestion?: boolean;
}

export const DiscussionsApi = {
  async listByEntry(entryId: string): Promise<DiscussionThread[]> {
    const { data } = await apiClient.get<{ threads: DiscussionThread[] }>(`/discussions/entry/${entryId}`);
    return data.threads ?? [];
  },

  async getThread(threadId: string): Promise<DiscussionThreadDetail> {
    const { data } = await apiClient.get<{ thread: DiscussionThreadDetail }>(`/discussions/${threadId}`);
    return data.thread;
  },

  async createThread(input: CreateThreadInput): Promise<DiscussionThread> {
    const { data } = await apiClient.post<{ thread: DiscussionThread }>("/discussions", input);
    return data.thread;
  },

  async addComment(threadId: string, input: AddCommentInput): Promise<DiscussionComment> {
    const { data } = await apiClient.post<{ comment: DiscussionComment }>(`/discussions/${threadId}/comments`, input);
    return data.comment;
  },

  async updateStatus(threadId: string, status: ThreadStatus, resolutionSummary?: string): Promise<DiscussionThread> {
    const { data } = await apiClient.patch<{ thread: DiscussionThread }>(`/discussions/${threadId}/status`, {
      status,
      resolutionSummary: resolutionSummary || undefined,
    });
    return data.thread;
  },
};