import { ProductData } from "../../data/product.js";
import { htmlToFragment } from "../../lib/utils.js";
import { slugifier } from "../../lib/format.js";
import { navigate } from "../../lib/router.js";
import { BarreOutilsView } from "../../ui/barre-outils/index.js";
import { GrilleProduitsView } from "../../ui/grille-produits/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue ».
 *
 * Charge et affiche les produits et les filtres de catégories du catalogue Café Feuillette.
 */

let M = {
  produits: null,
  categories: [],
  categorieActive: null,
  slugActif: null,
  message: null,
};

let C = {};

/**
 * Demande la liste des produits et des catégories et met à jour le modèle.
 */
C.charger = async function () {
  try {
    let [produits, categories] = await Promise.all([
      ProductData.fetchAll(),
      ProductData.fetchCategories().catch(() => []),
    ]);

    M.produits = produits;
    let categoriesBrutes =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : C.extraireCategories(produits);

    M.categories = categoriesBrutes.map((cat) => ({
      ...cat,
      slug: cat.slug || slugifier(cat.nom),
    }));
    M.message = null;
  } catch (erreur) {
    M.produits = null;
    M.categories = [];
    M.message = {
      type: "erreur",
      texte: `Impossible de charger le catalogue : ${erreur.message}`,
    };
  }
};

/**
 * Extrait la liste des catégories uniques à partir des produits (secours si l'API catégories est indisponible).
 *
 * @param {Array<object>|null} produits
 * @returns {Array<{ id: number, nom: string, slug: string }>}
 */
C.extraireCategories = function (produits) {
  if (!Array.isArray(produits)) return [];
  let mapCategories = new Map();

  for (let p of produits) {
    if (p.category_id && p.categorie && !mapCategories.has(p.category_id)) {
      mapCategories.set(p.category_id, {
        id: p.category_id,
        nom: p.categorie,
        slug: slugifier(p.categorie),
      });
    }
  }

  return Array.from(mapCategories.values());
};

/**
 * Filtre les produits selon la catégorie actuellement sélectionnée dans le modèle.
 *
 * @returns {Array<object>}
 */
C.obtenirProduitsFiltres = function () {
  if (!Array.isArray(M.produits)) return [];
  if (M.categorieActive === null || M.categorieActive === undefined) {
    return M.produits;
  }

  return M.produits.filter(
    (produit) => Number(produit.category_id) === Number(M.categorieActive)
  );
};

/**
 * Lit la catégorie active à partir des paramètres d'URL (?categorie=X).
 *
 * @returns {number|null}
 */
C.lireCategorieDepuisUrl = function () {
  let params = new URLSearchParams(window.location.search);
  let cat = params.get("categorie");
  return cat !== null && cat !== "" ? Number(cat) : null;
};

/**
 * Applique le filtre de catégorie en fonction des paramètres de route (/categorie/:slug)
 * ou, à défaut, des paramètres d'URL classiques (?categorie=X).
 *
 * @param {{ slug?: string }} params
 */
C.appliquerParametres = function (params = {}) {
  let slug = params?.slug;

  // Rétrocompatibilité : si aucun slug dans l'URL propre, regarder les query params
  if (!slug) {
    let catQuery = C.lireCategorieDepuisUrl();
    if (catQuery !== null) {
      slug = String(catQuery);
    }
  }

  if (slug) {
    let cat = M.categories.find(
      (c) =>
        (c.slug && c.slug === slug) ||
        slugifier(c.nom) === slug ||
        String(c.id) === String(slug)
    );

    if (cat) {
      M.categorieActive = cat.id;
      M.slugActif = cat.slug || slugifier(cat.nom);
      M.message = null;
    } else {
      M.categorieActive = -1;
      M.slugActif = slug;
      M.message = {
        type: "info",
        texte: `La catégorie « ${slug} » n'existe pas ou ne contient aucun produit.`,
      };
    }
  } else {
    M.categorieActive = null;
    M.slugActif = null;
    M.message = null;
  }
};

/**
 * Met à jour l'URL sans recharger la page pour refléter la catégorie sélectionnée sous forme propre (/categorie/slug).
 *
 * @param {string|null} slug
 */
C.synchroniserUrl = function (slug) {
  let cible = slug ? `/categorie/${slug}` : "/";
  navigate(cible);
};

/**
 * Calcule pour chaque catégorie son nombre de produits associés.
 *
 * @returns {Array<{ id: number, nom: string, slug: string, nbProduits: number }>}
 */
C.obtenirCategoriesAvecCompteurs = function () {
  if (!Array.isArray(M.produits)) return [];
  let compteurs = new Map();

  for (let p of M.produits) {
    let catId = Number(p.category_id);
    if (!Number.isNaN(catId)) {
      compteurs.set(catId, (compteurs.get(catId) || 0) + 1);
    }
  }

  return M.categories.map((cat) => ({
    ...cat,
    slug: cat.slug || slugifier(cat.nom),
    nbProduits: compteurs.get(Number(cat.id)) || 0,
  }));
};

/**
 * Action utilisateur : filtrer par catégorie et synchroniser l'URL propre.
 *
 * @param {number|null} idCategorie
 * @param {string|null} [slug=null]
 */
C.handler_filtrer_categorie = function (idCategorie, slug = null) {
  if (idCategorie === null || idCategorie === undefined) {
    C.synchroniserUrl(null);
    return;
  }

  if (!slug) {
    let cat = M.categories.find((c) => Number(c.id) === Number(idCategorie));
    slug = cat ? cat.slug : String(idCategorie);
  }

  C.synchroniserUrl(slug);
};

C.init = async function (params = {}) {
  if (M.produits === null) {
    await C.charger();
  }

  C.appliquerParametres(params);

  return V.init();
};

let V = {};

V.racine = null;

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  if (V.racine && V.racine.parentNode) {
    V.racine.replaceWith(fragment);
    V.racine = nouvelleRacine;
  }
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  pageFragment.querySelector('slot[name="message"]').replaceWith(MessageView.dom(M.message));

  if (M.produits === null) {
    for (let slot of pageFragment.querySelectorAll("slot")) {
      slot.remove();
    }
    return pageFragment;
  }

  let produitsFiltres = C.obtenirProduitsFiltres();
  let categoriesAvecCompteurs = C.obtenirCategoriesAvecCompteurs();
  let categorieActiveObj = M.categories.find(
    (c) => Number(c.id) === Number(M.categorieActive)
  );
  let arianeActif = categorieActiveObj ? categorieActiveObj.nom : "Tous les produits";

  let slotBarre = pageFragment.querySelector('slot[name="barre-outils"]');
  if (slotBarre) {
    slotBarre.replaceWith(
      BarreOutilsView.dom(
        {
          categories: categoriesAvecCompteurs,
          categorieActive: M.categorieActive,
          slugActif: M.slugActif,
          arianeActif: arianeActif,
          totalGeneral: M.produits.length,
          total: produitsFiltres.length,
        },
        {
          surChangementCategorie: (id, slug) => C.handler_filtrer_categorie(id, slug),
        }
      )
    );
  }

  pageFragment
    .querySelector('slot[name="grille"]')
    .replaceWith(GrilleProduitsView.dom(produitsFiltres));

  let slotPagination = pageFragment.querySelector('slot[name="pagination"]');
  if (slotPagination) slotPagination.remove();

  return pageFragment;
};

/**
 * Page publique du catalogue.
 *
 * @param {object} [params={}] Paramètres de route
 * @returns {Promise<DocumentFragment>}
 */
export function CataloguePage(params = {}) {
  return C.init(params);
}
