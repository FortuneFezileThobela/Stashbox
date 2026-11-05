import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ProposalsService } from "../services/proposals.service.js";

export const ProposalsController = {
  listByEntry: asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const proposals = await ProposalsService.listByEntry(entryId);

    res.status(200).json({ entryId, proposals });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await ProposalsService.createProposal({
      ...req.body,
      authorId: req.user!.id,
    });

    res.status(201).json({ proposal });
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const { proposalId } = req.params;
    const result = await ProposalsService.approveProposal(
      proposalId,
      req.user!.id,
    );

    res.status(200).json(result);
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const { proposalId } = req.params;
    const result = await ProposalsService.rejectProposal(
      proposalId,
      req.user!.id,
    );

    res.status(200).json(result);
  }),
};
