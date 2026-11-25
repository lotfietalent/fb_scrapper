// ============================================================
// SERVICE DE MAINTENANCE — Nettoyage automatique des anciens posts
// ============================================================

import { cleanupOldPosts } from '../services/firestore.service.js';
import { logger }          from '../utils/logger.js';

/**
 * Lance le nettoyage pour une liste de pages.
 * @param {Array<{id: string, data: object}>} pages
 * @returns {number} Total des posts supprimés
 */
export async function runCleanup(pages) {
  let totalDeleted = 0;

  for (const page of pages) {
    try {
      const deleted = await cleanupOldPosts(page.id);
      totalDeleted += deleted;
    } catch (err) {
      // Une erreur de nettoyage ne bloque pas les autres pages
      logger.error(`Erreur nettoyage page ${page.data.name || page.id}: ${err.message}`);
    }
  }

  logger.info(`Nettoyage terminé. Total supprimé: ${totalDeleted} posts`);
  return totalDeleted;
}

