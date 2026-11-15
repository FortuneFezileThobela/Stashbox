import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import {
  discussionThreads,
  discussionComments,
  entries,
  users,
} from "@stashbox/db/schema";
import { EntriesService } from "./entries.service.js";
import { WorkspacesService } from "./workspaces.service.js";
import { eq, asc, desc } from "drizzle-orm";

export interface CreateThreadParams {
  entryId: string;
  authorId: string;
  title: string;
  body: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface CreateCommentParams {
  threadId: string;
  authorId: string;
  content: string;
  codeBlock?: string;
  codeLanguage?: string;
  isSuggestion?: boolean;
}

export class DiscussionsService {
  static async listThreadsByEntry(entryId: string, userId?: string) {
    // Enforces workspace visibility & private draft hiding
    await EntriesService.getEntryById(entryId, userId);

    const threads = await db
      .select({
        thread: discussionThreads,
        author: {
          userId: users.userId,
          username: users.username,
          fullName: users.fullName,
          profileUrl: users.profileUrl,
        },
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.createdBy, users.userId))
      .where(eq(discussionThreads.entryId, entryId))
      .orderBy(desc(discussionThreads.createdAt));

    return threads.map(({ thread, author }) => ({ ...thread, author }));
  }

  static async getThreadWithComments(threadId: string, userId?: string) {
    const [thread] = await db
      .select()
      .from(discussionThreads)
      .where(eq(discussionThreads.threadId, threadId))
      .limit(1);

    if (!thread) {
      throw new AppError(
        404,
        "Discussion thread not found",
        "THREAD_NOT_FOUND",
      );
    }

    await EntriesService.getEntryById(thread.entryId, userId);

    const comments = await db
      .select({
        comment: discussionComments,
        author: {
          userId: users.userId,
          username: users.username,
          fullName: users.fullName,
          jobTitle: users.jobTitle,
          profileUrl: users.profileUrl,
        },
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .where(eq(discussionComments.threadId, threadId))
      .orderBy(asc(discussionComments.createdAt));

    return {
      ...thread,
      comments: comments.map(({ comment, author }) => ({ ...comment, author })),
    };
  }

  static async createThread(params: CreateThreadParams) {
    const entry = await EntriesService.getEntryById(
      params.entryId,
      params.authorId,
    );

    if (
      (params.lineStart !== undefined) !== (params.lineEnd !== undefined) ||
      (params.lineStart !== undefined &&
        params.lineEnd !== undefined &&
        params.lineStart > params.lineEnd)
    ) {
      throw new AppError(400, "Invalid line range", "INVALID_LINE_RANGE");
    }

    const [thread] = await db
      .insert(discussionThreads)
      .values({
        entryId: entry.entryId,
        title: params.title,
        body: params.body,
        codeContext: entry.code,
        contextLanguage: entry.language,
        lineStart: params.lineStart ?? null,
        lineEnd: params.lineEnd ?? null,
        snippetVersionPinned: entry.version,
        codeSnapshot: entry.code,
        createdBy: params.authorId,
      })
      .returning();

    return thread;
  }

  static async addComment(params: CreateCommentParams) {
    const [thread] = await db
      .select()
      .from(discussionThreads)
      .where(eq(discussionThreads.threadId, params.threadId))
      .limit(1);

    if (!thread) {
      throw new AppError(
        404,
        "Discussion thread not found",
        "THREAD_NOT_FOUND",
      );
    }

    // Any user with read access to the entry (including public viewers) can comment
    await EntriesService.getEntryById(thread.entryId, params.authorId);

    const [comment] = await db
      .insert(discussionComments)
      .values({
        threadId: params.threadId,
        authorId: params.authorId,
        content: params.content,
        codeBlock: params.codeBlock ?? null,
        codeLanguage: params.codeLanguage ?? null,
        isSuggestion: Boolean(params.isSuggestion && params.codeBlock),
      })
      .returning();

    return comment;
  }

  static async resolveThread(
    threadId: string,
    userId: string,
    status: "resolved" | "closed" | "open",
    resolutionSummary?: string,
  ) {
    const [thread] = await db
      .select()
      .from(discussionThreads)
      .where(eq(discussionThreads.threadId, threadId))
      .limit(1);

    if (!thread) {
      throw new AppError(
        404,
        "Discussion thread not found",
        "THREAD_NOT_FOUND",
      );
    }

    const [entry] = await db
      .select()
      .from(entries)
      .where(eq(entries.entryId, thread.entryId))
      .limit(1);

    const { role } = await WorkspacesService.assertWorkspaceAccess(
      entry.workspaceId,
      userId,
      true,
    );

    const canResolve =
      thread.createdBy === userId ||
      entry.createdBy === userId ||
      role === "owner" ||
      role === "qa";

    if (!canResolve) {
      throw new AppError(
        403,
        "Not permitted to update thread status",
        "FORBIDDEN",
      );
    }

    const isResolved = status === "resolved";
    const [updated] = await db
      .update(discussionThreads)
      .set({
        status,
        resolutionSummary: isResolved ? (resolutionSummary ?? null) : null,
        resolvedBy: isResolved ? userId : null,
        resolvedAt: isResolved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(discussionThreads.threadId, threadId))
      .returning();

    return updated;
  }
}
