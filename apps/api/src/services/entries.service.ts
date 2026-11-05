import crypto from "node:crypto";
import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import { entries } from "@stashbox/db/schema";
import { WorkspacesService } from "./workspaces.service.js";
import { eq, and, ilike, sql, arrayOverlaps } from "drizzle-orm";

export interface ListEntriesFilters {
  workspaceId: string;
  language?: string;
  search?: string;
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
  status?: "draft" | "pending_qa" | "qa_approved" | "deprecated";
  targetRuntimes?: string[];
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
}

export class EntriesService {
  /**
   * Retrieves a single snippet entry by ID
   */
  static async getEntryById(entryId: string) {
    if (!entryId) {
      throw new AppError(404, "Snippet entry not found", "entry_not_found");
    }

    const response = await db
      .select()
      .from(entries)
      .where(eq(entries.entryId, entryId))
      .limit(1);

    if (response.length === 0) {
      throw new AppError(404, "Snippet entry not found", "entry_not_found");
    }

    return response[0];
  }

  /**
   * Updates an entry and increments its version number
   */
  static async updateEntry(
    entryId: string,
    userId: string,
    updates: UpdateEntryParams,
  ) {
    const [updatedEntry] = await db
      .update(entries)
      .set({
        ...updates,
        updatedBy: userId,
        version: sql`${entries.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(entries.entryId, entryId))
      .returning();

    if (!updatedEntry) {
      throw new AppError(404, "Snippet entry not found", "ENTRY_NOT_FOUND");
    }

    return updatedEntry;
  }

  /**
   * Soft-deletes or removes a snippet entry
   */
  static async deleteEntry(entryId: string, userId: string) {
    const response = await db
      .delete(entries)
      .where(eq(entries.entryId, entryId))
      .returning({ id: entries.entryId });

    if (response.length === 0) {
      throw new AppError(404, "Snippet entry not found", "entry_not_found");
    }

    return { deleted: true, entryId };
  }

  ///

  static async listEntries(
    userId: string | undefined,
    filters: ListEntriesFilters,
  ) {
    await WorkspacesService.assertWorkspaceAccess(
      filters.workspaceId,
      userId,
      false,
    );

    const conditions = [eq(entries.workspaceId, filters.workspaceId)];

    if (filters.language) {
      conditions.push(eq(entries.language, filters.language));
    }

    if (filters.search) {
      conditions.push(ilike(entries.title, `%${filters.search}%`));
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(arrayOverlaps(entries.tags, filters.tags));
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20; // Cap max limit at 100
    const offset = (page - 1) * limit;

    //  Fetch total count for pagination metadata
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .where(and(...conditions));

    const total = Number(countResult?.count ?? 0);

    // Fetch paginated items
    const items = await db
      .select()
      .from(entries)
      .where(and(...conditions))
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
    await WorkspacesService.assertWorkspaceAccess(
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
        dosAndDonts: params.dosAndDonts ?? [],
        status: params.status ?? "draft",
        version: 1,
      })
      .returning();

    if (!entry) {
      throw new AppError(
        500,
        "Failed to create snippet entry",
        "INTERNAL_ERROR",
      );
    }

    return entry;
  }

  /**
   * Clones an entry from a public or accessible workspace into a target workspace
   */
  static async forkEntry(
    userId: string,
    sourceEntryId: string,
    destinationWorkspaceId: string,
  ) {
    const sourceEntry = await this.getEntryById(sourceEntryId);

    // Ensure user can read source workspace and write to destination workspace
    await WorkspacesService.assertWorkspaceAccess(
      sourceEntry.workspaceId,
      userId,
      false,
    );
    await WorkspacesService.assertWorkspaceAccess(
      destinationWorkspaceId,
      userId,
      true,
    );

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
        status: "draft",
        version: 1,
        forkedFromId: sourceEntry.entryId,
        forkedFromVersion: sourceEntry.version,
      })
      .returning();

    return forked;
  }
}
