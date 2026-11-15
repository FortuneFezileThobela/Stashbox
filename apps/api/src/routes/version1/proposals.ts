import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ProposalsController } from "../../controllers/proposals.controller.js";

export const proposalsRouter = Router();

const CreateProposalSchema = z.object({
  targetWorkspaceId: z.string().uuid(),
  targetEntryId: z.string().uuid().optional(),
  sourceEntryId: z.string().uuid().optional(),
  entryType: z.enum(["snippet", "note"]).default("snippet"),
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  code: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().default(""),
  gotchas: z.string().optional(),
  targetRuntimes: z.array(z.string()).default([]),
  dosAndDonts: z
    .array(
      z.object({
        type: z.enum(["do", "dont"]),
        rule: z.string().min(1),
        explanation: z.string().default(""),
      })
    )
    .default([]),
});

proposalsRouter.get("/workspace/:workspaceId", requireAuth, ProposalsController.listByWorkspace);
proposalsRouter.get("/entry/:entryId", requireAuth, ProposalsController.listByEntry);
proposalsRouter.post("/", requireAuth, validateBody(CreateProposalSchema), ProposalsController.create);
proposalsRouter.post("/:proposalId/submit", requireAuth, ProposalsController.submit);
proposalsRouter.post("/:proposalId/approve", requireAuth, validateBody(z.object({ forceOverride: z.boolean().default(false) })), ProposalsController.approve);
proposalsRouter.post("/:proposalId/reject", requireAuth, validateBody(z.object({ reviewFeedback: z.string().optional() })), ProposalsController.reject);
proposalsRouter.post("/:proposalId/fork", requireAuth, validateBody(z.object({ destinationWorkspaceId: z.string().uuid() })), ProposalsController.fork);