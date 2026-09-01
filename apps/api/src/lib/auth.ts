import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StaffRole } from '@bricoloc/shared';
import { env } from '../env.js';
import { forbidden, unauthorized } from './http.js';

export type Principal =
  | { kind: 'user'; id: string; email: string }
  | { kind: 'staff'; id: string; email: string; role: StaffRole };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function signToken(p: Principal): string {
  return jwt.sign(p, env.jwtSecret, { expiresIn: '30d' });
}

export function readToken(req: Request): Principal | null {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token =
    bearer ??
    (req.headers['x-bricoloc-token'] as string | undefined) ??
    (typeof req.query?.token === 'string' ? req.query.token : undefined) ??
    null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as Principal;
    return decoded;
  } catch {
    return null;
  }
}

/** Attache req.principal si un token valide est present (n'echoue pas sinon). */
export function attachPrincipal(req: Request, _res: Response, next: NextFunction) {
  const p = readToken(req);
  if (p) req.principal = p;
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.principal || req.principal.kind !== 'user') return next(unauthorized());
  next();
}

export function requireStaff(...roles: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const p = req.principal;
    if (!p || p.kind !== 'staff') return next(unauthorized('Connexion equipe requise'));
    if (roles.length && !roles.includes(p.role) && p.role !== 'ADMIN') {
      return next(forbidden('Role insuffisant pour cette action'));
    }
    next();
  };
}
