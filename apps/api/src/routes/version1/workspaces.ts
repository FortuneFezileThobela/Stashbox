import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody,validateQuery } from '../../middleware/validate.js';
import { WorkspacesController } from '../../controllers/workspaces.controller.js';

export const workspacesRouter = Router();

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  isPublic: z.boolean().default(false),
});

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'maintainer', 'member']).default('member'),
});

workspacesRouter.get('/', requireAuth, WorkspacesController.list);
workspacesRouter.get('/', requireAuth, validateQuery(PaginationQuerySchema), WorkspacesController.list);
workspacesRouter.post('/:workspaceId/members', requireAuth, validateBody(AddMemberSchema), WorkspacesController.addMember);