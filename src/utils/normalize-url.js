// ============================================================
// NORMALISATION DES URL FACEBOOK
// ============================================================

/**
 * Normalise une URL Facebook pour comparaison stable.
 * Conserve les paramètres identifiants (id, story_fbid, fbid, v)
 * et supprime les paramètres de tracking (__cft__, __tn__, etc.).
 */
export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const cleanParams = new URLSearchParams();
    for (const key of ['story_fbid', 'id', 'fbid', 'v']) {
      if (u.searchParams.has(key)) {
        cleanParams.set(key, u.searchParams.get(key));
      }
    }
    const qs = cleanParams.toString();
    return `${u.origin}${u.pathname}${qs ? '?' + qs : ''}`;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Extrait l'ID Facebook d'une URL de post si disponible.
 */
export function extractPostId(url) {
  if (!url) return null;
  const patterns = [
    /\/posts\/(pfbid[A-Za-z0-9]+|\d+)/,
    /\/permalink\/(\d+)/,
    /story_fbid=(pfbid[A-Za-z0-9]+|\d+)/,
    /\/reel\/(\d+)/,
    /\/videos\/(\d+)/,
    /\/(pfbid[A-Za-z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
