import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown) => new ApiError(400, 'BAD_REQUEST', m, d);
export const unauthorized = (m = 'Authentification requise') =>
  new ApiError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Acces refuse') => new ApiError(403, 'FORBIDDEN', m);
export const notFound = (m = 'Introuvable') => new ApiError(404, 'NOT_FOUND', m);
export const conflict = (m: string, d?: unknown) => new ApiError(409, 'CONFLICT', m, d);

/** Wrap async route handlers pour propager les erreurs. */
export function h(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Donnees invalides', details: err.flatten() },
    });
  }
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL', message: 'Erreur interne du serveur' } });
}
