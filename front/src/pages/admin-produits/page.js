import { ProductData } from "../../data/product.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableProduitsView } from "../../ui/table-produits/index.js";
import template from "./template.html?raw";

/**
 * Page « Gestion des produits » dans l'administration.
 */

let M = {
  produits: null,
  message: null,
};

let C = {};

/**
 * Charge les produits depuis le serveur.
 */
C.charger = async function () {
  try {
    M.produits = await ProductData.fetchAll();
    M.message = null;
  } catch (erreur) {
    M.produits = null;
    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";
    if (erreur.statut === 403) texte = "Accès réservé aux administrateurs.";
    M.message = { type: "erreur", texte };
  }
};

/**
 * Initialisation du contrôleur.
 */
C.init = async function () {
  M.message = null;
  await C.charger();

  if (M.produits === null) {
    navigate("/connexion-admin");
    return document.createDocumentFragment();
  }

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

  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  let slotProduits = pageFragment.querySelector('slot[name="produits"]');
  if (slotProduits) {
    slotProduits.replaceWith(
      TableProduitsView.dom(M.produits || [], {
        onModifier: (id) => {
          navigate(`/admin/produits/modifier?id=${id}`);
        },
      })
    );
  }

  return pageFragment;
};

export function AdminProduitsPage() {
  return C.init();
}

