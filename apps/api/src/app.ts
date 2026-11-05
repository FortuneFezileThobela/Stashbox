import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { version1Router } from './routes/version1/index.js';

export function createApp(): Express {
  const app = express();

  // Core Middleware
  app.use(cors());
  app.use(express.json());


  app.use('/api/version1', version1Router);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}

export const app = createApp();