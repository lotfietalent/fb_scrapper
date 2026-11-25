// ============================================================
// CONFIGURATION GLOBALE DU SCRAPER
// Toutes les valeurs sont configurables via variables d'environnement
// ============================================================

// Chargement automatique du fichier .env en développement local
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dir  = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dir, '..', '.env');
if (existsSync(envFile)) {
  readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const clean = line.replace(/\r$/, '').trim();
    if (!clean || clean.startsWith('#')) return;
    const idx = clean.indexOf('=');
    if (idx === -1) return;
    const key = clean.substring(0, idx).trim();
    const val = clean.substring(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  });
}

export const CONFIG = {
  // --- Firebase ---
  projectId: process.env.FIREBASE_PROJECT_ID || 'dourous-84a2e',

  // --- Noms des collections Firestore (préfixe fb_ pour isolation) ---
  collections: {
    pages: 'fb_pages',
    posts: 'fb_posts',
    runs:  'fb_scraper_runs',
  },

  // --- Limites de collecte ---
  maxNewPostsPerPage: parseInt(process.env.MAX_NEW_POSTS_PER_PAGE || '10', 10),
  maxPostsPerPage:   parseInt(process.env.MAX_POSTS_PER_PAGE    || '100', 10),
  retentionDays:     parseInt(process.env.RETENTION_DAYS        || '90', 10),

  // --- Playwright ---
  browser: {
    headless: true,
    timeout:  30_000,   // 30 secondes par navigation
    waitAfterLoad: 3000, // ms après chargement de la page
  },

  // --- Délais anti-détection (ms) ---
  delays: {
    betweenPages:    3000,
    betweenScrolls:  1500,
    afterPopupClose: 1000,
  },

  // --- Nombre de scrolls max pour charger les posts ---
  maxScrolls: 8,
};

