import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import { entries } from "@stashbox/db/schema";
import { WorkspacesService } from "./workspaces.service.js";
import { eq, and, ilike, sql, arrayOverlaps, or, ne, desc } from "drizzle-orm";

export interface ListEntriesFilters {
  workspaceId: string;
  language?: string;
  search?: string;
  status?: "draft" | "pending_qa" | "qa_approved" | "deprecated";
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface CreateEntryParams {
  workspaceId: string;
  createdById: string;
  type: "snippet" | "note";
  title: string;
  description?: string;
  language?: string;
  code?: string;
  saveAsDraft?: boolean;
  targetRuntimes?: string[];
  tags?: string[];
  dosAndDonts?: {
    type: "do" | "dont";
    rule: string;
    explanation: string;
  }[];
  gotchas?: string;
  notes?: string;
}

export interface UpdateEntryParams {
  title?: string;
  description?: string;
  language?: string;
  code?: string;
  notes?: string;
  gotchas?: string;
  targetRuntimes?: string[];
  tags?: string[];
  dosAndDonts?: {
    type: "do" | "dont";
    rule: string;
    explanation: string;
  }[];
  saveAsDraft?: boolean;
  forceApprove?: boolean;
}

export class EntriesService {
  /**
   * Fetches an entry while enforcing draft privacy and workspace visibility.
   */
  static async getEntryById(entryId: string, userId?: string) {
    const [entry] = await db
      .select()
      .from(entries)
      .where(eq(entries.entryId, entryId))
      .limit(1);

    if (!entry) {
      throw new AppError(404, "Entry not found", "ENTRY_NOT_FOUND");
    }

    const { role } = await WorkspacesService.assertWorkspaceAccess(
      entry.workspaceId,
      userId,
      false,
    );

    // Drafts are strictly private to their author
    if (entry.status === "draft" && entry.createdBy !== userId) {
      throw new AppError(404, "Entry not found", "ENTRY_NOT_FOUND");
    }

    // Non-members viewing a public workspace only see approved entries
    if (!role && entry.status !== "qa_approved") {
      throw new AppError(404, "Entry not found", "ENTRY_NOT_FOUND");
    }

    return entry;
  }

  static async listEntries(
    userId: string | undefined,
    filters: ListEntriesFilters,
  ) {
    const { role } = await WorkspacesService.assertWorkspaceAccess(
      filters.workspaceId,
      userId,
      false,
    );

    const conditions = [eq(entries.workspaceId, filters.workspaceId)];

    if (!role) {
      conditions.push(eq(entries.status, "qa_approved"));
    } else if (userId) {
      const visibilityRule = or(
        ne(entries.status, "draft"),
        eq(entries.createdBy, userId),
      );
      if (visibilityRule) conditions.push(visibilityRule);
    }

    if (filters.status) {
      conditions.push(eq(entries.status, filters.status));
    }
    if (filters.language) {
      conditions.push(eq(entries.language, filters.language));
    }
    if (filters.search) {
      const pattern = `%${filters.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(ilike(entries.title, pattern));
    }
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(arrayOverlaps(entries.tags, filters.tags));
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const where = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    const items = await db
      .select()
      .from(entries)
      .where(where)
      .orderBy(desc(entries.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createEntry(params: CreateEntryParams) {
    const { workspace } = await WorkspacesService.assertWorkspaceAccess(
      params.workspaceId,
      params.createdById,
      true,
    );

    if (params.type === "snippet" && (!params.code || !params.language)) {
      throw new AppError(
        400,
        "Snippets require code and language",
        "INVALID_SNIPPET",
      );
    }

    // Personal workspaces publish directly unless saved as draft; team entries enter QA
    const isPersonal = workspace.type === "personal";
    const status = params.saveAsDraft
      ? "draft"
      : isPersonal
        ? "qa_approved"
        : "pending_qa";

    const [entry] = await db
      .insert(entries)
      .values({
        workspaceId: params.workspaceId,
        createdBy: params.createdById,
        updatedBy: params.createdById,
        type: params.type,
        title: params.title,
        description: params.description ?? "",
        notes: params.notes ?? "",
        code: params.code,
        language: params.language,
        gotchas: params.gotchas,
        targetRuntimes: params.targetRuntimes ?? [],
        tags: params.tags ?? [],
        dosAndDonts: params.dosAndDonts ?? [],
        status,
        verifiedBy: status === "qa_approved" ? params.createdById : null,
        verifiedAt: status === "qa_approved" ? new Date() : null,
        version: 1,
      })
      .returning();

    return entry;
  }

  static async updateEntry(
    entryId: string,
    userId: string,
    updates: UpdateEntryParams,
  ) {
    const existing = await this.getEntryById(entryId, userId);
    const { workspace, role } = await WorkspacesService.assertWorkspaceAccess(
      existing.workspaceId,
      userId,
      true,
    );

    if (existing.status === "draft" && existing.createdBy !== userId) {
      throw new AppError(404, "Entry not found", "ENTRY_NOT_FOUND");
    }

    const isPersonal = workspace.type === "personal";
    const isOwner = role === "owner";

    let nextStatus = existing.status;
    let nextVerifiedBy = existing.verifiedBy;
    let nextVerifiedAt = existing.verifiedAt;

    if (updates.saveAsDraft) {
      nextStatus = "draft";
      nextVerifiedBy = null;
      nextVerifiedAt = null;
    } else if (isPersonal || (isOwner && updates.forceApprove)) {
      nextStatus = "qa_approved";
      nextVerifiedBy = userId;
      nextVerifiedAt = new Date();
    } else {
      // Editing an entry in a team workspace dismisses stale approval
      nextStatus = "pending_qa";
      nextVerifiedBy = null;
      nextVerifiedAt = null;
    }

    const { saveAsDraft: _d, forceApprove: _f, ...fieldUpdates } = updates;

    const [updatedEntry] = await db
      .update(entries)
      .set({
        ...fieldUpdates,
        status: nextStatus,
        verifiedBy: nextVerifiedBy,
        verifiedAt: nextVerifiedAt,
        updatedBy: userId,
        version: sql`${entries.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(entries.entryId, entryId))
      .returning();

    return updatedEntry;
  }

  /**
   * Transitions a private draft into pending_qa (team) or qa_approved (personal).
   */
  static async submitEntry(entryId: string, userId: string) {
    const existing = await this.getEntryById(entryId, userId);
    if (existing.createdBy !== userId) {
      throw new AppError(
        403,
        "Only the draft author can submit it",
        "FORBIDDEN",
      );
    }

    const { workspace } = await WorkspacesService.assertWorkspaceAccess(
      existing.workspaceId,
      userId,
      true,
    );

    const isPersonal = workspace.type === "personal";
    const nextStatus = isPersonal ? "qa_approved" : "pending_qa";

    const [updated] = await db
      .update(entries)
      .set({
        status: nextStatus,
        verifiedBy: isPersonal ? userId : null,
        verifiedAt: isPersonal ? new Date() : null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(entries.entryId, entryId))
      .returning();

    return updated;
  }

  /**
   * Approves a pending_qa entry; enforces four-eyes review unless owner overrides.
   */
  static async approveEntry(
    entryId: string,
    reviewerId: string,
    forceOverride = false,
  ) {
    const existing = await this.getEntryById(entryId, reviewerId);
    const { role } = await WorkspacesService.assertWorkspaceAccess(
      existing.workspaceId,
      reviewerId,
      true,
    );

    if (role !== "owner" && role !== "qa") {
      throw new AppError(
        403,
        "Only QA reviewers or owners can approve entries",
        "FORBIDDEN",
      );
    }

    if (
      existing.createdBy === reviewerId &&
      !(role === "owner" && forceOverride)
    ) {
      throw new AppError(
        403,
        "Peer review required: authors cannot self-approve without owner override",
        "SELF_APPROVAL_FORBIDDEN",
      );
    }

    const [approved] = await db
      .update(entries)
      .set({
        status: "qa_approved",
        verifiedBy: reviewerId,
        verifiedAt: new Date(),
        updatedBy: reviewerId,
        updatedAt: new Date(),
      })
      .where(eq(entries.entryId, entryId))
      .returning();

    return approved;
  }

  static async deleteEntry(entryId: string, userId: string) {
    const existing = await this.getEntryById(entryId, userId);
    const { role } = await WorkspacesService.assertWorkspaceAccess(
      existing.workspaceId,
      userId,
      true,
    );

    if (existing.createdBy !== userId && role !== "owner") {
      throw new AppError(
        403,
        "Only the author or workspace owner can delete",
        "FORBIDDEN",
      );
    }

    await db.delete(entries).where(eq(entries.entryId, entryId));
    return { deleted: true, entryId };
  }

  /**
   * Clones a visible entry into a destination workspace where the user is a member.
   */
  static async forkEntry(
    userId: string,
    sourceEntryId: string,
    destinationWorkspaceId: string,
  ) {
    const sourceEntry = await this.getEntryById(sourceEntryId, userId);
    const { workspace: targetWorkspace } =
      await WorkspacesService.assertWorkspaceAccess(
        destinationWorkspaceId,
        userId,
        true,
      );

    const isPersonal = targetWorkspace.type === "personal";

    const [forked] = await db
      .insert(entries)
      .values({
        workspaceId: destinationWorkspaceId,
        createdBy: userId,
        updatedBy: userId,
        type: sourceEntry.type,
        title: sourceEntry.title,
        description: sourceEntry.description,
        code: sourceEntry.code,
        language: sourceEntry.language,
        notes: sourceEntry.notes,
        gotchas: sourceEntry.gotchas,
        dosAndDonts: sourceEntry.dosAndDonts,
        targetRuntimes: sourceEntry.targetRuntimes,
        tags: sourceEntry.tags,
        status: isPersonal ? "qa_approved" : "draft",
        verifiedBy: isPersonal ? userId : null,
        verifiedAt: isPersonal ? new Date() : null,
        version: 1,
        forkedFromId: sourceEntry.entryId,
        forkedFromVersion: sourceEntry.version,
      })
      .returning();

    return forked;
  }
}
