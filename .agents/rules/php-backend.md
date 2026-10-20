---
trigger: glob
globs: ["back/**/*.php"]
---

# Règles PHP de l'API

- Conserver `declare(strict_types=1)` et l'autoload de `back/index.php`.
- Garder la séparation `Core/`, `Controller/`, `Model/` et `routes.php`.
- Typer propriétés, paramètres et retours ; documenter les méthodes publiques en PHPDoc.
- Utiliser PDO et des requêtes préparées pour les valeurs.
- Utiliser une liste blanche serveur pour les identifiants SQL dynamiques.
- Centraliser les réponses avec `Response::json()` ou `Response::erreur()`.
- Ne jamais renvoyer de HTML depuis l'API (100% JSON).
- **Gestion des sessions & cookies de préférences** :
  - Configurer les cookies de session et de préférences (`tri`, `parPage`) avant `session_start()` avec `HttpOnly`, `Secure`, `SameSite` et le chemin exact du projet (`$chemin` de `config.php`).
  - Appeler `session_regenerate_id(true)` après connexion réussie.
  - **Rappel systématique des métadonnées dans la réponse JSON** : l'API doit renvoyer dans le payload JSON les paramètres effectifs appliqués (`page`, `pagesTotal`, `total`, `tri`, `parPage`). Le front n'a ainsi jamais besoin de tenter de lire les cookies (qui sont inaccessibles en `HttpOnly`).
- Ne jamais faire confiance à un rôle, prix, quantité, variante ou stock envoyé par le navigateur.
- **Interdiction formelle du mot-clé `foreach`** : utiliser `for`, `while` ou les méthodes d'itération fonctionnelles de tableau (`array_map`, etc.).
- Les écritures de commande et de stock doivent être transactionnelles et préserver l'idempotence lorsque le parcours l'exige.
