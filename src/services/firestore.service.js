// ============================================================
// SERVICE FIRESTORE — Toutes les opérations sur fb_pages et fb_posts
// Principe : idempotent, jamais de suppression des données existantes
// ============================================================

import { db }         from '../config/firebase.js';
import { CONFIG }     from '../config.js';
import { logger }     from '../utils/logger.js';
import { buildPostDocId } from '../utils/hash.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const COL = CONFIG.collections;

// ─── PAGES ───────────────────────────────────────────────────

/**
 * Récupère toutes les pages actives (active === true).
 * @returns {Array<{id: string, data: object}>}
 */
export async function getActivePages() {
  const snap = await db.collection(COL.pages)
    .where('active', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

/**
 * Met à jour les métadonnées d'une page après traitement.
 */
export async function updatePageAfterScrape(pageId, { success, error }) {
  const now = Timestamp.now();
  const update = {
    lastScrapedAt: now,
    updatedAt: now,
  };
  if (success) {
    update.lastSuccessAt = now;
    update.lastError = null;
    update.lastErrorAt = null;
  } else {
    update.lastErrorAt = now;
    update.lastError = String(error || 'Unknown error').substring(0, 500);
  }
  await db.collection(COL.pages).doc(pageId).update(update);
}

// ─── POSTS ───────────────────────────────────────────────────

/**
 * Vérifie si un post existe déjà dans Firestore.
 * @returns {boolean}
 */
export async function postExists(pageId, post) {
  const docId = buildPostDocId(pageId, post);
  const snap = await db.collection(COL.posts).doc(docId).get();
  return snap.exists;
}

/**
 * Vérifie en batch si plusieurs posts existent déjà.
 * Retourne un Set des docIds existants.
 */
export async function getExistingPostIds(pageId, posts) {
  if (!posts.length) return new Set();
  const docIds = posts.map(p => buildPostDocId(pageId, p));
  // Firestore getAll : max 500 docs par appel
  const refs = docIds.map(id => db.collection(COL.posts).doc(id));
  const snaps = await db.getAll(...refs);
  return new Set(snaps.filter(s => s.exists).map(s => s.id));
}

/**
 * Enregistre un nouveau post de manière idempotente (set avec merge).
 * @returns {string} docId
 */
export async function savePost(pageId, pageName, post) {
  const docId = buildPostDocId(pageId, post);
  const now   = Timestamp.now();

  const data = {
    postId:      post.postId      ?? null,
    pageId,
    pageName,
    text:        post.text        ?? null,
    publishedAt: post.publishedAt ? Timestamp.fromDate(new Date(post.publishedAt)) : null,
    postUrl:     post.postUrl     ?? null,
    imageUrl:    post.imageUrl    ?? null,
    imageUrls:   post.imageUrls   ?? [],
    scrapedAt:   now,
    createdAt:   now,
  };

  // set avec merge=false : si le doc existe déjà, on ne l'écrase pas
  const ref = db.collection(COL.posts).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(data);
    logger.debug(`Post sauvegardé: ${docId}`);
  } else {
    logger.debug(`Post déjà existant, ignoré: ${docId}`);
  }
  return docId;
}

/**
 * Récupère l'ID du post le plus récent connu pour une page.
 * Utilisé pour détecter la limite de collecte.
 */
export async function getLatestKnownPost(pageId) {
  const snap = await db.collection(COL.posts)
    .where('pageId', '==', pageId)
    .get();
  if (snap.empty) return null;
  const sorted = snap.docs.sort((a, b) =>
    (b.data().scrapedAt?.toMillis() ?? 0) - (a.data().scrapedAt?.toMillis() ?? 0)
  );
  return sorted[0].data();
}

// ─── NETTOYAGE ───────────────────────────────────────────────

/**
 * Supprime les posts d'une page qui dépassent les limites configurées :
 * - Plus anciens que retentionDays jours
 * - En surplus si plus de maxPostsPerPage posts
 * Opération sécurisée et idempotente.
 * @returns {number} Nombre de posts supprimés
 */
export async function cleanupOldPosts(pageId) {
  const { maxPostsPerPage, retentionDays } = CONFIG;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTs = Timestamp.fromDate(cutoffDate);

  // Récupérer les posts de la page et trier en mémoire (évite un index composite Firestore)
  const snap = await db.collection(COL.posts)
    .where('pageId', '==', pageId)
    .get();

  const sortedDocs = [...snap.docs].sort((a, b) =>
    (b.data().scrapedAt?.toMillis() ?? 0) - (a.data().scrapedAt?.toMillis() ?? 0)
  );

  const toDelete = [];
  sortedDocs.forEach((doc, index) => {
    const data = doc.data();
    const isOld = data.scrapedAt && data.scrapedAt.toMillis() < cutoffTs.toMillis();
    const isExcess = index >= maxPostsPerPage;
    if (isOld || isExcess) {
      toDelete.push(doc.ref);
    }
  });

  if (!toDelete.length) return 0;

  // Supprimer par lots de 500 (limite Firestore)
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toDelete.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  logger.info(`Nettoyage page ${pageId}: ${toDelete.length} posts supprimés`);
  return toDelete.length;
}

// ─── RUNS ────────────────────────────────────────────────────

/**
 * Crée un document de run en début d'exécution.
 * @returns {string} runId
 */
export async function createRun() {
  const ref = db.collection(COL.runs).doc();
  await ref.set({
    startedAt:    Timestamp.now(),
    completedAt:  null,
    status:       'running',
    pagesTotal:   0,
    pagesSuccess: 0,
    pagesError:   0,
    newPostsTotal:    0,
    deletedPostsTotal: 0,
  });
  return ref.id;
}

/**
 * Met à jour le document de run en fin d'exécution.
 */
export async function finalizeRun(runId, stats) {
  await db.collection(COL.runs).doc(runId).update({
    completedAt:       Timestamp.now(),
    status:            stats.pagesError === 0 ? 'success' : (stats.pagesSuccess > 0 ? 'partial' : 'failed'),
    pagesTotal:        stats.pagesTotal,
    pagesSuccess:      stats.pagesSuccess,
    pagesError:        stats.pagesError,
    newPostsTotal:     stats.newPostsTotal,
    deletedPostsTotal: stats.deletedPostsTotal,
  });
}

