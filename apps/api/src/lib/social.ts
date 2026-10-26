/**
 * Connexion sociale (Google, Apple) : vérification des jetons d'identité
 * (ID tokens OIDC) sans dépendance supplémentaire. Le navigateur obtient le
 * jeton auprès du fournisseur ; ici on contrôle sa signature (clés publiques
 * JWKS du fournisseur), son émetteur, son audience (notre identifiant client)
 * et son expiration.
 */
import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { badRequest } from './http.js';

export const googleEnabled = (): boolean => env.googleClientId.length > 0;
export const appleEnabled = (): boolean => env.appleClientId.length > 0;

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
}
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getKeys(url: string, force = false): Promise<Jwk[]> {
  const hit = jwksCache.get(url);
  if (!force && hit && Date.now() - hit.at < JWKS_TTL_MS) return hit.keys;
  const res = await fetch(url);
  if (!res.ok) throw badRequest('Impossible de vérifier la connexion (fournisseur injoignable)');
  const json = (await res.json()) as { keys?: Jwk[] };
  const keys = json.keys ?? [];
  jwksCache.set(url, { at: Date.now(), keys });
  return keys;
}

export interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
}

async function verifyIdToken(
  idToken: string,
  opts: { jwksUrl: string; issuers: string[]; audience: string },
): Promise<Record<string, unknown>> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  if (!kid) throw badRequest('Jeton de connexion invalide');

  let key = (await getKeys(opts.jwksUrl)).find((k) => k.kid === kid);
  // Le fournisseur a pu renouveler ses clés : un seul nouvel essai.
  if (!key) key = (await getKeys(opts.jwksUrl, true)).find((k) => k.kid === kid);
  if (!key) throw badRequest('Jeton de connexion invalide');

  const pem = createPublicKey({ key: key as never, format: 'jwk' }).export({
    type: 'spki',
    format: 'pem',
  });
  try {
    return jwt.verify(idToken, pem, {
      algorithms: ['RS256'],
      audience: opts.audience,
      issuer: opts.issuers as [string, ...string[]],
    }) as Record<string, unknown>;
  } catch {
    throw badRequest('Jeton de connexion invalide ou expiré');
  }
}

const isTrue = (v: unknown): boolean => v === true || v === 'true';

export async function verifyGoogle(credential: string): Promise<SocialProfile> {
  if (!googleEnabled()) throw badRequest('Connexion Google non configurée');
  const p = await verifyIdToken(credential, {
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.googleClientId,
  });
  const email = typeof p.email === 'string' ? p.email : '';
  if (!email || !isTrue(p.email_verified)) {
    throw badRequest("L'adresse e-mail de ce compte Google n'est pas vérifiée");
  }
  return {
    email,
    firstName: String(p.given_name ?? p.name ?? '').trim(),
    lastName: String(p.family_name ?? '').trim(),
  };
}

/** Apple ne renvoie le nom qu'à la toute première autorisation, et côté navigateur seulement. */
export async function verifyApple(
  idToken: string,
  name?: { firstName?: string; lastName?: string },
): Promise<SocialProfile> {
  if (!appleEnabled()) throw badRequest('Connexion Apple non configurée');
  const p = await verifyIdToken(idToken, {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    audience: env.appleClientId,
  });
  const email = typeof p.email === 'string' ? p.email : '';
  if (!email || !isTrue(p.email_verified)) {
    throw badRequest("Apple n'a pas fourni d'adresse e-mail vérifiée");
  }
  return {
    email,
    firstName: (name?.firstName ?? '').trim(),
    lastName: (name?.lastName ?? '').trim(),
  };
}
