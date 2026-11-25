// ============================================================
// POINT D'ENTRÉE PRINCIPAL — Orchestration complète du scraper
// ============================================================

import './config/firebase.js';  // Initialise Firebase en premier
import { launchBrowser, closeBrowser }                     from './scraper/browser.js';
import { scrapeOnePage }                                   from './scraper/page-scraper.js';
import { getActivePages, updatePageAfterScrape, createRun, finalizeRun } from './services/firestore.service.js';
import { runCleanup }                                      from './maintenance/cleanup.service.js';
import { CONFIG }                                          from './config.js';
import { logger }                                          from './utils/logger.js';

// ─── RAPPORT D'EXÉCUTION ────────────────────────────────────

function printHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' });
  console.log('\n' + '='.repeat(48));
  console.log('  FACEBOOK SCRAPER - DAILY EXECUTION');
  console.log('='.repeat(48));
  console.log(`  Date : ${dateStr}`);
}

function printPageResult(index, pageName, result) {
  console.log(`\nPage ${index} : ${pageName}`);
  console.log(`  Publications examinées : ${result.examined}`);
  console.log(`  Nouvelles publications : ${result.newPosts}`);
  console.log(`  Doublons              : ${result.duplicates}`);
  console.log(`  Statut                : ${result.status.toUpperCase()}`);
  if (result.error) {
    console.log(`  Erreur                : ${result.error}`);
  }
}

function printSummary(stats, deletedTotal) {
  console.log('\n' + '='.repeat(48));
  console.log('  RÉSUMÉ GLOBAL');
  console.log('='.repeat(48));
  console.log(`  Pages traitées         : ${stats.pagesTotal}`);
  console.log(`  Pages en succès        : ${stats.pagesSuccess}`);
  console.log(`  Pages en erreur        : ${stats.pagesError}`);
  console.log(`  Nouvelles publications : ${stats.newPostsTotal}`);
  console.log(`  Doublons ignorés       : ${stats.duplicatesTotal}`);
  console.log(`  Publications supprimées: ${deletedTotal}`);
  console.log('\n  Execution completed.');
  console.log('='.repeat(48) + '\n');
}

// ─── ORCHESTRATION PRINCIPALE ───────────────────────────────

async function main() {
  printHeader();

  const runId = await createRun();
  logger.info(`Run ID: ${runId}`);

  // Récupérer les pages actives
  const pages = await getActivePages();
  console.log(`\n  Pages actives : ${pages.length}\n`);

  if (!pages.length) {
    logger.warn('Aucune page active trouvée dans fb_pages. Arrêt.');
    await finalizeRun(runId, { pagesTotal: 0, pagesSuccess: 0, pagesError: 0, newPostsTotal: 0, deletedPostsTotal: 0 });
    return;
  }

  const stats = {
    pagesTotal:     pages.length,
    pagesSuccess:   0,
    pagesError:     0,
    newPostsTotal:  0,
    duplicatesTotal: 0,
  };

  const browser = await launchBrowser();

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageName = page.data.name || page.id;

      logger.info(`Traitement page ${i + 1}/${pages.length}: ${pageName}`);

      // Scraping de la page
      const result = await scrapeOnePage(browser, page);

      // Mise à jour des métadonnées de la page dans Firestore
      await updatePageAfterScrape(page.id, {
        success: result.status === 'success',
        error:   result.error,
      });

      // Accumulation des stats
      if (result.status === 'success') {
        stats.pagesSuccess++;
      } else {
        stats.pagesError++;
      }
      stats.newPostsTotal   += result.newPosts;
      stats.duplicatesTotal += result.duplicates;

      printPageResult(i + 1, pageName, result);

      // Délai entre les pages pour éviter le blocage
      if (i < pages.length - 1) {
        await new Promise(r => setTimeout(r, CONFIG.delays.betweenPages));
      }
    }
  } finally {
    await closeBrowser();
  }

  // ─── Nettoyage des anciens posts ────────────────────────
  logger.info('Lancement du nettoyage automatique...');
  const deletedTotal = await runCleanup(pages);

  // ─── Finalisation du run ────────────────────────────────
  await finalizeRun(runId, { ...stats, deletedPostsTotal: deletedTotal });

  printSummary(stats, deletedTotal);
}

// ─── LANCEMENT ──────────────────────────────────────────────
main().catch(err => {
  logger.error('Erreur fatale dans main():', err.message);
  console.error(err);
  process.exit(1);
});

