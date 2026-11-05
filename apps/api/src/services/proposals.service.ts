import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';
import { db } from "@stashbox/db";
import { entryProposals, entries } from "@stashbox/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

export interface CreateProposalParams {
  targetWorkspaceId: string;
  targetEntryId?: string;
  sourceEntryId?: string;
  entryType?: "snippet" | "note";
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
  
  /**
   * Rejects a proposal without mutating the parent snippet entry
   */
 static async rejectProposal(
  proposalId: string,
  reviewerId: string,
) {
  const proposal = await db
    .update(entryProposals)
    .set({
      status: "rejected",
      reviewedBy: reviewerId,
      updatedAt: new Date(),
    })
    .where(eq(entryProposals.proposalId, proposalId))
    .returning();

  if (proposal.length === 0) {
    throw new AppError(
      404,
      "Proposal not found",
      "PROPOSAL_NOT_FOUND",
    );
  }

  return proposal[0];
}


static async listByEntry(entryId: string, page = 1, limit = 20) {
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entryProposals)
      .where(eq(entryProposals.targetEntryId, entryId));

    const total = Number(countResult?.count ?? 0);

    const proposals = await db
      .select()
      .from(entryProposals)
      .where(eq(entryProposals.targetEntryId, entryId))
      .limit(validLimit)
      .offset(offset);

    return {
      entryId,
      proposals,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }
  
  static async createProposal(params: CreateProposalParams) {
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

  static async approveProposal(proposalId: string, reviewerId: string) {
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(entryProposals)
        .where(eq(entryProposals.proposalId, proposalId))
        .limit(1);

      if (!p) {
        throw new AppError(404, "Proposal not found", "PROPOSAL_NOT_FOUND");
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
        throw new AppError(400, "Update proposal missing targetEntryId", "INVALID_PROPOSAL");
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
}