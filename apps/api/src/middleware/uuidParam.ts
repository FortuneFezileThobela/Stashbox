import { z } from "zod";
import { AppError } from "./errorHandler.js";

const uuid = z.string().uuid();
export const uuidParam = (req: any, _res: any, next: any, value: string) =>
  uuid.safeParse(value).success
    ? next()
    : next(new AppError(400, "That link doesn't look right.", "BAD_REQUEST"));