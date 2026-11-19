import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ProposalsService } from "../services/proposals.service.js";

export const ProposalsController = {
  listByEntry: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await ProposalsService.listByEntry(
      req.params.entryId,
      req.user!.id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
    res.status(200).json(result);
  }),

  listByWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await ProposalsService.listByWorkspace(
      req.params.workspaceId,
      req.user!.id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
    res.status(200).json(result);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await ProposalsService.createProposal({
      ...req.body,
      authorId: req.user!.id,
    });

    res.status(201).json({ proposal });
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await ProposalsService.submitProposal(
      req.params.proposalId,
      req.user!.id,
    );
    res.status(200).json({ proposal });
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const { proposalId } = req.params;
    const result = await ProposalsService.approveProposal(
      proposalId,
      req.user!.id,
      Boolean(req.body?.forceOverride),
    );

    res.status(200).json(result);
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const { proposalId } = req.params;
    const result = await ProposalsService.rejectProposal(
      proposalId,
      req.user!.id,
      req.body?.reviewFeedback,
    );

    res.status(200).json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await ProposalsService.getProposalById(
      req.params.proposalId,
      req.user!.id,
    );
    res.status(200).json({ proposal });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const proposal = await ProposalsService.updateDraftProposal(
      req.params.proposalId,
      req.user!.id,
      req.body,
    );
    res.status(200).json({ proposal });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await ProposalsService.deleteDraftProposal(
      req.params.proposalId,
      req.user!.id,
    );
    res.status(200).json(result);
  }),

  fork: asyncHandler(async (req: Request, res: Response) => {
    const entry = await ProposalsService.forkProposalIntoWorkspace(
      req.params.proposalId,
      req.body.destinationWorkspaceId,
      req.user!.id,
    );
    res.status(201).json({ entry });
  }),
};
