import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AuthService } from "../services/auth.service.js";

export const AuthController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ user: req.user });
  }),

  createToken: asyncHandler(async (req: Request, res: Response) => {
    const { name, expiresInDays } = req.body;
    const tokenData = await AuthService.createToken({
      userId: req.user!.id,
      name,
      expiresInDays,
    });

    res.status(201).json(tokenData);
  }),

  revokeToken: asyncHandler(async (req: Request, res: Response) => {
    const { tokenId } = req.params;
    const result = await AuthService.revokeToken(req.user!.id, tokenId);

    res.status(200).json(result);
  }),
};
