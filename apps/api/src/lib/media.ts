/**
 * Stockage local des médias (images produits / contenus).
 * Les fichiers vivent dans `env.uploadsDir/media/AAAA/MM/`, servis via `/uploads/...`.
 * Chaque image importée est :
 *  - convertie en WebP (qualité 82), redimensionnée à 1600 px max sur le grand côté,
 *  - accompagnée d'une vignette 400 px (`<nom>.thumb.webp`).
 * Un `MediaAsset` est créé pour alimenter une bibliothèque réutilisable en admin.
 */
import { mkdir, writeFile } from 'node:fs/promises';
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
