---
trigger: always_on
---

# Architecture front-end et séparation MVC

Le front utilise des ES modules Vite et une séparation MVC **par page dynamique**, pas trois objets globaux dans un fichier unique.

- **M (Modèle)** : état de la page, appels aux modules `front/src/data/` et transformations métier. Il ne touche jamais au DOM et ne construit jamais de HTML.
- **V (Vue)** : templates HTML, `htmlToFragment`, rendu et branchement des événements DOM. Elle reçoit les données en paramètre et ne connaît pas l'état interne de M.
- **C (Contrôleur)** : chargement des données, validation des actions et callbacks entre M et V. C orchestre la page et ne devient pas un second stockage métier.

Une page dynamique suit le modèle présent dans `front/src/pages/catalogue/page.js` et `front/src/pages/admin/page.js` : état privé de page, contrôleurs d'actions, puis fonctions de rendu. La page exportée retourne `C.init()` au routeur.

Pour une nouvelle fonctionnalité, répartir systématiquement :
1. données et règles métier → M/data ;
2. templates, affichage et événements DOM → V/UI ;
3. orchestration et réactions → C/page.

---

## 1. Réactivité de la Vue (`V.rafraichir()`)

L'affichage découle strictement de l'état `M` :
- Après chaque interaction utilisateur ou modification d'état dans le contrôleur `C`, la vue appelle `V.rafraichir()`.
- `V.rafraichir()` reconstruit la totalité de la structure via `htmlToFragment`, réinjecte les composants dans leurs slots respectifs, et remplace d'un bloc l'ancienne racine DOM (`V.racine.replaceWith(nouveauFragment)`).
- **Interdiction de retouche partielle** : l'affichage se déduit de l'état, on ne manipule pas le DOM morceau par morceau au fil de l'eau.

---

## 2. Composants d'interface (`front/src/ui/`)

Un composant UI réside dans son propre sous-dossier avec `template.html` et `index.js` :
- **Signatures** : il expose `html(data)` (chaîne HTML pour rendu statique) et/ou `dom(data, actions)` (fragment DOM interactif avec callbacks d'actions).
- **Aucune boucle ni condition dans les templates HTML** : les templates ne supportent aucune directive de contrôle. Une collection s'affiche en répétant un sous-template unitaire par élément (ex: ligne ou carte), et les états conditionnels (classe active, bouton désactivé, visibilité) se règlent en JavaScript après conversion par `htmlToFragment`.
- **Composition par `<slot>`** : l'imbrication d'un composant dans un autre s'effectue obligatoirement via des balises `<slot name="...">`, remplacées en JS par `slot.replaceWith(SousComposant.dom(...))`.
- **Échappement XSS garanti** : les placeholders `{{cle}}` sont échappés par `genericRenderer` et ne génèrent que du texte brut.
- **Présentation pure** : les composants restent réutilisables, ne chargent pas l'API directement et délèguent les intentions utilisateur via l'objet `actions` (`surClic`, `surTri`, `surAjout`...).

---

## 3. Routeur SPA côté client (`front/src/lib/router.js`)

Le routeur associe les chemins d'URL aux layouts et aux pages dans `front/src/main.js` :
- **Attribut `data-link` obligatoire** : tout lien interne de navigation doit porter l'attribut `data-link` et un chemin relatif pur sans le chemin de base (ex: `<a href="/catalogue" data-link>Catalogue</a>`). Le routeur intercepte le clic, évite le rechargement navigateur et préfixe automatiquement `BASE`.
- **Indicateur de page active** : le routeur applique automatiquement l'attribut `aria-current="page"` sur le lien correspondant à l'URL affichée. Utiliser la syntaxe Tailwind dédiée : `aria-[current=page]:...`.
- **Hiérarchie des Layouts** : le layout est sélectionné par le préfixe d'adresse le plus long (ex: `/admin`). La page dynamique est injectée dans le `<slot>` principal non nommé du layout.
- **Paramètres de route dynamiques** : définis par `:param` (ex: `/produits/:id`) et transmis en argument à la fonction de page (`params.id`).
- **Route de repli (404)** : la route 404 (`router.addRoute("*", The404Page)`) doit impérativement être déclarée en toute dernière position dans `main.js`.
