import { Router } from 'express';
import { loginSchema, registerSchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, conflict, h, unauthorized } from '../lib/http.js';
import {
  attachPrincipal,
  hashPassword,
  requireStaff,
  requireUser,
  signToken,
  verifyPassword,
} from '../lib/auth.js';

export const authRouter = Router();

function publicUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  customerType: string;
  companyName: string | null;
  vatNumber: string | null;
}) {
  return u;
}

authRouter.post(
  '/register',
  h(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) throw conflict('Un compte existe deja avec cet e-mail');
    if (data.customerType === 'PRO' && !data.companyName) {
      throw badRequest('Le nom de la societe est requis pour un compte professionnel');
    }
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        customerType: data.customerType,
        companyName: data.companyName ?? null,
        vatNumber: data.vatNumber ?? null,
      },
    });
    const token = signToken({ kind: 'user', id: user.id, email: user.email });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw unauthorized('E-mail ou mot de passe incorrect');
    }
    const token = signToken({ kind: 'user', id: user.id, email: user.email });
    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  attachPrincipal,
  requireUser,
  h(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.principal!.id } });
    if (!user) throw unauthorized();
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/staff/login',
  h(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const staff = await prisma.staffUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (!staff || !staff.active || !(await verifyPassword(data.password, staff.passwordHash))) {
      throw unauthorized('Identifiants equipe incorrects');
    }
    const token = signToken({
      kind: 'staff',
      id: staff.id,
      email: staff.email,
      role: staff.role as never,
    });
    res.json({
      token,
      staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    });
  }),
);

authRouter.get(
  '/staff/me',
  attachPrincipal,
  requireStaff(),
  h(async (req, res) => {
    const staff = await prisma.staffUser.findUnique({ where: { id: req.principal!.id } });
    if (!staff) throw unauthorized();
    res.json({
      staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    });
  }),
);
