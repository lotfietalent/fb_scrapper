// ============================================================
// SCRIPT DE TEST — Teste le scraping sur UNE seule page
// sans écrire dans Firestore
//
// Utilisation : node src/scripts/test-scrape.js <url>
// Exemple     : node src/scripts/test-scrape.js https://www.facebook.com/rabita.corania.tn
// ============================================================

import { launchBrowser, closeBrowser, newContext } from '../scraper/browser.js';
import { dismissPopups, scrollToLoadPosts, extractPostsFromPage } from '../scraper/extract-posts.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

const testUrl = process.argv[2] || 'https://www.facebook.com/rabita.corania.tn';

async function testScrape() {
  logger.info(`Test de scraping sur: ${testUrl}`);

  const browser = await launchBrowser();
  const context = await newContext(browser);
  const page    = await context.newPage();

  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.browser.timeout });
    await page.waitForTimeout(CONFIG.browser.waitAfterLoad);
    await dismissPopups(page);

    const url = page.url();
    logger.info(`URL après navigation: ${url}`);
    if (url.includes('login')) {
      logger.warn('Redirection vers login détectée. La page est peut-être privée ou protégée.');
    }

    await scrollToLoadPosts(page, 3); // Scroll limité pour le test

    const posts = await extractPostsFromPage(page);
    console.log(`\n=== RÉSULTAT : ${posts.length} posts extraits ===\n`);

    posts.slice(0, 5).forEach((p, i) => {
      console.log(`--- Post ${i + 1} ---`);
      console.log(`  ID         : ${p.postId}`);
      console.log(`  URL        : ${p.postUrl}`);
      console.log(`  Date       : ${p.publishedAt}`);
      console.log(`  Texte      : ${(p.text || '').substring(0, 100)}...`);
      console.log(`  Images     : ${p.imageUrls.length}`);
    });

  } finally {
    await page.close();
    await context.close();
    await closeBrowser();
  }
}

testScrape().catch(err => {
  logger.error('Erreur test:', err.message);
  process.exit(1);
});

