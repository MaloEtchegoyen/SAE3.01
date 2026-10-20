# Consignes pour les Agents IA - Projet SAE 3.01 (Click & Collect Café Feuillette)

Ce document résume les conventions clés du projet et fait le lien vers les règles détaillées et compétences modulaires situées dans le dossier [`.agents/`](.agents/).

---

## 1. Règles prioritaires de collaboration

> Conformément à [`.agents/rules/validation-et-rapport-modifications.md`](.agents/rules/validation-et-rapport-modifications.md) et [`.agents/rules/interdiction-git.md`](.agents/rules/interdiction-git.md) :
1. **Demande préalable obligatoire** : toujours exposer les changements envisagés, leur justification et leur impact, puis attendre l'accord explicite de l'utilisateur avant d'éditer ou de supprimer du code existant.
2. **Rapport après modification obligatoire** : détailler les fichiers modifiés, les modifications apportées et les vérifications/tests effectués.
3. **Interdiction absolue d'utiliser Git** : interdiction formelle pour l'agent d'exécuter la moindre commande `git` (status, diff, add, commit, push, etc.). La gestion de version est exclusivement réservée à l'utilisateur. Voir [`.agents/rules/interdiction-git.md`](.agents/rules/interdiction-git.md).

---

## 2. Architecture & Règles Techniques

| Domaine | Description & Règles clés | Fichier de référence |
| :--- | :--- | :--- |
| **Front-End MVC** | Séparation MVC stricte **par page dynamique** (`front/src/pages/`).<br>• **M (Modèle)** : état et requêtes via `front/src/data/`, aucun accès au DOM.<br>• **V (Vue / UI)** : templates (`htmlToFragment`), DOM, composants réutilisables dans `front/src/ui/`.<br>• **C (Contrôleur)** : orchestration, validation des flux et liaison M-V. | [`.agents/rules/architecture-mvc.md`](.agents/rules/architecture-mvc.md) |
| **Style JavaScript** | ES modules Vite, programmation asynchrone avec `async/await`, gestion stricte des erreurs.<br>Échappement XSS systématique, classes Tailwind complètes (pas de concaténation dynamique).<br>Privilégier `let` à `const` pour les variables (ne réserver `const` qu'aux configurations immuables).<br>Attribut `data-link` obligatoire sur les liens internes pour le routage SPA. | [`.agents/rules/style-javascript.md`](.agents/rules/style-javascript.md) |
| **Back-End PHP** | `declare(strict_types=1)` et typage systématique (PHPDoc).<br>Séparation `Core/`, `Controller/`, `Model/`, `routes.php`.<br>API REST 100% JSON (`Response::json()` / `Response::erreur()`, aucun HTML).<br>Sessions sécurisées (`HttpOnly`, `Secure`, `SameSite`).<br>**Interdiction du mot-clé `foreach`** (utiliser `for`, `while` ou méthodes de tableau).<br>Transactions obligatoires pour les commandes et stocks. | [`.agents/rules/php-backend.md`](.agents/rules/php-backend.md) |
| **Données & SQL** | Moteur InnoDB, `utf8mb4`, clés étrangères et contraintes explicites.<br>Modèle conforme à [`docs/SAE3.01_Epics.md`](docs/SAE3.01_Epics.md) (variantes, stocks par variante, prix figé à la commande, journal d'audit de stock). | [`.agents/rules/sql-data.md`](.agents/rules/sql-data.md) |

---

## 3. Compétences & Outils Dédiés (Skills)

* **Ajout de page** : [`.agents/skills/ajouter-page/SKILL.md`](.agents/skills/ajouter-page/SKILL.md) — Procédure et modèle de référence pour créer une nouvelle page dynamique front respectant l'architecture MVC (M-C-V local, template et slots, routeur).
* **Ajout de fonctionnalité** : [`.agents/skills/ajouter-fonctionnalite-mvc/SKILL.md`](.agents/skills/ajouter-fonctionnalite-mvc/SKILL.md) — Démarche structurée pour implémenter une nouvelle fonctionnalité front en respectant le découpage Data / UI / Page.
* **Audit & Validation MVC** : [`.agents/skills/verifier-mvc/SKILL.md`](.agents/skills/verifier-mvc/SKILL.md) — Procédure de vérification avec le script de contrôle automatisé [`.agents/skills/verifier-mvc/scripts/check-mvc.js`](.agents/skills/verifier-mvc/scripts/check-mvc.js).

