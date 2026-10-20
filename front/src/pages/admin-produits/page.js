import { ProductData } from "../../data/product.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableProduitsView } from "../../ui/table-produits/index.js";
import { FormulaireProduitView } from "../../ui/formulaire-produit/index.js";
import { ModalConfirmationView } from "../../ui/modal-confirmation/index.js";
import template from "./template.html?raw";

/**
 * Page « Gestion des produits » dans l'administration.
 */

let M = {
  produits: null,
  categories: [],
  formulaireOuvert: false,
  produitEnEdition: null,
  message: null,
  produitASupprimer: null,
};

let C = {};

/**
 * Charge les produits et les catégories depuis le serveur.
 */
C.charger = async function () {
  try {
    let [produits, categories] = await Promise.all([
      ProductData.fetchAllAdmin(),
      ProductData.fetchCategoriesAdmin().catch(() => []),
    ]);
    M.produits = produits;
    M.categories = categories || [];
  } catch (erreur) {
    M.produits = null;
    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";
    if (erreur.statut === 403) texte = "Accès réservé aux administrateurs.";
    M.message = { type: "erreur", texte };
  }
};

/**
 * Bascule l'affichage du formulaire d'ajout.
 */
C.handler_toggle_formulaire = function () {
  if (M.formulaireOuvert) {
    M.formulaireOuvert = false;
    M.produitEnEdition = null;
  } else {
    M.formulaireOuvert = true;
    M.produitEnEdition = null;
  }
  V.rafraichir();
};

/**
 * Ouvre le formulaire pré-rempli pour modifier un produit.
 *
 * @param {{
 *   id: number,
 *   nom: string,
 *   category_id: number|null,
 *   categorie?: string,
 *   prix: number,
 *   stock: number,
 *   seuil_alerte: number,
 *   description?: string|null
 * }|number} produitOuId
 */
C.handler_ouvrir_edition = async function (produitOuId) {
  let produit =
    typeof produitOuId === "object" && produitOuId !== null
      ? produitOuId
      : (M.produits || []).find((p) => p.id === Number(produitOuId));

  if (!produit) return;

  M.produitEnEdition = produit;
  M.formulaireOuvert = true;
  M.message = null;
  V.rafraichir();

  try {
    let detail = await ProductData.fetchDetail(produit.id);
    if (detail && M.produitEnEdition && M.produitEnEdition.id === produit.id) {
      M.produitEnEdition = detail;
      V.rafraichir();
    }
  } catch {
    // Si la requête de détail échoue, conserver le produit actuel
  }
};

/**
 * Ferme le formulaire et réinitialise l'état d'édition.
 */
C.handler_fermer_formulaire = function () {
  M.formulaireOuvert = false;
  M.produitEnEdition = null;
  V.rafraichir();
};

/**
 * Soumission du formulaire d'ajout de produit.
 *
 * @param {{
 *   nom: string,
 *   prix: number,
 *   category_id: number|null,
 *   stock: number,
 *   seuil_alerte: number,
 *   description: string|null,
 *   images?: string[],
 *   image?: string|null
 * }} donnees
 */
C.handler_ajouter_produit = async function (donnees) {
  try {
    let donneesProduit = {
      nom: donnees.nom,
      prix: donnees.prix,
      category_id: donnees.category_id,
      stock: donnees.stock,
      seuil_alerte: donnees.seuil_alerte,
      description: donnees.description,
      fichiers: donnees.fichiers,
      image_principale_index: donnees.image_principale_index,
    };
    let reponse = await ProductData.create(donneesProduit);
    M.message = {
      type: "succes",
      texte: reponse?.message || "Produit créé avec succès.",
    };
    M.formulaireOuvert = false;
    await C.charger();
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la création du produit.",
    };
  }

  V.rafraichir();
};

/**
 * Demande la confirmation de suppression d'un produit.
 *
 * @param {{ id: number, nom: string }} produit
 */
C.handler_demander_suppression = function (produit) {
  M.produitASupprimer = produit;
  V.rafraichir();
};

/**
 * Annule la suppression en cours.
 */
C.handler_annuler_suppression = function () {
  M.produitASupprimer = null;
  V.rafraichir();
};

/**
 * Confirme et effectue la suppression d'un produit.
 *
 * @param {number} id
 */
C.handler_confirmer_suppression = async function (id) {
  try {
    let reponse = await ProductData.delete(id);
    M.message = {
      type: "succes",
      texte: reponse?.message || "Produit supprimé avec succès.",
    };
    M.produitASupprimer = null;
    await C.charger();
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la suppression du produit.",
    };
    M.produitASupprimer = null;
  }

  V.rafraichir();
};

/**
 * Soumission du formulaire de modification de produit.
 *
 * @param {{
 *   id?: number,
 *   nom: string,
 *   prix: number,
 *   category_id: number|null,
 *   stock: number,
 *   seuil_alerte: number,
 *   description: string|null,
 *   fichiers?: File[],
 *   images_conservees_ids?: number[],
 *   image_principale_id?: number|null,
 *   image_principale_index?: number
 * }} donnees
 */
C.handler_modifier_produit = async function (donnees) {
  let id = donnees.id || M.produitEnEdition?.id;
  if (!id) return;

  try {
    let donneesProduit = {
      nom: donnees.nom,
      prix: donnees.prix,
      category_id: donnees.category_id,
      stock: donnees.stock,
      seuil_alerte: donnees.seuil_alerte,
      description: donnees.description,
      fichiers: donnees.fichiers,
      images_conservees_ids: donnees.images_conservees_ids,
      image_principale_id: donnees.image_principale_id,
      image_principale_index: donnees.image_principale_index,
    };
    let reponse = await ProductData.update(id, donneesProduit);
    M.message = {
      type: "succes",
      texte: reponse?.message || "Produit mis à jour avec succès.",
    };
    M.formulaireOuvert = false;
    M.produitEnEdition = null;
    await C.charger();
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la modification du produit.",
    };
  }

  V.rafraichir();
};

/**
 * Initialisation du contrôleur.
 */
C.init = async function () {
  M.message = null;
  M.formulaireOuvert = false;
  M.produitEnEdition = null;
  M.produitASupprimer = null;
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

  let btnToggle = pageFragment.querySelector('[data-action="toggle-formulaire"]');
  if (btnToggle) {
    btnToggle.textContent =
      M.formulaireOuvert && !M.produitEnEdition
        ? "Fermer le formulaire"
        : "Ajouter un produit";
    btnToggle.addEventListener("click", () => {
      if (M.formulaireOuvert && M.produitEnEdition) {
        M.produitEnEdition = null;
        V.rafraichir();
      } else {
        C.handler_toggle_formulaire();
      }
    });
  }

  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  let slotFormulaire = pageFragment.querySelector('slot[name="formulaire"]');
  if (slotFormulaire) {
    if (M.formulaireOuvert) {
      slotFormulaire.replaceWith(
        FormulaireProduitView.dom(
          {
            categories: M.categories,
            produit: M.produitEnEdition,
          },
          {
            surSoumission: M.produitEnEdition
              ? C.handler_modifier_produit
              : C.handler_ajouter_produit,
            surAnnulation: C.handler_fermer_formulaire,
          }
        )
      );
    } else {
      slotFormulaire.remove();
    }
  }

  let slotProduits = pageFragment.querySelector('slot[name="produits"]');
  if (slotProduits) {
    slotProduits.replaceWith(
      TableProduitsView.dom(M.produits || [], {
        onModifier: (produit) => {
          C.handler_ouvrir_edition(produit);
        },
        onSupprimer: (produit) => {
          C.handler_demander_suppression(produit);
        },
      })
    );
  }

  let slotModale = pageFragment.querySelector('slot[name="modale"]');
  if (slotModale) {
    if (M.produitASupprimer) {
      slotModale.replaceWith(
        ModalConfirmationView.dom(
          {
            titre: "Confirmer la suppression",
            message: `Êtes-vous sûr de vouloir supprimer le produit « ${M.produitASupprimer.nom} » ?`,
            boutonConfirmer: "Supprimer",
            boutonAnnuler: "Annuler",
          },
          {
            surConfirmer: () => C.handler_confirmer_suppression(M.produitASupprimer.id),
            surAnnuler: () => C.handler_annuler_suppression(),
          }
        )
      );
    } else {
      slotModale.remove();
    }
  }

  return pageFragment;
};

export function AdminProduitsPage() {
  return C.init();
}

