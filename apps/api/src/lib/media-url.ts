/**
 * Rend les URLs média portables entre appareils.
 *
 * Les images sont stockées en base avec une URL absolue (ex.
 * `http://localhost:4000/uploads/media/2026/09/x.webp`) figée au moment de
 * l'import. Depuis un téléphone, une tablette ou la borne, « localhost » ne
 * désigne pas le serveur mais l'appareil lui-même : l'image ne charge pas.
 *
 * On réécrit donc, à la volée dans chaque réponse JSON, toute URL
 * `http(s)://<hôte>/uploads/...` en chemin relatif `/uploads/...`. Chaque
 * client le résout ensuite contre sa propre base :
 *  - web / borne : proxy Next `/uploads/*` -> API (même origine que le site) ;
 *  - appli mobile : `mediaUrl()` préfixe l'URL de l'API.
 */

const ABS_UPLOAD = /^https?:\/\/[^/]+(\/uploads\/[^\s"']*)$/i;

export function relativizeMedia(value: unknown): unknown {
  if (typeof value === 'string') {
    const m = value.match(ABS_UPLOAD);
    return m ? m[1] : value;
  }
  if (Array.isArray(value)) return value.map(relativizeMedia);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = relativizeMedia(v);
    }
    return out;
  }
  return value;
}
