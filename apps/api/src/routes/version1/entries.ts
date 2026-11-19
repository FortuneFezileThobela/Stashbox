import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { uuidParam } from "../../middleware/uuidParam.js";
import { EntriesController } from "../../controllers/entries.controller.js";

export const entriesRouter = Router();

entriesRouter.param("entryId", uuidParam);

const DoAndDontSchema = z.object({
  type: z.enum(["do", "dont"]),
  rule: z.string().min(1),
  explanation: z.string().default(""),
});

const ListEntriesQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  language: z.string().optional(),
  search: z.string().optional(),
  status: z
    .enum(["draft", "pending_qa", "qa_approved", "deprecated"])
    .optional(),
  tags: z
    .string()
    .transform((val) => val.split(",").filter(Boolean))
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const CreateEntrySchema = z.object({
  workspaceId: z.string().uuid(),
  type: z.enum(["snippet", "note"]).default("snippet"),
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  language: z.string().optional(),
  code: z.string().optional(),
  notes: z.string().default(""),
  gotchas: z.string().optional(),
  saveAsDraft: z.boolean().default(false),
  targetRuntimes: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  dosAndDonts: z.array(DoAndDontSchema).default([]),
});

const UpdateEntrySchema = CreateEntrySchema.partial()
  .omit({ workspaceId: true, type: true })
  .extend({ forceApprove: z.boolean().optional() });

const ForkEntrySchema = z.object({
  destinationWorkspaceId: z.string().uuid(),
});

entriesRouter.get(
  "/",
  requireAuth,
  validateQuery(ListEntriesQuerySchema),
  EntriesController.list,
);
entriesRouter.get("/:entryId", requireAuth, EntriesController.getById);
entriesRouter.post(
  "/",
  requireAuth,
  validateBody(CreateEntrySchema),
  EntriesController.create,
);
entriesRouter.patch(
  "/:entryId",
  requireAuth,
  validateBody(UpdateEntrySchema),
  EntriesController.update,
);
entriesRouter.delete("/:entryId", requireAuth, EntriesController.remove);
entriesRouter.post("/:entryId/submit", requireAuth, EntriesController.submit);
entriesRouter.post(
  "/:entryId/approve",
  requireAuth,
  validateBody(z.object({ forceOverride: z.boolean().default(false) })),
  EntriesController.approve,
);
entriesRouter.post(
  "/:entryId/fork",
  requireAuth,
  validateBody(ForkEntrySchema),
  EntriesController.fork,
);
