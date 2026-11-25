# Facebook Public Pages Scraper

Collecte automatique et quotidienne des publications de pages Facebook publiques vers Firebase Firestore.

## Présentation

Ce programme scrape les pages Facebook publiques de la **Rabita Wataniya lil Quran** (142 pages) et enregistre leurs publications dans une base Firestore existante, dans des collections isolées préfixées `fb_`.

---

## Architecture

```
src/
├── config/
│   └── firebase.js          # Initialisation Firebase Admin SDK
├── services/
│   └── firestore.service.js # Toutes les opérations Firestore
├── scraper/
│   ├── browser.js           # Lancement/fermeture Playwright
│   ├── extract-posts.js     # Extraction des posts (sélecteurs HTML)
│   └── page-scraper.js      # Scraping d'une page + logique intelligente
├── maintenance/
│   └── cleanup.service.js   # Nettoyage automatique des anciens posts
├── utils/
│   ├── hash.js              # Génération d'IDs stables SHA-256
│   ├── normalize-url.js     # Normalisation des URLs Facebook
│   └── logger.js            # Logger simple et sécurisé
├── scripts/
│   ├── seed-pages.js        # Initialisation des pages dans Firestore
│   └── test-scrape.js       # Test de scraping sur une page
├── config.js                # Configuration globale
└── index.js                 # Point d'entrée
```

---

## Collections Firestore créées

| Collection | Rôle |
|---|---|
| `fb_pages` | Pages Facebook à surveiller |
| `fb_posts` | Publications collectées |
| `fb_scraper_runs` | Historique des exécutions |

> Ces collections sont entièrement isolées des données existantes de l'application.

---

## Installation locale

### Prérequis

- Node.js >= 20
- Un fichier `serviceAccountKey.json` Firebase (compte de service)

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/<votre-org>/fb-scrapper.git
cd fb-scrapper

# 2. Installer les dépendances
npm install

# 3. Installer Chromium pour Playwright
npx playwright install chromium

# 4. Configurer l'environnement
cp .env.example .env
# Éditer .env : pointer GOOGLE_APPLICATION_CREDENTIALS vers serviceAccountKey.json
```

### Fichier `.env`

```env
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_PROJECT_ID=dourous-84a2e
```

---

## Configuration Firebase

### Compte de service

1. Aller dans [Console Firebase](https://console.firebase.google.com) → Paramètres du projet → **Comptes de service**
2. Cliquer sur **Générer une nouvelle clé privée**
3. Enregistrer le fichier sous `serviceAccountKey.json` (ne jamais commiter ce fichier)

---

## Initialisation des pages dans Firestore

À lancer **une seule fois** pour peupler la collection `fb_pages` :

```bash
node src/scripts/seed-pages.js
```

Le script lit `documents/fb_pages_list.csv` et crée un document par page.  
Il est **idempotent** : ne recrée pas les pages déjà existantes.

---

## Ajout / Désactivation d'une page

### Ajouter une page

Créer un document dans la collection `fb_pages` dans la [Console Firestore](https://console.firebase.google.com) :

```json
{
  "name": "Nom de la page",
  "facebookUrl": "https://www.facebook.com/...",
  "active": true,
  "lastScrapedAt": null,
  "lastSuccessAt": null,
  "lastErrorAt": null,
  "lastError": null,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

### Désactiver une page (sans supprimer l'historique)

Dans Firestore, mettre le champ `active` à `false`.  
La page sera ignorée lors de la prochaine exécution. Son historique de posts est conservé.

---

## Lancement manuel

```bash
# Lancer le scraper complet
node src/index.js

# Tester sur une seule page (sans écriture Firestore)
node src/scripts/test-scrape.js https://www.facebook.com/rabita.corania.tn
```

---

## Configuration des secrets GitHub Actions

Aller dans **Settings → Secrets and variables → Actions** du dépôt GitHub.

Créer les secrets suivants :

| Secret | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Contenu de `serviceAccountKey.json` encodé en base64 |
| `FIREBASE_PROJECT_ID` | `dourous-84a2e` |

### Générer le secret base64

```bash
# Linux / macOS
base64 -i serviceAccountKey.json

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))
```

---

## Planification quotidienne

Le workflow GitHub Actions `.github/workflows/facebook-scraper.yml` s'exécute :
- **Automatiquement** tous les jours à **12h00 heure tunisienne** (11h00 UTC)
- **Manuellement** depuis l'onglet *Actions* sur GitHub

> Note : GitHub Actions peut être retardé de quelques minutes en période de forte charge. Le système ne dépend pas d'une précision à la minute.

---

## Politique de conservation

| Paramètre | Valeur par défaut | Variable d'environnement |
|---|---|---|
| Max nouveaux posts / page / exécution | 10 | `MAX_NEW_POSTS_PER_PAGE` |
| Max posts conservés par page | 100 | `MAX_POSTS_PER_PAGE` |
| Durée de conservation | 90 jours | `RETENTION_DAYS` |

Un post est supprimé si **l'une ou l'autre** de ces conditions est atteinte :
- Il a plus de 90 jours
- Il fait partie des posts les plus anciens quand la page en contient plus de 100

---

## Détection des doublons

Priorité d'identification d'un post :

1. **ID Facebook du post** (extrait de l'URL : `/posts/123`, `/permalink/123`, etc.)
2. **URL du post normalisée** (sans paramètres de tracking)
3. **Hash SHA-256** calculé à partir de : `pageId | texte normalisé | date`

L'ID du document Firestore est un hash SHA-256 tronqué à 32 caractères.  
Les écritures sont idempotentes : un post déjà connu n'est jamais écrasé.

---

## Logique de collecte intelligente

Pour chaque page, à chaque exécution :

1. Récupérer les posts du plus récent au plus ancien
2. Pour chaque post :
   - S'il existe déjà dans Firestore → **arrêter** la collecte de cette page
   - S'il est nouveau → l'enregistrer
3. S'arrêter après **10 nouveaux posts** maximum (configurable)

Cela évite de parcourir tout l'historique Facebook à chaque exécution.

---

## Gestion des erreurs

| Situation | Comportement |
|---|---|
| Page inaccessible | Erreur enregistrée dans `fb_pages`, page suivante |
| Redirection vers login | Erreur enregistrée, page ignorée |
| Publication sans date | `publishedAt: null` |
| Publication sans image | `imageUrl: null`, `imageUrls: []` |
| Erreur Firestore | Erreur loguée, traitement continue |
| Timeout navigateur | Erreur enregistrée, page suivante |

Le traitement d'une page ne bloque jamais les autres.  
`lastSuccessAt` n'est mis à jour que si le traitement s'est terminé sans erreur.

---

## Dépannage

### Aucun post extrait

Facebook modifie régulièrement son HTML. Si les sélecteurs ne fonctionnent plus :
1. Lancer `node src/scripts/test-scrape.js <url>` en mode non-headless (`headless: false` dans `config.js`)
2. Inspecter le DOM et mettre à jour les sélecteurs dans `src/scraper/extract-posts.js`

### Redirection vers login

Certaines pages Facebook peuvent exiger une connexion même pour le contenu public.  
Le programme enregistre l'erreur et passe à la page suivante — aucun contournement n'est tenté.

### Erreur Firebase

Vérifier que :
- Le secret `FIREBASE_SERVICE_ACCOUNT_BASE64` est correctement encodé
- Le compte de service a les permissions Firestore nécessaires (lecture/écriture)
- Les règles Firestore ne bloquent pas l'Admin SDK (l'Admin SDK bypasse les règles client)

---

## Limites connues

- Facebook peut détecter et bloquer le scraping automatisé
- Les URLs d'images Facebook expirent (conservation du lien original du post)
- Les pages avec peu de publications publiques peuvent retourner 0 post
- GitHub Actions peut être retardé de 5-15 minutes en période de forte charge

