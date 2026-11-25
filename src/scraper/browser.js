// ============================================================
// GESTION DU NAVIGATEUR PLAYWRIGHT
// ============================================================

import { chromium } from 'playwright';
import { CONFIG }   from '../config.js';
import { logger }   from '../utils/logger.js';

let browserInstance = null;

export async function launchBrowser() {
  logger.info('Lancement du navigateur Chromium...');
  browserInstance = await chromium.launch({
    headless: CONFIG.browser.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--lang=fr-FR',
    ],
  });
  logger.info('Navigateur lancé.');
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Navigateur fermé.');
  }
}

/**
 * Crée un nouveau contexte de navigation isolé avec des en-têtes réalistes.
 */
export async function newContext(browser) {
  return browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36',
    viewport:   { width: 1280, height: 900 },
    locale:     'fr-FR',
    timezoneId: 'Africa/Tunis',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
    },
  });
}

