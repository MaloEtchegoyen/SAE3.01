import { ProductData } from "../../data/product.js";
import { htmlToFragment } from "../../lib/utils.js";
import { GrilleFilmsView } from "../../ui/grille-films/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Catalogue ».
 *
 * Charge et affiche les produits du catalogue Café Feuillette via ProductData.
 */

let M = {
  produits: null,
  message: null,
};

let C = {};

/**
 * Demande la liste des produits et met à jour le modèle.
 */
C.charger = async function () {
  try {
    M.produits = await ProductData.fetchAll();
    M.message = null;
  } catch (erreur) {
    M.produits = null;
    let texte = `Impossible de charger le catalogue : ${erreur.message}`;
    if (erreur.statut === 401 || erreur.statut === 403) {
      texte = "Le catalogue des produits requiert une connexion (accès API restreint).";
    }
    M.message = { type: "erreur", texte };
  }
};

C.init = async function () {
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

  let slotBarre = pageFragment.querySelector('slot[name="barre-outils"]');
  if (slotBarre) slotBarre.remove();

  pageFragment.querySelector('slot[name="grille"]').replaceWith(GrilleFilmsView.dom(M.produits));

  let slotPagination = pageFragment.querySelector('slot[name="pagination"]');
  if (slotPagination) slotPagination.remove();

  return pageFragment;
};

export function CataloguePage() {
  return C.init();
}
