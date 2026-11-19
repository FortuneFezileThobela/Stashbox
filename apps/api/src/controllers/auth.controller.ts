import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AuthService } from "../services/auth.service.js";
import { hashApiToken } from "../middleware/auth.js";

export const AuthController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.getProfile(req.user!.id);
    res.status(200).json({ user });
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

 register: asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  }),

 login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await AuthService.login({ email, password });
    res.status(200).json(result);
  }),


  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.updateProfile(req.user!.id, req.body);
    res.status(200).json({ user });
  }),

  revokeToken: asyncHandler(async (req: Request, res: Response) => {
    const { tokenId } = req.params;
    const result = await AuthService.revokeToken(req.user!.id, tokenId);

    res.status(200).json(result);
  }),

  listTokens: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const tokens = await AuthService.listTokens(req.user!.id, raw ? hashApiToken(raw) : undefined);
    res.status(200).json({ tokens });
  }),

};
