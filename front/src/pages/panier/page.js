import { CartData } from "../../data/cart.js";
import { AuthData } from "../../data/auth.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { ListePanierView } from "../../ui/liste-panier/index.js";
import { RecapitulatifPanierView } from "../../ui/recapitulatif-panier/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Panier.
 * Stocke l'état du panier (articles, total, nombre d'articles) et les messages.
 */
let M = {
  articles: [],
  total: 0,
  nbArticles: 0,
  message: null,
};

let C = {};

/**
 * Charge l'état du panier depuis le module CartData.
 */
C.charger = function () {
  M.articles = CartData.obtenirArticles();
  M.total = CartData.calculerTotal();
  M.nbArticles = CartData.compterArticles();
};

/**
 * Modifie la quantité d'un article.
 *
 * @param {string} cle
 * @param {number} nouvelleQuantite
 */
C.handler_modifier_quantite = function (cle, nouvelleQuantite) {
  CartData.modifierQuantite(cle, nouvelleQuantite);
  C.charger();
  V.rafraichir();
};

/**
 * Supprime un article du panier.
 *
 * @param {string} cle
 */
C.handler_supprimer = function (cle) {
  let articleSupprime = M.articles.find((item) => item.cle === cle);
  CartData.supprimerArticle(cle);
  C.charger();
  if (articleSupprime) {
    M.message = {
      type: "info",
      texte: `« ${articleSupprime.nom} » a été retiré de votre panier.`,
    };
  }
  V.rafraichir();
};

/**
 * Valide le panier et redirige vers la validation finale ou la connexion.
 */
C.handler_valider_panier = function () {
  if (M.nbArticles === 0) {
    M.message = {
      type: "erreur",
      texte: "Votre panier est vide.",
    };
    V.rafraichir();
    return;
  }

  if (!AuthData.estConnecte()) {
    navigate("/connexion");
    return;
  }

  // Redirection vers le récapitulatif avant validation explicite (CMD-a)
  navigate("/validation-commande");
};

/**
 * Applique un code promotionnel.
 *
 * @param {string} code
 */
C.handler_appliquer_promo = function (code) {
  if (!code) {
    M.message = {
      type: "erreur",
      texte: "Veuillez saisir un code promo.",
    };
  } else {
    M.message = {
      type: "info",
      texte: `Le code promo « ${code} » n'est pas valide ou est expiré.`,
    };
  }
  V.rafraichir();
};

/**
 * Initialisation de la page panier au montage de la route.
 */
C.init = async function () {
  M.message = null;
  C.charger();
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

/**
 * Déduit l'interface HTML à partir du modèle M.
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Slot message
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Slot liste des articles
  let slotListe = pageFragment.querySelector('slot[name="liste-panier"]');
  if (slotListe) {
    slotListe.replaceWith(
      ListePanierView.dom(M.articles, {
        onModifierQuantite: C.handler_modifier_quantite,
        onSupprimer: C.handler_supprimer,
      })
    );
  }

  // Slot récapitulatif
  let slotRecap = pageFragment.querySelector('slot[name="recapitulatif"]');
  if (slotRecap) {
    slotRecap.replaceWith(
      RecapitulatifPanierView.dom(
        {
          total: M.total,
          nbArticles: M.nbArticles,
        },
        {
          onValider: C.handler_valider_panier,
          onAppliquerPromo: C.handler_appliquer_promo,
        }
      )
    );
  }

  return pageFragment;
};

export function PanierPage() {
  return C.init();
}
