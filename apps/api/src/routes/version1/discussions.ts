import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { uuidParam } from "../../middleware/uuidParam.js";
import { DiscussionsController } from "../../controllers/discussions.controller.js";

export const discussionsRouter = Router();

discussionsRouter.param("threadId", uuidParam);
discussionsRouter.param("entryId", uuidParam);

const CreateThreadSchema = z
  .object({
    entryId: z.string().uuid(),
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(10_000),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
  })
  .refine((v) => (v.lineStart === undefined) === (v.lineEnd === undefined), {
    message: "Give both a first and a last line.",
  });

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(10_000),
  codeBlock: z.string().max(50_000).optional(),
  codeLanguage: z.string().max(100).optional(),
  isSuggestion: z.boolean().default(false),
});

const ResolveThreadSchema = z.object({
  status: z.enum(["resolved", "closed", "open"]),
  resolutionSummary: z.string().max(2_000).optional(),
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
