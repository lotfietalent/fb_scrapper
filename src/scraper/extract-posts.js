// ============================================================
// EXTRACTION DES PUBLICATIONS FACEBOOK
// Sélecteurs isolés ici pour faciliter la maintenance
// si Facebook modifie son HTML
// ============================================================

import { logger }       from '../utils/logger.js';
import { normalizeUrl, extractPostId } from '../utils/normalize-url.js';
import { CONFIG }       from '../config.js';

// ─── SÉLECTEURS (à maintenir si Facebook change son HTML) ────
const SELECTORS = {
  // Conteneur principal d'un post dans le feed
  postFeed: '[role="feed"]',
  postItem: '[role="feed"] > div',

  // Fermer les popups de connexion / cookies
  closeLoginPopup: '[aria-label="Fermer"], [aria-label="Close"], [data-testid="cookie-policy-manage-dialog-accept-button"]',
  cookieAccept:    'button[data-cookiebanner="accept_button"], [data-testid="cookie-policy-manage-dialog-accept-button"]',

  // Lien "Voir plus" dans un post
  seeMore: '[data-ad-preview="message"] [role="button"], [data-testid="see_more_link"]',
};

/**
 * Ferme les popups de connexion et de cookies.
 */
export async function dismissPopups(page) {
  try {
    // Accepter cookies si présent
    const cookie = page.locator(SELECTORS.cookieAccept).first();
    if (await cookie.isVisible({ timeout: 3000 })) {
      await cookie.click();
      await page.waitForTimeout(CONFIG.delays.afterPopupClose);
    }
  } catch { /* pas de popup cookies */ }

  try {
    // Fermer popup de connexion si présent
    const close = page.locator(SELECTORS.closeLoginPopup).first();
    if (await close.isVisible({ timeout: 3000 })) {
      await close.click();
      await page.waitForTimeout(CONFIG.delays.afterPopupClose);
    }
  } catch { /* pas de popup login */ }
}

/**
 * Fait défiler la page pour charger plus de posts.
 */
export async function scrollToLoadPosts(page, maxScrolls) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(CONFIG.delays.betweenScrolls);
  }
}

/**
 * Extrait tous les posts visibles sur la page.
 * @returns {Array<{postId, postUrl, text, publishedAt, imageUrl, imageUrls}>}
 */
export async function extractPostsFromPage(page) {
  // On exécute l'extraction dans le contexte du navigateur
  const posts = await page.evaluate(() => {
    const results = [];
    const seen    = new Set();

    // Chercher tous les articles/divs qui ressemblent à des posts
    // Facebook utilise différentes structures selon le type de page
    const feedEl = document.querySelector('[role="feed"]');
    const items  = feedEl
      ? Array.from(feedEl.children)
      : Array.from(document.querySelectorAll('div[data-pagelet^="FeedUnit"]'));

    for (const item of items) {
      try {
        // ── URL et ID du post ──
        let postUrl  = null;
        let postId   = null;

        // Chercher un lien contenant /posts/ ou /permalink/
        const links = Array.from(item.querySelectorAll('a[href]'));
        for (const a of links) {
          const href = a.href || '';
          if (href.includes('/posts/') || href.includes('/permalink/') ||
              href.includes('story_fbid=') || href.includes('/pfbid')) {
            postUrl = href.split('?')[0]; // Nettoyer les params de tracking
            // Extraire l'ID
            const m = href.match(/\/posts\/(\d+)/) ||
                      href.match(/\/permalink\/(\d+)/) ||
                      href.match(/story_fbid=(\d+)/) ||
                      href.match(/\/pfbid([A-Za-z0-9]+)/);
            if (m) postId = m[1];
            break;
          }
        }

        // ── Texte du post ──
        let text = null;
        const textCandidates = [
          item.querySelector('[data-ad-preview="message"]'),
          item.querySelector('[data-testid="post_message"]'),
          item.querySelector('div[dir="auto"]'),
        ];
        for (const el of textCandidates) {
          if (el && el.innerText && el.innerText.trim().length > 0) {
            text = el.innerText.trim().substring(0, 2000);
            break;
          }
        }

        // ── Date du post ──
        let publishedAt = null;
        const timeEl = item.querySelector('abbr[data-utime], time[datetime], abbr[title]');
        if (timeEl) {
          const utime = timeEl.getAttribute('data-utime');
          const dt    = timeEl.getAttribute('datetime');
          if (utime) {
            publishedAt = new Date(parseInt(utime, 10) * 1000).toISOString();
          } else if (dt) {
            publishedAt = new Date(dt).toISOString();
          } else if (timeEl.title) {
            publishedAt = timeEl.title;
          }
        }

        // ── Images du post ──
        const imageUrls = [];
        const imgs = Array.from(item.querySelectorAll('img[src]'));
        for (const img of imgs) {
          const src = img.src || '';
          // Exclure avatars, icônes, images de réaction, emojis
          if (src.includes('emoji') || src.includes('rsrc') ||
              src.includes('static') || img.width < 100 || img.height < 100) continue;
          // Exclure profil pics (souvent petites et carrées)
          if (img.width === img.height && img.width < 150) continue;
          if (!imageUrls.includes(src)) imageUrls.push(src);
        }

        // ── Dédupliquation par URL ──
        const key = postUrl || text?.substring(0, 100) || null;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        // On ignore les posts sans texte ET sans URL (trop ambigus)
        if (!postUrl && !text) continue;

        results.push({
          postId:    postId || null,
          postUrl:   postUrl || null,
          text:      text || null,
          publishedAt,
          imageUrl:  imageUrls[0] || null,
          imageUrls,
        });
      } catch (e) {
        // Ignorer les items problématiques
      }
    }

    return results;
  });

  logger.debug(`${posts.length} posts extraits de la page`);
  return posts;
}

