/**
 * Stockage local des médias (images produits / contenus).
 * Les fichiers vivent dans `env.uploadsDir/media/AAAA/MM/`, servis via `/uploads/...`.
 * Chaque image importée est :
 *  - convertie en WebP (qualité 82), redimensionnée à 1600 px max sur le grand côté,
 *  - accompagnée d'une vignette 400 px (`<nom>.thumb.webp`).
 * Un `MediaAsset` est créé pour alimenter une bibliothèque réutilisable en admin.
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp, { type Metadata } from 'sharp';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest } from './http.js';

const MAX_EDGE = 1600;
const THUMB_EDGE = 400;
/** Formats reconnus par sharp qu'on accepte (détection sur les octets réels, pas le mimetype déclaré). */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'svg', 'heif']);

export interface StoredMedia {
  id: string;
  url: string;
  thumbUrl: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
}

export async function storeImage(
  file: { buffer: Buffer; mimetype?: string; originalname: string },
  opts: { createdBy?: string; source?: string } = {},
): Promise<StoredMedia> {
  let probe: Metadata;
  try {
    probe = await sharp(file.buffer, { animated: true }).metadata();
  } catch {
    throw badRequest(`Fichier image illisible (${file.originalname})`);
  }
  if (!probe.format || !ACCEPTED_FORMATS.has(probe.format)) {
    throw badRequest(`Format non supporté : ${probe.format ?? file.mimetype ?? 'inconnu'}`);
  }
  const now = new Date();
  const rel = path.posix.join(
    'media',
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
  );
  const dir = path.join(env.uploadsDir, rel);
  await mkdir(dir, { recursive: true });

  const base = nanoid(12);
  const animated = probe.format === 'gif' || (probe.pages ?? 1) > 1;

  const mainRel = path.posix.join(rel, `${base}.webp`);
  const thumbRel = path.posix.join(rel, `${base}.thumb.webp`);

  const mainBuf = await sharp(file.buffer, { animated })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(path.join(env.uploadsDir, mainRel), mainBuf);

  const thumbBuf = await sharp(file.buffer)
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  await writeFile(path.join(env.uploadsDir, thumbRel), thumbBuf);

  const dims = await sharp(mainBuf).metadata();
  const url = `${env.mediaBaseUrl}/${mainRel}`;
  const thumbUrl = `${env.mediaBaseUrl}/${thumbRel}`;

  const asset = await prisma.mediaAsset.create({
    data: {
      path: mainRel,
      url,
      kind: 'image',
      mime: 'image/webp',
      bytes: mainBuf.byteLength,
      width: dims.width ?? probe.width ?? null,
      height: dims.height ?? probe.height ?? null,
      source: opts.source ?? 'upload',
      createdBy: opts.createdBy ?? null,
    },
  });

  return {
    id: asset.id,
    url,
    thumbUrl,
    path: mainRel,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    bytes: asset.bytes,
    mime: asset.mime,
  };
}

const ID_DOC_MAX_EDGE = 2200;

/**
 * Stocke une copie de pièce d'identité dans le dossier PRIVÉ (jamais servi en
 * statique). Convertie en WebP, réduite. Pas de MediaAsset (donnée sensible).
 * Un seul fichier par utilisateur : `id/<userId>.webp` (écrase le précédent).
 */
export async function storeIdDocument(
  userId: string,
  file: { buffer: Buffer; mimetype?: string; originalname: string },
): Promise<{ path: string; mime: string; bytes: number }> {
  let probe: Metadata;
  try {
    probe = await sharp(file.buffer).metadata();
  } catch {
    throw badRequest('Image illisible — envoyez une photo nette de votre carte (JPEG ou PNG).');
  }
  if (!probe.format || !ACCEPTED_FORMATS.has(probe.format) || probe.format === 'svg') {
    throw badRequest(`Format non supporté : ${probe.format ?? 'inconnu'}`);
  }
  const rel = path.posix.join('id', `${userId}.webp`);
  const abs = path.join(env.privateDir, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  const buf = await sharp(file.buffer)
    .rotate()
    .resize({
      width: ID_DOC_MAX_EDGE,
      height: ID_DOC_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(abs, buf);
  return { path: rel, mime: 'image/webp', bytes: buf.byteLength };
}

/** Lit un fichier privé (pièce d'identité) pour le streamer via une route authentifiée. */
export async function readPrivateFile(relPath: string): Promise<Buffer | null> {
  // Anti-traversal : on n'accepte qu'un chemin relatif simple sous privateDir.
  const abs = path.join(env.privateDir, relPath);
  if (!abs.startsWith(path.join(env.privateDir, ''))) return null;
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

/** Supprime un fichier privé (RGPD : purge de la pièce d'identité). */
export async function deletePrivateFile(relPath: string): Promise<void> {
  const abs = path.join(env.privateDir, relPath);
  if (!abs.startsWith(path.join(env.privateDir, ''))) return;
  await rm(abs, { force: true });
}
