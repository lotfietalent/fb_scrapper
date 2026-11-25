# PROJET : FACEBOOK PUBLIC PAGES SCRAPER
## Collecte automatique des publications Facebook et stockage dans Firebase Firestore

# 1. PRÉSENTATION ET OBJECTIF

Je souhaite développer un programme autonome permettant de collecter quotidiennement les publications de pages Facebook publiques et de les enregistrer dans une base de données Firebase Firestore existante.

Le programme doit être totalement indépendant de toute application frontend existante.

Il doit uniquement partager une base de données Firestore avec d'autres applications qui pourront lire les données collectées.

**Important : une base Firestore existe déjà. Je vais te donner accès à cette base.**

Tu dois utiliser cette base existante pour :

- Ajouter la liste des pages Facebook à surveiller.
- Enregistrer les publications collectées.
- Gérer les historiques de collecte.
- Gérer le nettoyage automatique des anciennes publications.
- Conserver les informations nécessaires au fonctionnement autonome du service.

Ne crée surtout pas un nouveau projet Firebase et ne remplace pas la base existante.

Le programme doit être conçu pour fonctionner durablement, sans intervention humaine quotidienne.

# 2. ARCHITECTURE TECHNIQUE

Technologies imposées :

| Composant | Technologie |
|---|---|
| Langage | Node.js / JavaScript |
| Navigateur automatisé | Playwright + Chromium |
| Base de données | Firebase Firestore existante |
| Accès à Firestore | Firebase Admin SDK |
| Planification | GitHub Actions |
| Hébergement du code | GitHub |
| Exécution | GitHub Actions Ubuntu Runner |

Privilégier les bibliothèques open source et les solutions gratuites.

Ne pas développer d'interface frontend d'administration dans cette première version.

La configuration et l'administration des pages seront effectuées directement dans Firestore.

Ne pas développer d'API RSS, de flux XML ou de serveur Vercel. Les applications clientes pourront lire directement les publications depuis Firestore.

# 3. PHASE INITIALE OBLIGATOIRE : ANALYSE DE FIRESTORE

Avant de développer quoi que ce soit, examiner la base Firestore existante.

Je vais te fournir les accès nécessaires.

Identifier :

- Le projet Firebase.
- Les collections existantes.
- Les structures des documents.
- Les éventuelles collections relatives aux pages Facebook.
- Les éventuelles publications déjà enregistrées.
- Les conventions de nommage existantes.

Règles impératives :

1. Ne jamais supprimer ou modifier des données existantes sans autorisation.
2. Ne jamais réinitialiser la base.
3. Ne jamais modifier les règles de sécurité.
4. Ne pas créer de nouvelles collections si des collections équivalentes existent déjà.
5. Isoler les nouvelles données du scraper.
6. Ne pas supposer que la base est vide.

Après analyse, proposer les collections et les structures de documents nécessaires.

Attendre ma validation avant toute modification de Firestore.

# 4. GESTION DES PAGES FACEBOOK

Le système doit gérer une liste de pages Facebook publiques.

La liste initiale contiendra 10 pages, mais le programme ne doit pas avoir de limite codée en dur.

Les pages doivent être enregistrées dans Firestore.

Structure proposée :

Collection : `facebook_pages`

Exemple de document :

```json
{
  "name": "Association Exemple",
  "facebookUrl": "https://www.facebook.com/example",
  "active": true,
  "lastScrapedAt": null,
  "lastSuccessAt": null,
  "lastErrorAt": null,
  "lastError": null,
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

Les identifiants des documents doivent être stables.

Le scraper doit récupérer automatiquement toutes les pages dont `active = true`.

Il doit être possible de désactiver une page sans supprimer son historique.

Ne jamais coder les URL des pages directement dans le programme.

# 5. SCRAPING DES PUBLICATIONS FACEBOOK

Utiliser Playwright avec Chromium en mode headless.

Les pages ciblées sont publiques.

Le programme doit tenter d'accéder aux publications publiques sans authentification.

Pour chaque page :

1. Ouvrir son URL Facebook.
2. Attendre le chargement des publications.
3. Identifier les publications individuelles.
4. Extraire les informations disponibles.
5. Enregistrer les nouvelles publications dans Firestore.

### Données à extraire

Pour chaque publication :

| Champ | Description |
|---|---|
| postId | Identifiant Facebook si disponible |
| pageId | Identifiant interne de la page |
| pageName | Nom de la page |
| text | Texte de la publication |
| publishedAt | Date de publication |
| postUrl | URL originale Facebook |
| imageUrl | URL de l'image principale |
| imageUrls | Tableau des URL si plusieurs images |
| scrapedAt | Date de collecte |
| createdAt | Date d'enregistrement |

Les dates doivent être normalisées et enregistrées sous forme de Firestore Timestamp lorsque leur précision est suffisante.

Si une information n'est pas disponible, enregistrer null.

Ne jamais inventer une date ou un lien.

### Gestion des images

- Extraire les URL des images pertinentes.
- Ne pas télécharger les images dans cette première version.
- Ne pas conserver les images de profil ou les images décoratives de l'interface Facebook.
- Privilégier les images associées directement à la publication.
- Prévoir la possibilité d'avoir plusieurs images.

Attention : les URL d'images Facebook peuvent expirer ou changer. Conserver également les liens originaux des publications.

### Restrictions

- Ne collecter que les publications accessibles publiquement.
- Ne pas utiliser de compte Facebook personnel.
- Ne pas utiliser de cookies de session personnels.
- Ne pas chercher à contourner les CAPTCHA, les connexions obligatoires ou les protections anti-automatisation.
- Si Facebook refuse l'accès, enregistrer l'erreur et passer à la page suivante.

Les sélecteurs HTML doivent être isolés dans des modules indépendants pour faciliter leur maintenance.

# 6. LOGIQUE DE COLLECTE : POINT TRÈS IMPORTANT

Le scraper doit être intelligent et éviter de parcourir inutilement l'historique des pages à chaque exécution.

La collecte se fait quotidiennement.

Pour chaque page, le programme doit appliquer la logique suivante :

### A. Ordre de récupération

Récupérer les publications de la plus récente à la plus ancienne.

### B. Détection du dernier post déjà connu

À chaque publication récupérée :

1. Identifier la publication.
2. Vérifier si elle existe déjà dans Firestore.
3. Si elle existe déjà, considérer qu'on a retrouvé une publication connue.
4. Arrêter la collecte de cette page.

Cela permet de ne pas parcourir tout l'historique Facebook à chaque exécution.

### C. Limite maximale

Définir une configuration :

`MAX_NEW_POSTS_PER_PAGE = 10`

Cela signifie :

- Maximum de 10 nouvelles publications enregistrées par page et par exécution.
- Le programme peut s'arrêter avant d'atteindre 10 s'il retrouve une publication déjà connue.
- Si 10 nouvelles publications sont trouvées, arrêter immédiatement cette page.
- Ne jamais récupérer volontairement des centaines de publications anciennes en une seule exécution.

Cette valeur doit être configurable sans modifier le code.

### D. Cas particulier : aucune publication connue

Si aucune publication déjà enregistrée n'est rencontrée :

- Arrêter après 10 nouvelles publications.
- Ne pas poursuivre indéfiniment dans l'historique.

### E. Première collecte d'une page

Lorsqu'une page est ajoutée pour la première fois :

- Récupérer au maximum 10 publications récentes.
- Enregistrer ces publications.
- Initialiser l'historique de collecte.
- Lors de la prochaine exécution, appliquer la détection du dernier post connu.

### F. Publications identiques ou doublons

La détection doit fonctionner même si Facebook présente plusieurs fois la même publication pendant la navigation.

Ordre de priorité pour identifier une publication :

1. Identifiant Facebook du post.
2. URL originale normalisée.
3. Empreinte SHA-256 calculée à partir de la page source, du texte normalisé et de la date disponible.

Créer une clé de document Firestore stable à partir de l'identifiant disponible.

Utiliser des écritures idempotentes pour éviter les doublons, y compris si une exécution est relancée.

### G. Attention aux publications publiées le même jour

Ne jamais utiliser uniquement la date comme identifiant d'une publication.

Plusieurs publications peuvent avoir exactement la même date ou la même heure.

La comparaison doit s'effectuer à partir de l'identifiant du post ou de son URL.

### H. Robustesse de la logique d'arrêt

Ne pas supposer que le premier post connu signifie toujours que toutes les publications précédentes ont été récupérées.

Prévoir un état de collecte par page.

Si une exécution échoue partiellement, la prochaine exécution doit pouvoir reprendre sans perdre les publications déjà collectées.

Ne mettre à jour `lastSuccessAt` que si le traitement de la page s'est terminé correctement.

# 7. GESTION DE LA DURABILITÉ ET NETTOYAGE AUTOMATIQUE

Le service doit être autonome.

Il ne doit pas accumuler indéfiniment des publications anciennes dans Firestore.

Prévoir une politique de conservation configurable.

Valeurs initiales proposées :

- Maximum de 10 nouvelles publications par page et par exécution.
- Conservation des publications pendant 90 jours.
- Maximum de 100 publications conservées par page.

Ces deux limites de conservation doivent être configurables indépendamment.

Configuration proposée :

```javascript
const CONFIG = {
  maxNewPostsPerPage: 10,
  maxPostsPerPage: 100,
  retentionDays: 90
};
```

### Règles de nettoyage

Après une collecte réussie :

1. Identifier les publications dépassant 90 jours.
2. Supprimer les publications les plus anciennes si le nombre de publications dépasse 100 pour une page.
3. Conserver les publications les plus récentes.
4. Ne jamais supprimer les documents de configuration des pages.
5. Ne jamais supprimer les historiques de collecte nécessaires au fonctionnement du système.
6. Ne jamais supprimer les publications récentes pour faire de la place à des publications anciennes.

Le nettoyage doit être effectué par lots, en respectant les limites des opérations Firestore.

Il doit être sécurisé et idempotent.

Ne jamais lancer un nettoyage global non contrôlé.

### Important : cohérence des limites

La limite de 100 publications par page et la conservation de 90 jours sont deux conditions indépendantes.

Une publication doit être supprimée si elle dépasse l'une des limites.

Exemple :

- Une page possède 120 publications de moins de 90 jours : conserver les 100 plus récentes.
- Une page possède 40 publications, mais certaines ont plus de 90 jours : supprimer les anciennes.
- Une page possède 30 publications récentes : conserver les 30.

Le nettoyage doit être exécuté automatiquement et ne nécessiter aucune intervention humaine.

# 8. PLANIFICATION QUOTIDIENNE

Utiliser GitHub Actions.

Créer le fichier :

`.github/workflows/facebook-scraper.yml`

La collecte doit être programmée tous les jours à midi, heure tunisienne.

La Tunisie étant à UTC+1 sans changement saisonnier, utiliser 11h00 UTC.

Prévoir également un déclenchement manuel depuis GitHub.

Le workflow doit :

1. Installer Node.js.
2. Installer les dépendances.
3. Installer Chromium pour Playwright.
4. Charger les secrets Firebase.
5. Lancer le scraper.
6. Afficher les résultats de chaque page.
7. Terminer proprement.

Prévoir une protection contre deux exécutions simultanées du même workflow.

Prévoir un timeout global raisonnable.

Attention : les exécutions planifiées de GitHub Actions peuvent être retardées en période de forte charge. Le système ne doit pas dépendre d'une précision absolue à la minute.

# 9. GESTION DES ERREURS ET REPRISE

Le traitement d'une page ne doit jamais bloquer le traitement des autres pages.

Prévoir les situations suivantes :

- Page inaccessible.
- Modification du HTML Facebook.
- Publication sans date.
- Publication sans image.
- Publication sans texte.
- Erreur réseau.
- Erreur Firestore.
- Délai d'attente dépassé.
- Accès refusé par Facebook.

En cas d'erreur :

- Enregistrer l'erreur dans les informations de la page.
- Passer à la page suivante lorsque cela est possible.
- Ne jamais supprimer les données existantes.
- Ne pas déclarer la page traitée avec succès si sa collecte a échoué.

Ne pas effectuer des tentatives répétées excessives qui pourraient aggraver un blocage.

# 10. SÉCURITÉ FIREBASE

Utiliser Firebase Admin SDK.

Les secrets doivent être stockés dans les secrets GitHub Actions.

Ne jamais enregistrer les clés privées dans le dépôt.

Utiliser un compte de service dédié avec les permissions minimales nécessaires.

Le programme ne doit pas modifier les règles de sécurité de Firestore.

Les applications clientes ne doivent pas avoir accès aux secrets du scraper.

Les lectures et écritures côté serveur doivent utiliser les mécanismes d'accès sécurisés de Firebase Admin SDK.

# 11. ORGANISATION DU PROJET

Proposition de structure :

```text
facebook-scraper/
│
├── src/
│   ├── config/
│   │   └── firebase.js
│   │
│   ├── services/
│   │   ├── firestore.service.js
│   │   └── facebook.service.js
│   │
│   ├── scraper/
│   │   ├── browser.js
│   │   ├── page-scraper.js
│   │   └── extract-posts.js
│   │
│   ├── maintenance/
│   │   └── cleanup.service.js
│   │
│   ├── utils/
│   │   ├── hash.js
│   │   ├── normalize-url.js
│   │   └── logger.js
│   │
│   ├── config.js
│   └── index.js
│
├── .github/
│   └── workflows/
│       └── facebook-scraper.yml
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Adapter cette organisation si nécessaire, tout en conservant la séparation entre scraping, stockage, configuration et maintenance.

# 12. JOURNALISATION

À chaque exécution, afficher un rapport détaillé.

Exemple :

```text
========================================
FACEBOOK SCRAPER - DAILY EXECUTION
========================================

Date : 25/11/2026
Pages actives : 10

Page 1 : Association A
Publications examinées : 8
Nouvelles publications : 3
Doublons : 5
Statut : SUCCESS

Page 2 : Association B
Publications examinées : 10
Nouvelles publications : 10
Doublons : 0
Statut : SUCCESS

...

========================================
GLOBAL SUMMARY
========================================

Pages traitées : 10
Pages en erreur : 0
Nouvelles publications : 24
Doublons ignorés : 56
Publications supprimées : 12

Execution completed.
========================================
```

Ne pas afficher les secrets ou les informations sensibles dans les logs.

# 13. DOCUMENTATION

Créer un README complet expliquant :

- L'installation locale.
- La configuration Firebase.
- La configuration des secrets GitHub.
- L'ajout et la désactivation des pages.
- Le lancement manuel du scraper.
- La planification quotidienne.
- La politique de conservation.
- Le fonctionnement de la détection des doublons.
- Les limites et les erreurs possibles.
- Les procédures de dépannage.

# 14. MÉTHODE DE DÉVELOPPEMENT

Travailler en plusieurs phases.

## Phase 1 — Analyse

- Examiner Firestore.
- Identifier les collections existantes.
- Proposer les structures de données.
- Définir les règles de conservation.
- Présenter l'architecture détaillée.

Ne rien modifier avant ma validation.

## Phase 2 — Prototype

- Tester Playwright sur une seule page publique.
- Vérifier l'extraction des quatre informations essentielles : texte, date, lien et image.
- Vérifier la logique de détection des doublons.
- Ne pas encore lancer une collecte massive.

## Phase 3 — Intégration Firestore

- Ajouter les 10 pages.
- Enregistrer les publications.
- Vérifier les identifiants uniques.
- Tester les écritures idempotentes.

## Phase 4 — Automatisation

- Configurer GitHub Actions.
- Programmer la collecte quotidienne à midi heure tunisienne.
- Tester les exécutions manuelles.
- Tester les erreurs et les reprises.

## Phase 5 — Maintenance automatique

- Implémenter la limite de 100 publications par page.
- Implémenter la conservation de 90 jours.
- Tester le nettoyage par lots.
- Vérifier qu'aucune donnée utile n'est supprimée par erreur.

## Phase 6 — Validation finale

Effectuer un test complet sur les 10 pages.

Vérifier :
- La collecte.
- La détection des doublons.
- La gestion des erreurs.
- Le nettoyage.
- La stabilité de Firestore.
- Le rapport d'exécution.

# 15. CONSIGNES FINALES

La priorité absolue est la fiabilité et la durabilité du service.

Je préfère un scraper simple qui fonctionne correctement pendant plusieurs mois plutôt qu'un scraper complexe qui nécessite des interventions régulières.

Le programme doit être autonome, économique, maintenable et capable de supporter une augmentation progressive du nombre de pages.

Ne développe pas de fonctionnalité inutile.

Ne suppose pas que Facebook garantit l'accès aux publications via Playwright. Si une page ne permet pas une collecte publique fiable, signale clairement cette limitation plutôt que de tenter de contourner ses protections.

**Commence maintenant uniquement par la phase 1 : analyse de Firestore et proposition de l'architecture des données. Présente-moi tes conclusions et attends ma validation avant de commencer le développement.**