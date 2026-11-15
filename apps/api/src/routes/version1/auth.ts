import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { AuthController } from "../../controllers/auth.controller.js";

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  fullName: z.string().min(2).max(255),
  password: z.string().min(8).max(128),
  jobTitle: z.string().max(100).optional(),
  organization: z.string().max(120).optional(),
  bio: z.string().max(500).optional(),
  primaryLanguages: z.array(z.string()).default([]),
  githubId: z.string().max(100).optional().or(z.literal("")),
  profileUrl: z.string().url().optional().or(z.literal("")),
});

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  organization: z.string().max(120).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  githubId: z.string().max(100).nullable().optional(),
  profileUrl: z.string().url().nullable().optional().or(z.literal("")),
  primaryLanguages: z.array(z.string()).optional(),
  themePreference: z.enum(["dark", "light"]).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const CreateTokenSchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().optional(),
});

authRouter.post("/register", validateBody(RegisterSchema), AuthController.register);
authRouter.post("/login", validateBody(LoginSchema), AuthController.login);
authRouter.get("/me", requireAuth, AuthController.getMe);
authRouter.patch("/me", requireAuth, validateBody(UpdateProfileSchema), AuthController.updateMe);
authRouter.post("/tokens", requireAuth, validateBody(CreateTokenSchema), AuthController.createToken);
authRouter.delete("/tokens/:tokenId", requireAuth, AuthController.revokeToken);