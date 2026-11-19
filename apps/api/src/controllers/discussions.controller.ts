import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { DiscussionsService } from "../services/discussions.service.js";

export const DiscussionsController = {
  listByEntry: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const threads = await DiscussionsService.listThreadsByEntry(
      entryId,
      req.user?.id,
    );
    res.status(200).json({ threads });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { threadId } = req.params;
    const thread = await DiscussionsService.getThreadWithComments(
      threadId,
      req.user?.id,
    );
    res.status(200).json({ thread });
  }),

  createThread: asyncHandler(async (req: Request, res: Response) => {
    const thread = await DiscussionsService.createThread({
      ...req.body,
      authorId: req.user!.id,
    });
    res.status(201).json({ thread });
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const { threadId } = req.params;
    const comment = await DiscussionsService.addComment({
      ...req.body,
      threadId,
      authorId: req.user!.id,
    });
    res.status(201).json({ comment });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const { threadId } = req.params;
    const { status, resolutionSummary } = req.body;
    const thread = await DiscussionsService.resolveThread(
      threadId,
      req.user!.id,
      status,
      resolutionSummary,
    );
    res.status(200).json({ thread });
  }),
};
