// ============================================================
// NORMALISATION DES URL FACEBOOK
// ============================================================

/**
 * Normalise une URL Facebook pour comparaison stable.
 * Supprime les paramètres de tracking (?__cft__, ?__tn__, etc.)
 * et les ancres.
 */
export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Garder uniquement pathname + paramètre id si présent (profils)
    const cleanParams = new URLSearchParams();
    if (u.searchParams.has('id')) {
      cleanParams.set('id', u.searchParams.get('id'));
    }
    const qs = cleanParams.toString();
    return `${u.origin}${u.pathname}${qs ? '?' + qs : ''}`.toLowerCase();
  } catch {
    return url.split('?')[0].split('#')[0].toLowerCase();
  }
}

/**
 * Extrait l'ID numérique Facebook d'une URL de post si disponible.
 * Ex: /permalink/123456 → "123456"
 *     /posts/123456     → "123456"
 */
export function extractPostId(url) {
  if (!url) return null;
  const patterns = [
    /\/posts\/(\d+)/,
    /\/permalink\/(\d+)/,
    /story_fbid=(\d+)/,
    /\/pfbid([A-Za-z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

