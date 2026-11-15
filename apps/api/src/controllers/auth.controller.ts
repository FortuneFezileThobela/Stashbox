import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { AuthService } from "../services/auth.service.js";

export const AuthController = {
  getMe: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({ user: (req as any).user });
      } catch (error) {
        next(error);
      }
    },
  ),

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
    console.log("Registering user with data:", req.body);
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    console.log("Logging in user with email:", email);
    console.log("Password provided:", password);
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
};
