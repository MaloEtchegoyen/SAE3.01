import { CartData } from "../../data/cart.js";
import { AuthData } from "../../data/auth.js";
import { ProductData } from "../../data/product.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { ListePanierView } from "../../ui/liste-panier/index.js";
import { RecapitulatifPanierView } from "../../ui/recapitulatif-panier/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Panier.
 * Stocke l'état du panier (articles, total, nombre d'articles),
 * les détails des produits pour l'édition in situ et les messages.
 */
let M = {
  articles: [],
  total: 0,
  nbArticles: 0,
  message: null,
  produitsDetails: {}, // { [produitId]: produitObjet }
  cleEdition: null,
  optionsChoisiesEdition: {},
  varianteActiveEdition: null,
};

let C = {};

/**
 * Charge l'état du panier depuis le module CartData et charge
 * les données de produits associées pour l'édition in situ des options (OPT-a, OPT-b, OPT-c).
 */
C.charger = async function () {
  M.articles = CartData.obtenirArticles();
  M.total = CartData.calculerTotal();
  M.nbArticles = CartData.compterArticles();

  // Chargement en arrière-plan des détails de chaque produit présent dans le panier
  let idProduits = [...new Set(M.articles.map((item) => item.produitId).filter(Boolean))];
  let promesses = idProduits.map(async (id) => {
    if (!M.produitsDetails[id]) {
      try {
        let detail = await ProductData.fetchDetail(id);
        if (detail) {
          M.produitsDetails[id] = detail;
        }
      } catch {
        // En cas d'erreur de chargement ponctuelle, ignorer sans bloquer le panier
      }
    }
  });

  await Promise.all(promesses);
};

/**
 * Modifie la quantité d'un article.
 *
 * @param {string} cle
 * @param {number} nouvelleQuantite
 */
C.handler_modifier_quantite = async function (cle, nouvelleQuantite) {
  CartData.modifierQuantite(cle, nouvelleQuantite);
  await C.charger();
  V.rafraichir();
};

/**
 * Supprime un article du panier.
 *
 * @param {string} cle
 */
C.handler_supprimer = async function (cle) {
  let articleSupprime = M.articles.find((item) => item.cle === cle);
  CartData.supprimerArticle(cle);
  if (M.cleEdition === cle) {
    M.cleEdition = null;
    M.optionsChoisiesEdition = {};
    M.varianteActiveEdition = null;
  }
  await C.charger();
  if (articleSupprime) {
    M.message = {
      type: "info",
      texte: `« ${articleSupprime.nom} » a été retiré de votre panier.`,
    };
  }
  V.rafraichir();
};

/**
 * Ouvre le volet d'édition in situ des options pour un article donné.
 *
 * @param {string} cle
 */
C.handler_ouvrir_edition = function (cle) {
  let article = M.articles.find((item) => item.cle === cle);
  if (!article) return;

  M.cleEdition = cle;
  M.optionsChoisiesEdition = {};
  M.message = null;

  let produitDetail = M.produitsDetails[article.produitId];
  let options = Array.isArray(produitDetail?.options) ? produitDetail.options : [];
  let variantes = Array.isArray(produitDetail?.variantes) ? produitDetail.variantes : [];

  // Pré-remplir les options choisies à partir de l'article dans le panier
  if (Array.isArray(article.options) && article.options.length > 0) {
    article.options.forEach((opt) => {
      M.optionsChoisiesEdition[opt.optionId] = opt.valeurId;
    });
  } else if (article.varianteId && variantes.length > 0) {
    let varArticle = variantes.find((v) => Number(v.id) === Number(article.varianteId));
    if (varArticle && Array.isArray(varArticle.valeur_ids)) {
      let vIds = varArticle.valeur_ids.map(Number);
      options.forEach((opt) => {
        let valTrouvee = opt.valeurs?.find((val) => vIds.includes(Number(val.id)));
        if (valTrouvee) {
          M.optionsChoisiesEdition[opt.id] = valTrouvee.id;
        }
      });
    }
  }

  // Si certaines options obligatoires ne sont pas encore affectées, sélectionner la 1re valeur
  options.forEach((opt) => {
    if (!M.optionsChoisiesEdition[opt.id] && Array.isArray(opt.valeurs) && opt.valeurs.length > 0) {
      if (opt.obligatoire || opt.valeurs.length === 1) {
        M.optionsChoisiesEdition[opt.id] = opt.valeurs[0].id;
      }
    }
  });

  // Résoudre la variante correspondante
  C.recalculerVarianteEdition(produitDetail);
  V.rafraichir();
};

/**
 * Ferme le volet d'édition in situ sans enregistrer.
 */
C.handler_fermer_edition = function () {
  M.cleEdition = null;
  M.optionsChoisiesEdition = {};
  M.varianteActiveEdition = null;
  V.rafraichir();
};

/**
 * Gère la modification d'une option lors de l'édition in situ (OPT-b, OPT-c).
 *
 * @param {number} optionId
 * @param {number} valeurId
 */
C.handler_choisir_option_edition = function (optionId, valeurId) {
  let article = M.articles.find((item) => item.cle === M.cleEdition);
  if (!article) return;

  let produitDetail = M.produitsDetails[article.produitId];
  let opt = produitDetail?.options?.find((o) => Number(o.id) === Number(optionId));

  if (Number(M.optionsChoisiesEdition[optionId]) === Number(valeurId) && opt && !opt.obligatoire) {
    delete M.optionsChoisiesEdition[optionId];
  } else {
    M.optionsChoisiesEdition[optionId] = valeurId;
  }

  C.recalculerVarianteEdition(produitDetail);
  V.rafraichir();
};

/**
 * Détermine la variante active en fonction des options choisies dans le panneau d'édition.
 *
 * @param {object} produitDetail
 */
C.recalculerVarianteEdition = function (produitDetail) {
  if (!produitDetail) {
    M.varianteActiveEdition = null;
    return;
  }

  let variantes = Array.isArray(produitDetail.variantes) ? produitDetail.variantes : [];
  let variantesAvecValeurs = variantes.filter(
    (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
  );

  if (variantesAvecValeurs.length > 0) {
    let idsChoisis = Object.values(M.optionsChoisiesEdition).map(Number).sort((a, b) => a - b);
    let varianteTrouvee = variantesAvecValeurs.find((v) => {
      let vIds = (v.valeur_ids || []).map(Number).sort((a, b) => a - b);
      if (vIds.length !== idsChoisis.length) return false;
      for (let k = 0; k < vIds.length; k++) {
        if (vIds[k] !== idsChoisis[k]) return false;
      }
      return true;
    });

    M.varianteActiveEdition = varianteTrouvee || null;
  } else {
    M.varianteActiveEdition = variantes.length > 0 ? variantes[0] : null;
  }
};

/**
 * Enregistre les modifications d'options pour l'article en cours d'édition (OPT-a).
 *
 * @param {string} cle
 */
C.handler_valider_edition = async function (cle) {
  let article = M.articles.find((item) => item.cle === cle);
  if (!article) return;

  let produitDetail = M.produitsDetails[article.produitId];
  if (!produitDetail) return;

  let variante = M.varianteActiveEdition;
  let optionsProduit = Array.isArray(produitDetail.options) ? produitDetail.options : [];

  // Vérification de stock disponible (OPT-b)
  let stockDispo = Number(variante?.stock !== undefined ? variante.stock : (produitDetail.stock ?? 99));
  if (stockDispo <= 0) {
    M.message = {
      type: "erreur",
      texte: "Cette combinaison d'options est épuisée et ne peut pas être choisie.",
    };
    V.rafraichir();
    return;
  }

  // Construction de la liste des options sélectionnées
  let optionsSelectionnees = [];
  optionsProduit.forEach((opt) => {
    let valId = M.optionsChoisiesEdition[opt.id];
    if (valId && Array.isArray(opt.valeurs)) {
      let v = opt.valeurs.find((val) => Number(val.id) === Number(valId));
      if (v) {
        optionsSelectionnees.push({
          optionId: opt.id,
          optionNom: opt.nom,
          valeurId: v.id,
          valeurNom: v.nom,
          surcout: Number(v.surcout || 0),
        });
      }
    }
  });

  CartData.modifierOptionsArticle(cle, {
    produit: produitDetail,
    variante,
    options: optionsSelectionnees,
  });

  M.cleEdition = null;
  M.optionsChoisiesEdition = {};
  M.varianteActiveEdition = null;
  M.message = {
    type: "succes",
    texte: `Les options de « ${produitDetail.nom} » ont été mises à jour avec succès.`,
  };

  await C.charger();
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
  M.cleEdition = null;
  M.optionsChoisiesEdition = {};
  M.varianteActiveEdition = null;
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
      ListePanierView.dom(
        M.articles,
        {
          cleEdition: M.cleEdition,
          optionsChoisiesEdition: M.optionsChoisiesEdition,
          varianteActiveEdition: M.varianteActiveEdition,
          produitsDetails: M.produitsDetails,
        },
        {
          onModifierQuantite: C.handler_modifier_quantite,
          onSupprimer: C.handler_supprimer,
          onOuvrirEdition: C.handler_ouvrir_edition,
          onFermerEdition: C.handler_fermer_edition,
          onChoisirOptionEdition: C.handler_choisir_option_edition,
          onValiderEdition: C.handler_valider_edition,
        }
      )
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

/**
 * Page de gestion du panier client.
 *
 * @returns {Promise<DocumentFragment>}
 */
export function PanierPage() {
  return C.init();
}
