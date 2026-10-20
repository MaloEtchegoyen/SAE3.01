---
trigger: glob
globs: ["front/**/*.js", "front/**/*.html"]
---

# Style JavaScript du front

- Utiliser les ES modules et les imports relatifs déjà présents dans `front/src/`.
- Respecter l'organisation `pages/`, `ui/`, `data/` et `lib/`.
- Documenter les fonctions et classes publiques en JSDoc.
- Utiliser `async/await` pour les appels réseau et gérer explicitement les erreurs HTTP.
- **Routage et liens internes** : ajouter systématiquement l'attribut `data-link` sur toute balise `<a href="..." data-link>` interne sans inclure le chemin de base (ex: `<a href="/catalogue" data-link>`), afin que le routeur intercepte la navigation sans recharger la page.
- **Moteur de template et sécurité XSS** : échapper toute donnée injectée dans un placeholder `{{cle}}`. Réutiliser `genericRenderer` et `htmlToFragment` plutôt que d'injecter du HTML brut (`innerHTML`).
- **Templates sans logique** : aucun template HTML ne doit comporter de boucle ou de condition. Construire les listes en répétant des templates unitaires (ex: `ligne-*.html`) et ajuster les états (sélection, désactivation, visibilité) en JavaScript après `htmlToFragment`.
- **Composition de composants** : utiliser des balises `<slot name="...">` pour injecter des sous-composants via `slot.replaceWith(Composant.dom(...))`.
- **Conventions des composants UI** : exposer `html(data)` (chaîne HTML) et/ou `dom(data, actions)` (fragment interactif avec callbacks).
- Préférer la délégation d'événements lorsque les éléments sont recréés.
- Ne pas construire des classes Tailwind dynamiquement : écrire les classes complètes dans le code (ex: `"text-red-700"`, jamais `"text-" + couleur`).
- Ne jamais stocker dans le front une donnée de confiance comme un rôle, un prix définitif, un stock disponible ou un droit d'administration.
- Les fonctions et variables suivent les conventions de l'existant ; commentaires et textes utilisateur restent en français lorsque le produit le prévoit, noms techniques en anglais.
- Privilégier systématiquement `let` à `const` pour toutes les déclarations de variables (variables locales, sélecteurs DOM, calculs, fragments, objets). Ne réserver `const` qu'aux véritables constantes de configuration globales en majuscules (ex. `CLE_STOCKAGE`).
