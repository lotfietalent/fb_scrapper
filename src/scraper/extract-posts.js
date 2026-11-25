// ============================================================
// EXTRACTION DES PUBLICATIONS FACEBOOK
// Sélecteurs isolés ici pour faciliter la maintenance
// si Facebook modifie son HTML
// ============================================================

import { logger } from '../utils/logger.js';
import { normalizeUrl, extractPostId } from '../utils/normalize-url.js';
import { CONFIG } from '../config.js';

// ─── SÉLECTEURS (à maintenir si Facebook change son HTML) ────
const SELECTORS = {
  // Publications principales (exclut les commentaires imbriqués)
  postArticle: '[role="article"]',

  // Fermer les popups de connexion / cookies
  closeLoginPopup: '[role="dialog"] [aria-label="Fermer"], [role="dialog"] [aria-label="Close"]',
  cookieAccept:    'button[data-cookiebanner="accept_button"], [data-testid="cookie-policy-manage-dialog-accept-button"]',
};

const FRENCH_MONTHS = {
  janvier: '01', 'février': '02', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', 'août': '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', 'décembre': '12', decembre: '12',
};

/**
 * Parse une date française extraite du texte Facebook (ex: "Samedi 21 novembre 2026 à 19:27").
 * Retourne une ISO string ou null si introuvable/invalide.
 */
function parseFrenchDate(rawText) {
  if (!rawText) return null;
  const re = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})(?:\s+[àa]\s+(\d{1,2}):(\d{2}))?/i;
  const m = rawText.match(re);
  if (!m) return null;

  const day   = m[1].padStart(2, '0');
  const month = FRENCH_MONTHS[m[2].toLowerCase()];
  const year  = m[3];
  const hour  = (m[4] || '00').padStart(2, '0');
  const min   = (m[5] || '00').padStart(2, '0');
  if (!month) return null;

  const iso = `${year}-${month}-${day}T${hour}:${min}:00+01:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Ferme les popups de connexion et de cookies.
 */
export async function dismissPopups(page) {
  try {
    const cookie = page.locator(SELECTORS.cookieAccept).first();
    if (await cookie.isVisible({ timeout: 2000 })) {
      await cookie.click();
      await page.waitForTimeout(CONFIG.delays.afterPopupClose);
    }
  } catch { /* pas de popup cookies */ }

  try {
    const close = page.locator(SELECTORS.closeLoginPopup).first();
    if (await close.isVisible({ timeout: 2000 })) {
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
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(CONFIG.delays.betweenScrolls);
  }
}

/**
 * Extrait tous les posts visibles sur la page.
 * @returns {Promise<Array<{postId, postUrl, text, publishedAt, imageUrl, imageUrls}>>}
 */
export async function extractPostsFromPage(page) {
  const rawPosts = await page.evaluate((articleSelector) => {
    const results = [];
    const articles = Array.from(document.querySelectorAll(articleSelector));

    for (const item of articles) {
      try {
        // Ignorer les commentaires imbriqués dans un autre article
        if (item.parentElement && item.parentElement.closest(articleSelector)) {
          continue;
        }

        // Ignorer les éléments sans aria-posinset qui sont des commentaires ou blocs vides
        const links = Array.from(item.querySelectorAll('a[href]'));
        let rawPostUrl = null;

        for (const a of links) {
          const href = a.href || '';
          if (href.includes('comment_id=')) continue;
          if (
            href.includes('/posts/') ||
            href.includes('permalink.php') ||
            href.includes('story_fbid=') ||
            href.includes('/reel/') ||
            href.includes('/videos/')
          ) {
            rawPostUrl = href;
            break;
          }
        }

        // Si aucun lien de post et pas d'aria-posinset, ce n'est probablement pas un post principal
        if (!rawPostUrl && !item.getAttribute('aria-posinset')) {
          continue;
        }

        // Texte du post
        let text = null;
        const textCandidates = [
          item.querySelector('[data-ad-preview="message"]'),
          item.querySelector('[data-testid="post_message"]'),
        ];
        for (const el of textCandidates) {
          if (el && el.innerText && el.innerText.trim().length > 0) {
            text = el.innerText.trim().substring(0, 4000);
            break;
          }
        }

        // Date brute (attributs standards ou texte visible de l'article)
        let isoDate = null;
        const timeEl = item.querySelector('abbr[data-utime], time[datetime]');
        if (timeEl) {
          const utime = timeEl.getAttribute('data-utime');
          const dt = timeEl.getAttribute('datetime');
          if (utime) isoDate = new Date(parseInt(utime, 10) * 1000).toISOString();
          else if (dt) isoDate = new Date(dt).toISOString();
        }

        // Images du post
        const imageUrls = [];
        const imgs = Array.from(item.querySelectorAll('img[src]'));
        for (const img of imgs) {
          const src = img.src || '';
          if (
            src.includes('emoji') ||
            src.includes('rsrc') ||
            src.includes('static') ||
            img.width < 100 ||
            img.height < 100
          ) {
            continue;
          }
          if (img.width === img.height && img.width < 150) continue;
          if (!imageUrls.includes(src)) imageUrls.push(src);
        }

        if (!rawPostUrl && !text) continue;

        results.push({
          rawPostUrl,
          text,
          isoDate,
          headerText: (item.innerText || '').slice(0, 500),
          imageUrls,
        });
      } catch {
        // Ignorer les items problématiques
      }
    }

    return results;
  }, SELECTORS.postArticle);

  const seen = new Set();
  const posts = [];

  for (const raw of rawPosts) {
    const postUrl = raw.rawPostUrl ? normalizeUrl(raw.rawPostUrl) : null;
    const postId = extractPostId(postUrl || raw.rawPostUrl);
    const key = postId || postUrl || (raw.text ? raw.text.substring(0, 100) : null);

    if (!key || seen.has(key)) continue;
    seen.add(key);

    const publishedAt = raw.isoDate || parseFrenchDate(raw.headerText) || null;

    posts.push({
      postId:      postId || null,
      postUrl:     postUrl || null,
      text:        raw.text || null,
      publishedAt,
      imageUrl:    raw.imageUrls[0] || null,
      imageUrls:   raw.imageUrls,
    });
  }

  logger.debug(`${posts.length} posts extraits de la page`);
  return posts;
}
