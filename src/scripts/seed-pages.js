// ============================================================
// SCRIPT D'INITIALISATION — Peuple la collection fb_pages
// depuis le fichier CSV documents/fb_pages_list.csv
//
// Utilisation : node src/scripts/seed-pages.js
// À lancer UNE SEULE FOIS pour initialiser la base.
// Idempotent : ne recrée pas les pages déjà existantes.
// ============================================================

import '../config/firebase.js';  // charge .env + initialise Firebase
import { db }       from '../config/firebase.js';
import { CONFIG }   from '../config.js';
import { logger }   from '../utils/logger.js';
import { Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createHash }   from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(str) {
  return createHash('sha256')
    .update(str.trim())
    .digest('hex')
    .substring(0, 20);
}

function parseCSV(content) {
  const lines = content.split('\n').map(l => l.replace(/\r$/, ''));
  const pages = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Gestion des guillemets CSV
    const sep = line.lastIndexOf(';https://');
    if (sep === -1) continue;
    const titre = line.substring(0, sep).replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    const lien  = line.substring(sep + 1).trim();
    if (titre && lien) pages.push({ titre, lien });
  }
  return pages;
}

async function seedPages() {
  const csvPath = join(__dirname, '../../documents/fb_pages_list.csv');
  const content = readFileSync(csvPath, 'utf8');
  const pages   = parseCSV(content);

  logger.info(`${pages.length} pages trouvées dans le CSV`);

  const colRef = db.collection(CONFIG.collections.pages);
  let created = 0;
  let skipped = 0;

  for (const { titre, lien } of pages) {
    // ID stable basé sur l'URL (pour idempotence)
    const docId = slugify(lien);
    const ref   = colRef.doc(docId);
    const snap  = await ref.get();

    if (snap.exists) {
      logger.debug(`Déjà existant, ignoré: ${titre}`);
      skipped++;
      continue;
    }

    const now = Timestamp.now();
    await ref.set({
      name:          titre,
      facebookUrl:   lien,
      active:        true,
      lastScrapedAt: null,
      lastSuccessAt: null,
      lastErrorAt:   null,
      lastError:     null,
      createdAt:     now,
      updatedAt:     now,
    });

    logger.info(`Créé: [${docId}] ${titre}`);
    created++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`Seed terminé.`);
  console.log(`  Pages créées  : ${created}`);
  console.log(`  Pages ignorées: ${skipped}`);
  console.log('='.repeat(40));
  process.exit(0);
}

seedPages().catch(err => {
  logger.error('Erreur seed:', err.message);
  process.exit(1);
});

