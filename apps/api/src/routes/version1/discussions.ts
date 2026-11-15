import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { DiscussionsController } from "../../controllers/discussions.controller.js";

export const discussionsRouter = Router();

const CreateThreadSchema = z.object({
  entryId: z.string().uuid(),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
});

const CreateCommentSchema = z.object({
  content: z.string().min(1),
  codeBlock: z.string().optional(),
  codeLanguage: z.string().optional(),
  isSuggestion: z.boolean().default(false),
});

const ResolveThreadSchema = z.object({
  status: z.enum(["resolved", "closed", "open"]),
  resolutionSummary: z.string().optional(),
});

discussionsRouter.get(
  "/entry/:entryId",
  requireAuth,
  DiscussionsController.listByEntry,
);
discussionsRouter.get("/:threadId", requireAuth, DiscussionsController.getById);
discussionsRouter.post(
  "/",
  requireAuth,
  validateBody(CreateThreadSchema),
  DiscussionsController.createThread,
);
discussionsRouter.post(
  "/:threadId/comments",
  requireAuth,
  validateBody(CreateCommentSchema),
  DiscussionsController.addComment,
);
discussionsRouter.patch(
  "/:threadId/status",
  requireAuth,
  validateBody(ResolveThreadSchema),
  DiscussionsController.updateStatus,
);