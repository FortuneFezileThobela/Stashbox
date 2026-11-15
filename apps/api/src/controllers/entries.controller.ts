import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { EntriesService } from "../services/entries.service.js";

export const EntriesController = {
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const entry = await EntriesService.getEntryById(entryId);

    res.status(200).json({ entry });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const entry = await EntriesService.updateEntry(
      entryId,
      req.user!.id,
      req.body,
    );

    res.status(200).json({ entry });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const result = await EntriesService.deleteEntry(entryId, req.user!.id);

    res.status(200).json(result);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId, language, search, tags, page, limit } =
      req.query as any;

    const result = await EntriesService.listEntries(req.user?.id, {
      workspaceId,
      language,
      search,
      tags,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json(result);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const entry = await EntriesService.createEntry({
      ...req.body,
      createdById: req.user!.id,
    });

    res.status(201).json({ entry });
  }),

  fork: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const { destinationWorkspaceId } = req.body;

    const entry = await EntriesService.forkEntry(
      req.user!.id,
      entryId,
      destinationWorkspaceId,
    );

    res.status(201).json({ entry });
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
  const entry = await EntriesService.submitEntry(req.params.entryId, req.user!.id);
  res.status(200).json({ entry });
}),

approve: asyncHandler(async (req: Request, res: Response) => {
  const entry = await EntriesService.approveEntry(
    req.params.entryId,
    req.user!.id,
    Boolean(req.body?.forceOverride),
  );
  res.status(200).json({ entry });
}),
};
