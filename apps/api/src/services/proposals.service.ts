import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import { entryProposals, entries, users } from "@stashbox/db/schema";
import { WorkspacesService } from "./workspaces.service.js";
import { eq, and, sql, desc, or, ne } from "drizzle-orm";

export interface CreateProposalParams {
  targetWorkspaceId: string;
  targetEntryId?: string;
  sourceEntryId?: string;
  entryType?: "snippet" | "note";
  status?: "draft" | "pending";
  authorId: string;
  title: string;
  description: string;
  code?: string;
  language?: string;
  notes: string;
  gotchas?: string;
  dosAndDonts?: {
    type: "do" | "dont";
    rule: string;
    explanation: string;
  }[];
  targetRuntimes?: string[];
}

export class ProposalsService {
  static async listByWorkspace(
    workspaceId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    await WorkspacesService.assertWorkspaceAccess(workspaceId, userId, false);

    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    // Draft proposals are strictly private to their author
    const where = and(
      eq(entryProposals.targetWorkspaceId, workspaceId),
      or(
        ne(entryProposals.status, "draft"),
        eq(entryProposals.authorId, userId),
      ),
    );

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entryProposals)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select({
        proposal: entryProposals,
        author: {
          userId: users.userId,
          username: users.username,
          fullName: users.fullName,
          jobTitle: users.jobTitle,
          profileUrl: users.profileUrl,
        },
        originalEntry: entries,
      })
      .from(entryProposals)
      .innerJoin(users, eq(entryProposals.authorId, users.userId))
      .leftJoin(entries, eq(entryProposals.targetEntryId, entries.entryId))
      .where(where)
      .orderBy(desc(entryProposals.createdAt))
      .limit(validLimit)
      .offset(offset);

    return {
      proposals: rows.map(({ proposal, author, originalEntry }) => ({
        ...proposal,
        author,
        originalEntry,
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  static async listByEntry(
    entryId: string,
    userId?: string,
    page = 1,
    limit = 20,
  ) {
    const [targetEntry] = await db
      .select({ workspaceId: entries.workspaceId })
      .from(entries)
      .where(eq(entries.entryId, entryId))
      .limit(1);

    if (!targetEntry) {
      throw new AppError(404, "Entry not found", "ENTRY_NOT_FOUND");
    }

    await WorkspacesService.assertWorkspaceAccess(
      targetEntry.workspaceId,
      userId,
      false,
    );

    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    const visibilityFilter = userId
      ? or(
          ne(entryProposals.status, "draft"),
          eq(entryProposals.authorId, userId),
        )
      : ne(entryProposals.status, "draft");

    const where = and(
      eq(entryProposals.targetEntryId, entryId),
      visibilityFilter,
    );

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entryProposals)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select({
        proposal: entryProposals,
        author: {
          userId: users.userId,
          username: users.username,
          fullName: users.fullName,
          jobTitle: users.jobTitle,
          profileUrl: users.profileUrl,
        },
        originalEntry: entries,
      })
      .from(entryProposals)
      .innerJoin(users, eq(entryProposals.authorId, users.userId))
      .leftJoin(entries, eq(entryProposals.targetEntryId, entries.entryId))
      .where(where)
      .orderBy(desc(entryProposals.createdAt))
      .limit(validLimit)
      .offset(offset);

    return {
      entryId,
      proposals: rows.map(({ proposal, author, originalEntry }) => ({
        ...proposal,
        author,
        originalEntry,
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  static async createProposal(params: CreateProposalParams) {
    // Allow any user who can read the target workspace (including public) to propose
    await WorkspacesService.assertWorkspaceAccess(
      params.targetWorkspaceId,
      params.authorId,
      false,
    );

    const entryType = params.entryType ?? "snippet";

    if (entryType === "snippet" && (!params.code || !params.language)) {
      throw new AppError(
        400,
        "Snippet proposals require code and language",
        "INVALID_PROPOSAL_SHAPE",
      );
    }

    if (params.targetEntryId) {
      const [entry] = await db
        .select({ id: entries.entryId })
        .from(entries)
        .where(eq(entries.entryId, params.targetEntryId))
        .limit(1);

      if (!entry) {
        throw new AppError(404, "Target entry not found", "ENTRY_NOT_FOUND");
      }
    }

    const proposalType = params.targetEntryId ? "update_entry" : "new_entry";

    const [proposal] = await db
      .insert(entryProposals)
      .values({
        targetWorkspaceId: params.targetWorkspaceId,
        targetEntryId: params.targetEntryId,
        sourceEntryId: params.sourceEntryId,
        type: proposalType,
        entryType,
        status: params.status ?? "pending",
        title: params.title,
        description: params.description,
        code: params.code,
        language: params.language,
        notes: params.notes,
        gotchas: params.gotchas,
        dosAndDonts: params.dosAndDonts ?? [],
        targetRuntimes: params.targetRuntimes ?? [],
        authorId: params.authorId,
      })
      .returning();

    return proposal;
  }

  /**
   * Transitions a private draft proposal into 'pending' for QA review.
   */
  static async submitProposal(proposalId: string, authorId: string) {
    const [proposal] = await db
      .select()
      .from(entryProposals)
      .where(eq(entryProposals.proposalId, proposalId))
      .limit(1);

    if (
      !proposal ||
      (proposal.status === "draft" && proposal.authorId !== authorId)
    ) {
      throw new AppError(404, "Proposal not found", "PROPOSAL_NOT_FOUND");
    }
    if (proposal.authorId !== authorId) {
      throw new AppError(
        403,
        "Only the proposal author can submit it",
        "FORBIDDEN",
      );
    }
    if (proposal.status !== "draft") {
      throw new AppError(
        400,
        `Cannot submit proposal in ${proposal.status} state`,
        "INVALID_PROPOSAL_STATE",
      );
    }

    const [updated] = await db
      .update(entryProposals)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(entryProposals.proposalId, proposalId))
      .returning();

    return updated;
  }

  static async approveProposal(
    proposalId: string,
    reviewerId: string,
    forceOverride = false,
  ) {
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(entryProposals)
        .where(eq(entryProposals.proposalId, proposalId))
        .limit(1);

      if (!p) {
        throw new AppError(404, "Proposal not found", "PROPOSAL_NOT_FOUND");
      }

      const { role } = await WorkspacesService.assertWorkspaceAccess(
        p.targetWorkspaceId,
        reviewerId,
        true,
      );

      if (role !== "owner" && role !== "qa") {
        throw new AppError(
          403,
          "Only QA reviewers or owners can approve proposals",
          "FORBIDDEN",
        );
      }

      if (p.authorId === reviewerId && !(role === "owner" && forceOverride)) {
        throw new AppError(
          403,
          "Authors cannot self-approve proposals without owner override",
          "SELF_APPROVAL_FORBIDDEN",
        );
      }

      if (p.status !== "pending") {
        throw new AppError(
          400,
          `Proposal is already ${p.status}`,
          "INVALID_PROPOSAL_STATE",
        );
      }

      await tx
        .update(entryProposals)
        .set({
          status: "approved",
          reviewedBy: reviewerId,
          updatedAt: new Date(),
        })
        .where(eq(entryProposals.proposalId, proposalId));

      if (p.type === "new_entry") {
        const [createdEntry] = await tx
          .insert(entries)
          .values({
            workspaceId: p.targetWorkspaceId,
            type: p.entryType,
            title: p.title,
            description: p.description,
            code: p.code,
            language: p.language,
            notes: p.notes,
            gotchas: p.gotchas,
            dosAndDonts: p.dosAndDonts,
            targetRuntimes: p.targetRuntimes,
            status: "qa_approved",
            version: 1,
            verifiedBy: reviewerId,
            verifiedAt: new Date(),
            forkedFromId: p.sourceEntryId,
            createdBy: p.authorId,
            updatedBy: reviewerId,
          })
          .returning();

        return { proposalId, status: "approved", entry: createdEntry };
      }

      if (!p.targetEntryId) {
        throw new AppError(
          400,
          "Update proposal missing targetEntryId",
          "INVALID_PROPOSAL",
        );
      }

      const [updatedEntry] = await tx
        .update(entries)
        .set({
          title: p.title,
          description: p.description,
          code: p.code,
          language: p.language,
          notes: p.notes,
          gotchas: p.gotchas,
          dosAndDonts: p.dosAndDonts,
          targetRuntimes: p.targetRuntimes,
          status: "qa_approved",
          verifiedBy: reviewerId,
          verifiedAt: new Date(),
          updatedBy: reviewerId,
          version: sql`${entries.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(entries.entryId, p.targetEntryId))
        .returning();

      return { proposalId, status: "approved", entry: updatedEntry };
    });
  }

  static async rejectProposal(
    proposalId: string,
    reviewerId: string,
    reviewFeedback?: string,
  ) {
    const [existing] = await db
      .select()
      .from(entryProposals)
      .where(eq(entryProposals.proposalId, proposalId))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "Proposal not found", "PROPOSAL_NOT_FOUND");
    }

    const { role } = await WorkspacesService.assertWorkspaceAccess(
      existing.targetWorkspaceId,
      reviewerId,
      true,
    );

    if (role !== "owner" && role !== "qa") {
      throw new AppError(
        403,
        "Only QA reviewers or owners can reject proposals",
        "FORBIDDEN",
      );
    }

    const [updated] = await db
      .update(entryProposals)
      .set({
        status: "rejected",
        reviewedBy: reviewerId,
        reviewFeedback: reviewFeedback ?? existing.reviewFeedback,
        updatedAt: new Date(),
      })
      .where(eq(entryProposals.proposalId, proposalId))
      .returning();

    return updated;
  }

  /**
   * Clones a visible proposal into a user's own workspace as a standalone entry.
   */
  static async forkProposalIntoWorkspace(
    proposalId: string,
    destinationWorkspaceId: string,
    userId: string,
  ) {
    const [proposal] = await db
      .select()
      .from(entryProposals)
      .where(eq(entryProposals.proposalId, proposalId))
      .limit(1);

    if (
      !proposal ||
      (proposal.status === "draft" && proposal.authorId !== userId)
    ) {
      throw new AppError(404, "Proposal not found", "PROPOSAL_NOT_FOUND");
    }

    await WorkspacesService.assertWorkspaceAccess(
      proposal.targetWorkspaceId,
      userId,
      false,
    );

    const { workspace: targetWorkspace } =
      await WorkspacesService.assertWorkspaceAccess(
        destinationWorkspaceId,
        userId,
        true,
      );

    const originEntryId =
      proposal.sourceEntryId ?? proposal.targetEntryId ?? null;
    const isPersonal = targetWorkspace.type === "personal";

    const [forkedEntry] = await db
      .insert(entries)
      .values({
        workspaceId: destinationWorkspaceId,
        type: proposal.entryType,
        title: proposal.title,
        description: proposal.description,
        code: proposal.code,
        language: proposal.language,
        notes: proposal.notes,
        gotchas: proposal.gotchas,
        dosAndDonts: proposal.dosAndDonts,
        targetRuntimes: proposal.targetRuntimes,
        tags: [],
        status: isPersonal ? "qa_approved" : "draft",
        version: 1,
        verifiedBy: isPersonal ? userId : null,
        verifiedAt: isPersonal ? new Date() : null,
        forkedFromId: originEntryId,
        forkedFromVersion: originEntryId ? 1 : null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return forkedEntry;
  }
}
