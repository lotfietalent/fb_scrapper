// ============================================================
// SCRAPER D'UNE PAGE FACEBOOK
// Applique la logique intelligente de collecte :
//   - S'arrête dès qu'un post connu est trouvé
//   - Limite à MAX_NEW_POSTS_PER_PAGE par exécution
// ============================================================

import { newContext }              from './browser.js';
import { dismissPopups, scrollToLoadPosts, extractPostsFromPage } from './extract-posts.js';
import { postExists, savePost, getLatestKnownPost } from '../services/firestore.service.js';
import { CONFIG }                  from '../config.js';
import { logger }                  from '../utils/logger.js';
import { buildPostDocId }          from '../utils/hash.js';

/**
 * Résultat du scraping d'une page.
 * @typedef {{ newPosts: number, duplicates: number, examined: number, status: 'success'|'error', error?: string }}
 */

/**
 * Scrape une seule page Facebook et enregistre les nouveaux posts dans Firestore.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ id: string, data: object }} page  Document fb_pages
 * @returns {Promise<{ newPosts, duplicates, examined, status, error? }>}
 */
export async function scrapeOnePage(browser, page) {
  const { id: pageId, data: pageData } = page;
  const pageName = pageData.name || pageId;
  const pageUrl  = pageData.facebookUrl;

  const result = { newPosts: 0, duplicates: 0, examined: 0, status: 'error', error: null };

  let context = null;
  let browserPage = null;

  try {
    context     = await newContext(browser);
    browserPage = await context.newPage();

    // Bloquer les ressources inutiles pour accélérer
    await browserPage.route('**/*.{mp4,webm,ogg,mp3}', r => r.abort());

    // Navigation
    logger.info(`Navigation vers: ${pageUrl}`);
    await browserPage.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout:   CONFIG.browser.timeout,
    });

    await browserPage.waitForTimeout(CONFIG.browser.waitAfterLoad);

    // Fermer les popups cookies / connexion
    await dismissPopups(browserPage);

    // Vérifier si l'accès est bloqué (redirection vers login)
    const currentUrl = browserPage.url();
    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
      throw new Error('Accès refusé par Facebook (redirection vers login)');
    }

    // Charger des posts par scrolling
    await scrollToLoadPosts(browserPage, CONFIG.maxScrolls);

    // Extraire les posts visibles
    const extractedPosts = await extractPostsFromPage(browserPage);

    if (!extractedPosts.length) {
      logger.warn(`Aucun post extrait pour la page: ${pageName}`);
      // Ce n'est pas forcément une erreur (page vide ou structure inconnue)
      result.status = 'success';
      return result;
    }

    logger.info(`${extractedPosts.length} posts extraits pour: ${pageName}`);

    // ─── Logique de collecte intelligente ───────────────────
    for (const post of extractedPosts) {
      result.examined++;

      // Vérifier si ce post existe déjà en Firestore
      const exists = await postExists(pageId, post);

      if (exists) {
        // Post déjà connu → on a atteint la limite historique
        result.duplicates++;
        logger.debug(`Post connu trouvé → arrêt de la collecte pour: ${pageName}`);
        break;
      }

      // Nouveau post → l'enregistrer
      await savePost(pageId, pageName, post);
      result.newPosts++;

      // Limite max de nouveaux posts par page et par exécution
      if (result.newPosts >= CONFIG.maxNewPostsPerPage) {
        logger.debug(`Limite de ${CONFIG.maxNewPostsPerPage} nouveaux posts atteinte pour: ${pageName}`);
        break;
      }
    }

    result.status = 'success';

  } catch (err) {
    result.error  = err.message;
    result.status = 'error';
    logger.error(`Erreur scraping page ${pageName}: ${err.message}`);
  } finally {
    if (browserPage) await browserPage.close().catch(() => {});
    if (context)     await context.close().catch(() => {});
  }

  return result;
}

