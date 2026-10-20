# Consignes pour les Agents IA - Projet SAE 3.01 (Click & Collect Café Feuillette)

Ce document rassemble les conventions et règles architecturales fondamentales du projet, issues du socle technique décrit dans le [README.md](README.md), des spécifications fonctionnelles dans [`docs/SAE3.01_Epics.md`](docs/SAE3.01_Epics.md) et des guides détaillés dans le dossier [`.agents/`](.agents/).

---

## 1. Règles prioritaires de collaboration

> Conformément à [`.agents/rules/validation-et-rapport-modifications.md`](.agents/rules/validation-et-rapport-modifications.md) et [`.agents/rules/interdiction-git.md`](.agents/rules/interdiction-git.md) :
1. **Demande préalable obligatoire** : toujours exposer les changements envisagés, leur justification et leur impact, puis attendre l'accord explicite de l'utilisateur avant d'éditer ou de supprimer du code existant.
2. **Rapport après modification obligatoire** : détailler les fichiers modifiés, les modifications apportées et les vérifications/tests effectués.
3. **Interdiction absolue d'utiliser Git** : interdiction formelle pour l'agent d'exécuter la moindre commande `git` (`status`, `diff`, `add`, `commit`, `push`, etc.). La gestion de version est exclusivement réservée à l'utilisateur.

---

## 2. Arborescence & Architecture Globale

Le projet est structuré en une API PHP REST et une Single Page Application (SPA) front-end servie par Vite et Tailwind CSS :

```
.htaccess            /api/... vers le back, tout le reste vers front/dist/
sql/                 schémas SQL InnoDB et jeux d'essai (import.sql, etc.)
back/                API PHP 100% JSON (aucun rendu HTML)
├── index.php        point d'entrée unique de l'API
├── config/          identifiants MySQL et chemin du projet (config.php)
└── src/             Core/ (Request, Response, Router, Database), Controller/, Model/, routes.php
front/               SPA JavaScript (Vite + Tailwind CSS)
├── index.html       page unique de l'application
├── vite.config.js   constante BASE, proxy d'API de développement
└── src/
    ├── main.js      point d'entrée front, déclaration des routes et des layouts
    ├── global.css   Tailwind CSS et styles globaux
    ├── layouts/     structures d'en-tête/navigation avec slot de page
    ├── pages/       pages dynamiques : triplet MVC dans page.js + template.html
    ├── ui/          composants d'interface réutilisables : index.js + template.html
    ├── data/        appels réseau à l'API (un module par ressource métier)
    └── lib/         routeur client (router.js), moteur de templates (utils.js), api-request.js
```

---

## 3. Invariants Techniques & Règles Clés (issus du README)

### A. Configuration & Environnement
- **Parité stricte des chemins** : la constante `BASE` dans `front/vite.config.js` et le `$chemin` dans `back/config/config.php` doivent être **strictement identiques** (ex: `"/~login/Base/"`).
- **Proxy de dev Vite** : lors de `npm run dev`, Vite relaie les requêtes `<BASE>api/...` vers le serveur distant/local pour garantir le fonctionnement des cookies sécurisés (`HttpOnly`, `Secure`, `SameSite`) sans problème de CORS.
- **Routage Apache `.htaccess`** : en production, redirige les appels `/api/...` vers `back/index.php` et toute autre route vers `front/dist/index.html`.

### B. Front-End MVC & Réactivité (`.agents/rules/architecture-mvc.md`)
- **Triplet MVC par page** (`front/src/pages/<page>/`) :
  - **M (Modèle)** : état privé de la page, requêtes via `front/src/data/`, **aucun accès au DOM**.
  - **V (Vue)** : instancie les templates HTML via `htmlToFragment`, remplace les balises `<slot>` par les composants UI, branche les écouteurs d'événements.
  - **C (Contrôleur)** : orchestre les flux, gère les erreurs, met à jour `M` et déclenche `V.rafraichir()`.
- **Réactivité globale par remplacement de racine** : après toute modification d'état, `V.rafraichir()` reconstruit le fragment complet et remplace la racine (`V.racine.replaceWith(nouveauFragment)`). Ne jamais modifier le DOM morceau par morceau au coup par coup.

### C. Routeur SPA & Liens Internes (`front/src/lib/router.js`)
- **Attribut `data-link` obligatoire** : tout lien interne doit porter `<a href="/route" data-link>` sans le préfixe de base du projet (le routeur intercepte le clic et préfixe automatiquement `BASE`).
- **Page active** : le lien de la page courante reçoit automatiquement `aria-current="page"`, ciblé avec `aria-[current=page]:...`.
- **Layouts** : sélectionnés par le plus long préfixe de route ; la page s'insère dans le `<slot>` anonyme du layout.
- **Paramètres de route** : capturés via `:param` (ex: `/produits/:id`) et reçus dans `params.id` de la page.
- **Route 404** : `router.addRoute("*", The404Page)` doit être déclarée impérativement en dernière position dans `front/src/main.js`.

### D. Composants UI & Moteur de Templates (`front/src/ui/`)
- **Signatures standards** : les composants exposent `html(data)` (chaîne) et/ou `dom(data, actions)` (fragment interactif recevant des callbacks).
- **Templates sans boucle ni condition** : aucune structure `for`, `each` ou `if` dans les templates HTML. Les collections sont créées en répétant un sous-template unitaire par élément (ex. `carte-produit.html`), et les états dynamiques sont réglés en JavaScript après `htmlToFragment`.
- **Composition par `<slot name="...">`** : insertion de sous-composants ou messages par remplacement programmatique (`slot.replaceWith(Composant.dom(...))`).
- **Sécurité XSS** : les placeholders `{{cle}}` sont systématiquement échappés via `genericRenderer` (ne produisent que du texte brut sécurisé).

### E. Style JavaScript & Tailwind (`.agents/rules/style-javascript.md`)
- Classes Tailwind écrites en entier dans le code (aucune concaténation dynamique de classe).
- Privilégier systématiquement `let` à `const` pour les variables locales et sélecteurs DOM ; réserver `const` aux véritables constantes globales en majuscules.

### F. Back-End PHP & API REST (`.agents/rules/php-backend.md`)
- `declare(strict_types=1)` et typage systématique.
- Réponses 100% JSON via `Response::json()` et `Response::erreur()` (aucun HTML).
- **Interdiction formelle de `foreach`** : utiliser `for`, `while` ou méthodes d'itération fonctionnelles de tableau.
- **Cookies & Métadonnées** : les préférences de pagination/tri sont stockées en cookies serveur `HttpOnly`. Le serveur rappelle systématiquement ces réglages (`tri`, `parPage`, `page`, `total`, `pagesTotal`) dans le payload JSON, dispensant le front de devoir lire les cookies.
- Transactions SQL obligatoires pour les commandes et les mouvements de stock.

### G. Données & Schéma SQL (`.agents/rules/sql-data.md`)
- Schémas MySQL InnoDB, `utf8mb4`, intégrité référentielle par clés étrangères.
- Respect strict des entités de Click & Collect définies dans [`docs/SAE3.01_Epics.md`](docs/SAE3.01_Epics.md) (variantes, stocks par variante, prix figé à la commande, journal d'audit de stock).

---

## 4. Dépannage & Erreurs Courantes ("Si ça ne marche pas")

| Symptôme | Cause probable | Solution / Action |
| :--- | :--- | :--- |
| **Listing de dossiers Apache ou 404 sur la racine** | `.htaccess` racine absent ou dossier `front/dist/` non généré. | Vérifier la présence du `.htaccess` et exécuter `npm run build` dans `front/`. |
| **Page blanche, fichiers `assets/...` en 404** | La constante `BASE` de `vite.config.js` ne correspond pas au chemin réel. | Aligner exactement `BASE` avec l'URL de déploiement (avec barre finale). |
| **« Impossible de charger le catalogue » / Erreur API** | Mauvais identifiants MySQL dans `back/config/config.php` ou tables non importées. | Vérifier `config.php` et importer les scripts du dossier `sql/`. |
| **Préférences perdues, session non retenue** | Le paramètre `chemin` de `back/config/config.php` ne correspond pas à l'URL. | Aligner `chemin` sur le chemin d'URL exact pour autoriser les cookies `HttpOnly`. |
| **En dev local (`npm run dev`), l'API répond 404** | Le proxy Vite ne peut joindre le back ou `BASE` est mal renseigné. | Vérifier `BASE` et la constante `SERVEUR` dans `front/vite.config.js`. |

---

## 5. Compétences & Outils Dédiés (Skills)

* **Ajout de page** : [`.agents/skills/ajouter-page/SKILL.md`](.agents/skills/ajouter-page/SKILL.md) — Procédure et modèle de référence pour créer une nouvelle page dynamique front respectant l'architecture MVC (M-C-V local, template et slots, liens `data-link`, routeur).
* **Ajout de fonctionnalité** : [`.agents/skills/ajouter-fonctionnalite-mvc/SKILL.md`](.agents/skills/ajouter-fonctionnalite-mvc/SKILL.md) — Démarche structurée pour implémenter une nouvelle fonctionnalité front en respectant le découpage Data / UI / Page et les US de [`docs/SAE3.01_Epics.md`](docs/SAE3.01_Epics.md).
* **Audit & Validation MVC** : [`.agents/skills/verifier-mvc/SKILL.md`](.agents/skills/verifier-mvc/SKILL.md) — Procédure de vérification avec le script de contrôle automatisé [`.agents/skills/verifier-mvc/scripts/check-mvc.js`](.agents/skills/verifier-mvc/scripts/check-mvc.js).

---

## 6. Répertoire des Règles Détaillées

* [`.agents/rules/validation-et-rapport-modifications.md`](.agents/rules/validation-et-rapport-modifications.md) — Protocole de validation préalable et rapport de modifications.
* [`.agents/rules/interdiction-git.md`](.agents/rules/interdiction-git.md) — Interdiction stricte et absolue de toute commande Git.
* [`.agents/rules/architecture-mvc.md`](.agents/rules/architecture-mvc.md) — Découpage M-V-C, `V.rafraichir()`, composants UI et routeur client.
* [`.agents/rules/style-javascript.md`](.agents/rules/style-javascript.md) — Conventions JavaScript, JSDoc, `data-link`, slots et Tailwind.
* [`.agents/rules/php-backend.md`](.agents/rules/php-backend.md) — Règles strictes de l'API REST PHP, interdiction de `foreach`, sessions et JSON.
* [`.agents/rules/sql-data.md`](.agents/rules/sql-data.md) — Règles SQL, intégrité InnoDB et décisions métier Café Feuillette.
