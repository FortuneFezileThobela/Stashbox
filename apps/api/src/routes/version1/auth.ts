import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { AuthController } from '../../controllers/auth.controller.js';

export const authRouter = Router();

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().optional(),
});

authRouter.get('/me', requireAuth, AuthController.getMe);
authRouter.post('/tokens', requireAuth, validateBody(CreateTokenSchema), AuthController.createToken);
authRouter.delete('/tokens/:tokenId', requireAuth, AuthController.revokeToken);