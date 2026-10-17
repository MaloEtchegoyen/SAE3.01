import { ProductData } from "../../data/product.js";
import { htmlToFragment } from "../../lib/utils.js";
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
  message: null,
};

let C = {};

/**
 * Demande la liste des produits et des catégories et met à jour le modèle.
 */
C.charger = async function () {
  try {
    const [produits, categories] = await Promise.all([
      ProductData.fetchAll(),
      ProductData.fetchCategories().catch(() => []),
    ]);

    M.produits = produits;
    M.categories =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : C.extraireCategories(produits);
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
 * @returns {Array<{ id: number, nom: string }>}
 */
C.extraireCategories = function (produits) {
  if (!Array.isArray(produits)) return [];
  const mapCategories = new Map();

  for (const p of produits) {
    if (p.category_id && p.categorie && !mapCategories.has(p.category_id)) {
      mapCategories.set(p.category_id, {
        id: p.category_id,
        nom: p.categorie,
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
 * Action utilisateur : filtrer par catégorie.
 *
 * @param {number|null} idCategorie
 */
C.handler_filtrer_categorie = function (idCategorie) {
  M.categorieActive = idCategorie;
  V.rafraichir();
};

C.init = async function () {
  M.categorieActive = null;
  await C.charger();
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
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
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

  let slotBarre = pageFragment.querySelector('slot[name="barre-outils"]');
  if (slotBarre) {
    slotBarre.replaceWith(
      BarreOutilsView.dom(
        {
          categories: M.categories,
          categorieActive: M.categorieActive,
          total: produitsFiltres.length,
        },
        {
          surChangementCategorie: (id) => C.handler_filtrer_categorie(id),
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

export function CataloguePage() {
  return C.init();
}
