---
name: ajouter-page
description: Guide pour créer une nouvelle page dynamique front dans le projet Café Feuillette en respectant l'architecture MVC locale (M, V, C) et la structure standardisée des pages (template.html avec slots, page.js, enregistrement dans le routeur).
---

# Ajouter une nouvelle page front (MVC)

Ce guide décrit la procédure pas-à-pas et les conventions architecturales à respecter pour créer une nouvelle page dynamique dans `front/src/pages/`, conformément à la structure des pages existantes (`catalogue`, `admin`, `admin-produits`).

## 1. Structure standard d'une page

Chaque page dynamique dispose de son propre répertoire dans `front/src/pages/<nom-de-page>/` composé de deux fichiers obligatoires :

1. `template.html` : Structure HTML sémantique de la page avec classes Tailwind complètes et des balises `<slot name="...">` pour injecter les composants UI dynamiques et les messages.
2. `page.js` : Implémentation du triplet MVC local, strictement isolé et sans pollution du scope global.

### Organisation interne de `page.js`

Le fichier `page.js` doit impérativement respecter les sections suivantes dans l'ordre :

1. **Imports** :
   - Modules de données (`../../data/*.js`)
   - Routeur si navigation programmatique nécessaire (`navigate` depuis `../../lib/router.js`)
   - Outils (`htmlToFragment` depuis `../../lib/utils.js`)
   - Vues et composants UI nécessaires (`../../ui/*/index.js`)
   - Template HTML brut (`import template from "./template.html?raw"`)
2. **Modèle local (`let M = { ... }`)** :
   - Contient l'état privé de la page (ex. données chargées, message `{ type, texte }`, pagination, filtres, visibilité de modales ou formulaires).
   - Strictement interdit d'accéder au DOM ou d'y stocker des nœuds HTML.
3. **Contrôleur local (`let C = { ... }`)** :
   - `C.charger(...)` : Méthode asynchrone qui appelle les modules de la couche `data/` via `try/catch` et stocke les données dans `M`.
   - Handlers d'actions `C.handler_*` : Fonctions réagissant aux actions utilisateurs reçues de la vue, mettant à jour `M` et appelant systématiquement `V.rafraichir()`.
   - `C.init()` : Méthode asynchrone appelée au montage de la route. Réinitialise l'état, charge les données initiales, gère les redirections de permissions (via `navigate()`), et renvoie `V.init()`.
4. **Vue locale (`let V = { ... }`)** :
   - `V.racine` : Référence vers l'élément DOM racine actuel de la page.
   - `V.init()` : Crée le fragment initial via `V.createPageFragment()`, mémorise `V.racine = fragment.firstElementChild` et retourne le fragment.
   - `V.rafraichir()` : Recrée entièrement le fragment à partir de l'état actuel de `M` (`let fragment = V.createPageFragment()`), remplace l'ancienne racine par `fragment` (`V.racine.replaceWith(fragment)`), et met à jour `V.racine`.
   - `V.createPageFragment()` : Parse le template avec `htmlToFragment(template)`, remplace chaque `<slot name="...">` par le rendu d'un composant (`ComposantView.dom(donnees, callbacks)`), gère la présence ou suppression des slots selon l'état de `M`, et retourne le fragment.
5. **Export de la page** :
   - Exporter une fonction unique (ex. `export function NomDeLaPage() { return C.init(); }`).

---

## 2. Démarche pas-à-pas

### Étape 1 : Analyser le besoin et concevoir la page
- Déterminer la route de la page (ex: `/mon-compte`, `/commandes`).
- Identifier les modules de données (`front/src/data/`) et composants UI (`front/src/ui/`) nécessaires (les créer ou adapter au préalable si besoin).
- Définir l'état local nécessaire dans le modèle `M`.

### Étape 2 : Créer le template HTML (`front/src/pages/<nom-de-page>/template.html`)
- Définir le conteneur principal avec les classes Tailwind CSS (sans concaténation dynamique).
- Placer des `<slot name="message"></slot>` et les slots dédiés aux composants UI.

### Étape 3 : Créer le contrôleur et la vue (`front/src/pages/<nom-de-page>/page.js`)
- Suivre scrupuleusement le squelette canonique ci-dessous.
- Toujours gérer les états de chargement, d'erreur et de succès via un composant `MessageView`.
- Si la page requiert une authentification, vérifier les droits dans `C.init()` ou `C.charger()` et rediriger via `navigate(...)` si non autorisé.

### Étape 4 : Déclarer la route dans `front/src/main.js`
- Importer la fonction de page :
  ```javascript
  import { MaNouvellePage } from "./pages/ma-nouvelle-page/page.js";
  ```
- Ajouter la route au routeur avec ou sans layout :
  ```javascript
  // Avec le layout par défaut (RootLayout) :
  router.addRoute("/ma-nouvelle-page", MaNouvellePage);

  // Ou sous un layout spécifique (ex: /admin) :
  router.addRoute("/admin/ma-page", MaNouvellePage);

  // Ou sans aucun layout :
  router.addRoute("/ma-nouvelle-page", MaNouvellePage, { useLayout: false });
  ```

### Étape 5 : Contrôler et valider
- Exécuter la vérification architecturale : `node .agents/skills/verifier-mvc/scripts/check-mvc.js`.
- Vérifier la compilation : `npm run build` dans le dossier `front`.

---

## 3. Squelette de code de référence

### Template (`template.html`)
```html
<section class="mx-auto max-w-5xl px-6 pt-10 pb-16">
  <h1 class="mb-6 text-2xl font-semibold tracking-tight text-feuillette-charbon">Titre de la Page</h1>

  <slot name="message"></slot>
  <slot name="contenu-principal"></slot>
</section>
```

### Page JavaScript (`page.js`)
```javascript
import { MonModuleData } from "../../data/mon-module.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { MonComposantView } from "../../ui/mon-composant/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page.
 * Ne touche jamais au DOM.
 */
let M = {
  donnees: null,
  message: null, // { type: "succes" | "erreur" | "info", texte: string }
};

let C = {};

/**
 * Chargement des données asynchrones.
 */
C.charger = async function () {
  try {
    M.donnees = await MonModuleData.fetch();
    M.message = null;
  } catch (erreur) {
    M.donnees = null;
    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";
    if (erreur.statut === 403) texte = "Accès réservé.";
    M.message = { type: "erreur", texte };
  }
};

/**
 * Handlers d'actions utilisateur.
 */
C.handler_action = async function (parametre) {
  try {
    await MonModuleData.action(parametre);
    M.message = { type: "succes", texte: "Action réalisée avec succès." };
    await C.charger();
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }
  V.rafraichir();
};

/**
 * Initialisation du contrôleur lors du montage de la route.
 */
C.init = async function () {
  M.message = null;
  await C.charger();

  // Redirection d'authentification si requis :
  // if (M.donnees === null) {
  //   navigate("/connexion-admin");
  //   return document.createDocumentFragment();
  // }

  return V.init();
};

let V = {};

V.racine = null;

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

/**
 * Reconstruit la vue et remplace l'ancienne racine DOM.
 */
V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

/**
 * Déduit l'interface HTML à partir de l'état M.
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  let slotContenu = pageFragment.querySelector('slot[name="contenu-principal"]');
  if (slotContenu) {
    if (M.donnees === null) {
      slotContenu.remove();
    } else {
      slotContenu.replaceWith(
        MonComposantView.dom(M.donnees, {
          surAction: C.handler_action,
        })
      );
    }
  }

  return pageFragment;
};

export function MaNouvellePage() {
  return C.init();
}
```

---

## 4. Règles et contraintes strictes

- **Séparation MVC stricte** :
  - Aucun appel réseau dans la vue (`V`) ou les composants `ui/` ;
  - Aucun accès au DOM ou rendu HTML dans le modèle (`M`) ou `data/`.
- **Remplacement complet du DOM via `V.rafraichir()`** : Ne pas modifier des éléments DOM au coup par coup dans les contrôleurs, toujours déduire l'affichage de l'état `M`.
- **Échappement XSS** : Les valeurs dynamiques injectées dans le DOM doivent être échappées (via `escapeHtml()` ou `textContent`).
- **Classes CSS Tailwind** : Utiliser des classes Tailwind complètes et statiques, jamais générées par interpolation dynamique de chaînes.

