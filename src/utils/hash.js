// ============================================================
// HASH SHA-256 — Génération d'identifiants stables pour les posts
// ============================================================

import crypto from 'crypto';

/**
 * Génère un hash SHA-256 tronqué à 16 caractères hex.
 * Utilisé comme fallback quand ni postId ni postUrl ne sont disponibles.
 */
export function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Génère un ID de document Firestore stable pour un post.
 * Priorité : postId > postUrl normalisée > hash(pageId + text + date)
 */
export function buildPostDocId(pageId, post) {
  if (post.postId) {
    return sha256(`fb_${pageId}_${post.postId}`).substring(0, 32);
  }
  if (post.postUrl) {
    return sha256(normalizeUrl(post.postUrl)).substring(0, 32);
  }
  const raw = `${pageId}|${(post.text || '').trim().substring(0, 200)}|${post.publishedAt || ''}`;
  return sha256(raw).substring(0, 32);
}

