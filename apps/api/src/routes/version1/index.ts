import { Router } from "express";
import { authRouter } from "./auth.js";
import { workspacesRouter } from "./workspaces.js";
import { entriesRouter } from "./entries.js";
import { proposalsRouter } from "./proposals.js";
import { discussionsRouter } from "./discussions.js";

export const version1Router = Router();

version1Router.use("/auth", authRouter);
version1Router.use("/workspaces", workspacesRouter);
version1Router.use("/entries", entriesRouter);
version1Router.use("/proposals", proposalsRouter);
version1Router.use("/discussions", discussionsRouter);
