import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { ProposalsController } from '../../controllers/proposals.controller.js';

export const proposalsRouter = Router();

const CreateProposalSchema = z.object({
  entryId: z.string().uuid(),
  proposedContent: z.string().min(1),
  rationale: z.string().min(1).max(500),
});

proposalsRouter.get('/entry/:entryId', requireAuth, ProposalsController.listByEntry);
proposalsRouter.post('/', requireAuth, validateBody(CreateProposalSchema), ProposalsController.create);
proposalsRouter.post('/:proposalId/approve', requireAuth, ProposalsController.approve);
proposalsRouter.post('/:proposalId/reject', requireAuth, ProposalsController.reject);