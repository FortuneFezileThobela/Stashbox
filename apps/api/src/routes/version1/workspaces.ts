import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { WorkspacesController } from "../../controllers/workspaces.controller.js";

export const workspacesRouter = Router();

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(255),
  handle: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  type: z.enum(["personal", "team"]).default("personal"),
  visibility: z.enum(["private", "public"]).default("private"),
  parentId: z.string().uuid().optional(),
});

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "qa", "member"]).default("member"),
});

const ForkWorkspaceSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  handle: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  visibility: z.enum(["private", "public"]).default("private"),
  destinationParentId: z.string().uuid().optional(),
  includeChildren: z.boolean().default(true),
});

const PublicQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
});

workspacesRouter.get("/", requireAuth, validateQuery(PaginationQuerySchema), WorkspacesController.list);
workspacesRouter.get("/public", validateQuery(PublicQuerySchema), WorkspacesController.explorePublic);
workspacesRouter.post("/", requireAuth, validateBody(CreateWorkspaceSchema), WorkspacesController.create);
workspacesRouter.patch("/:workspaceId/visibility", requireAuth, validateBody(z.object({ visibility: z.enum(["private", "public"]) })), WorkspacesController.updateVisibility);
workspacesRouter.get("/:workspaceId/members", requireAuth, validateQuery(PaginationQuerySchema), WorkspacesController.listMembers);
workspacesRouter.post("/:workspaceId/members", requireAuth, validateBody(AddMemberSchema), WorkspacesController.addMember);
workspacesRouter.patch("/:workspaceId/members/:userId", requireAuth, validateBody(z.object({ role: z.enum(["owner", "qa", "member"]) })), WorkspacesController.updateMemberRole);
workspacesRouter.delete("/:workspaceId/members/:userId", requireAuth, WorkspacesController.removeMember);
workspacesRouter.post("/:workspaceId/fork", requireAuth, validateBody(ForkWorkspaceSchema), WorkspacesController.fork);