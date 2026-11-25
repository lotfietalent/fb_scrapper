// ============================================================
// INITIALISATION FIREBASE ADMIN SDK
// Supporte deux modes :
//   1. Fichier serviceAccountKey.json (via GOOGLE_APPLICATION_CREDENTIALS)
//   2. Variable FIREBASE_SERVICE_ACCOUNT_BASE64 (GitHub Actions)
// ============================================================

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';
import { CONFIG }                        from '../config.js';

function initFirebase() {
  if (getApps().length > 0) return getApps()[0];

  // Mode GitHub Actions : clé encodée en base64
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(json);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId:  CONFIG.projectId,
    });
  }

  // Mode local : GOOGLE_APPLICATION_CREDENTIALS pointe vers le fichier JSON
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // L'Admin SDK lit automatiquement GOOGLE_APPLICATION_CREDENTIALS
    return initializeApp({ projectId: CONFIG.projectId });
  }

  throw new Error(
    'Aucune credential Firebase trouvée.\n' +
    'Définir GOOGLE_APPLICATION_CREDENTIALS (local) ou FIREBASE_SERVICE_ACCOUNT_BASE64 (CI).'
  );
}

initFirebase();

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });