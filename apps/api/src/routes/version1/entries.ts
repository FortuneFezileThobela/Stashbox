import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { EntriesController } from '../../controllers/entries.controller.js';

export const entriesRouter = Router();

const ListEntriesQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  language: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().transform((val) => val.split(',')).optional(), // Optional comma-separated tags
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const CreateEntrySchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  language: z.string().min(1).default('typescript'),
  content: z.string().min(1),
});

const UpdateEntrySchema = CreateEntrySchema.partial().omit({ workspaceId: true });

entriesRouter.get('/', requireAuth, validateQuery(ListEntriesQuerySchema), EntriesController.list);
entriesRouter.get('/:entryId', requireAuth, EntriesController.getById);
entriesRouter.post('/', requireAuth, validateBody(CreateEntrySchema), EntriesController.create);
entriesRouter.patch('/:entryId', requireAuth, validateBody(UpdateEntrySchema), EntriesController.update);
entriesRouter.delete('/:entryId', requireAuth, EntriesController.remove);