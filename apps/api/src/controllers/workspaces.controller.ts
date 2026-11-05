import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { WorkspacesService } from "../services/workspaces.service.js";

export const WorkspacesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await WorkspacesService.listUserWorkspaces({
      userId: req.user!.id,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(result);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { name, handle, type, visibility, parentId } = req.body;
    const workspace = await WorkspacesService.createWorkspace({
      ownerId: req.user!.id,
      name,
      handle,
      type,
      visibility,
      parentId,
    });

    res.status(201).json({ workspace });
  }),

  addMember: asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { userId, role } = req.body;

    const membership = await WorkspacesService.addMember({
      workspaceId,
      requesterId: req.user!.id,
      targetUserId: userId,
      role,
    });

    res.status(201).json({ membership });
  }),

  fork: asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { name, handle, visibility, destinationParentId, includeChildren } =
      req.body;

    const forkedWorkspace = await WorkspacesService.forkWorkspace({
      sourceWorkspaceId: workspaceId,
      userId: req.user!.id,
      name,
      handle,
      visibility,
      destinationParentId,
      includeChildren,
    });

    res.status(201).json({ workspace: forkedWorkspace });
  }),
};
