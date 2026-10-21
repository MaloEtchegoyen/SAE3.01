import { CategoryData } from "../../data/category.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableCategoriesView } from "../../ui/table-categories/index.js";
import { FormulaireCategorieView } from "../../ui/formulaire-categorie/index.js";
import { ModalConfirmationView } from "../../ui/modal-confirmation/index.js";
import template from "./template.html?raw";

/**
 * Page « Gestion des catégories » dans l'administration (GOF-c).
 */

let M = {
  categories: null,
  formulaireOuvert: false,
  categorieEnEdition: null,
  categorieASupprimer: null,
  nouvelleCategorieId: null,
  message: null,
};

let C = {};

/**
 * Charge les catégories depuis l'API d'administration.
 */
C.charger = async function () {
  try {
    let categories = await CategoryData.fetchAllAdmin();
    M.categories = Array.isArray(categories) ? categories : [];
  } catch (erreur) {
    M.categories = null;
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
    M.categorieEnEdition = null;
  } else {
    M.formulaireOuvert = true;
    M.categorieEnEdition = null;
  }
  V.rafraichir();
};

/**
 * Ouvre le formulaire pré-rempli pour modifier une catégorie existante.
 *
 * @param {{ id: number, nom: string, description?: string, nombre_produits?: number }} categorie
 */
C.handler_ouvrir_edition = function (categorie) {
  if (!categorie) return;
  M.categorieEnEdition = { ...categorie };
  M.formulaireOuvert = true;
  M.message = null;
  V.rafraichir();

  // Scroll fluide vers le formulaire
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/**
 * Ferme le formulaire et réinitialise l'état d'édition.
 */
C.handler_fermer_formulaire = function () {
  M.formulaireOuvert = false;
  M.categorieEnEdition = null;
  V.rafraichir();
};

/**
 * Enregistre une catégorie (création ou mise à jour).
 *
 * @param {{ id?: number, nom: string, description: string }} donnees
 */
C.handler_enregistrer = async function (donnees) {
  try {
    if (donnees.id) {
      await CategoryData.update(donnees.id, donnees);
      M.message = { type: "succes", texte: `La catégorie « ${donnees.nom} » a été modifiée avec succès.` };
    } else {
      await CategoryData.create(donnees);
      M.message = { type: "succes", texte: `La catégorie « ${donnees.nom} » a été créée avec succès.` };
    }

    M.formulaireOuvert = false;
    M.categorieEnEdition = null;
    await C.charger();
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message || "Une erreur est survenue lors de l'enregistrement." };
  }

  V.rafraichir();
};

/**
 * Ouvre la modale de confirmation pour supprimer une catégorie.
 *
 * @param {{ id: number, nom: string, description?: string, nombre_produits?: number }} categorie
 */
C.handler_demander_suppression = function (categorie) {
  M.categorieASupprimer = categorie;
  let nb = categorie.nombre_produits ?? 0;
  if (nb > 0 && Array.isArray(M.categories)) {
    let autres = M.categories.filter((c) => Number(c.id) !== Number(categorie.id));
    M.nouvelleCategorieId = autres.length > 0 ? autres[0].id : "none";
  } else {
    M.nouvelleCategorieId = null;
  }
  M.message = null;
  V.rafraichir();
};

/**
 * Annule la suppression et ferme la modale.
 */
C.handler_annuler_suppression = function () {
  M.categorieASupprimer = null;
  M.nouvelleCategorieId = null;
  V.rafraichir();
};

/**
 * Exécute la suppression de la catégorie après confirmation de la modale.
 */
C.handler_confirmer_suppression = async function () {
  let cat = M.categorieASupprimer;
  if (!cat) return;

  let nb = cat.nombre_produits ?? 0;

  try {
    if (nb > 0) {
      if (M.nouvelleCategorieId === "none") {
        // Détacher les produits : ils deviennent sans catégorie
        await CategoryData.delete(cat.id, {
          actionProduits: "detach",
        });

        M.message = {
          type: "succes",
          texte: `La catégorie « ${cat.nom} » a été supprimée et ses ${nb} produit(s) sont désormais sans catégorie.`,
        };
      } else if (M.nouvelleCategorieId && Number(M.nouvelleCategorieId) > 0) {
        // Réaffecter vers la catégorie choisie
        let idCible = Number(M.nouvelleCategorieId);
        await CategoryData.delete(cat.id, {
          actionProduits: "reassign",
          nouvelleCategoryId: idCible,
        });

        let catCible = (M.categories || []).find((c) => Number(c.id) === idCible);
        let nomCible = catCible ? catCible.nom : "la nouvelle catégorie";

        M.message = {
          type: "succes",
          texte: `La catégorie « ${cat.nom} » a été supprimée et ses ${nb} produit(s) ont été réaffectés vers « ${nomCible} ».`,
        };
      } else {
        M.message = {
          type: "erreur",
          texte: "Veuillez sélectionner une action valide pour les produits rattachés.",
        };
        V.rafraichir();
        return;
      }
    } else {
      await CategoryData.delete(cat.id, {
        actionProduits: "bloquer",
      });

      M.message = {
        type: "succes",
        texte: `La catégorie « ${cat.nom} » a été supprimée avec succès.`,
      };
    }

    M.categorieASupprimer = null;
    M.nouvelleCategorieId = null;
    await C.charger();
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Impossible de supprimer la catégorie.",
    };
  }

  V.rafraichir();
};

/**
 * Point d'entrée de la page pour le routeur SPA.
 */
C.init = async function () {
  M.formulaireOuvert = false;
  M.categorieEnEdition = null;
  M.categorieASupprimer = null;
  M.nouvelleCategorieId = null;
  M.message = null;

  await C.charger();

  // Si non autorisé, rediriger vers la connexion admin
  if (M.categories === null) {
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
  let fragment = htmlToFragment(template);

  // Bouton bascule du formulaire
  let btnToggle = fragment.querySelector('[data-action="toggle-formulaire"]');
  let iconeToggle = fragment.querySelector('[data-ref="icone-toggle"]');
  let texteToggle = fragment.querySelector('[data-ref="texte-toggle"]');

  if (M.formulaireOuvert) {
    if (iconeToggle) iconeToggle.textContent = "✕";
    if (texteToggle) texteToggle.textContent = "Fermer le formulaire";
  } else {
    if (iconeToggle) iconeToggle.textContent = "+";
    if (texteToggle) texteToggle.textContent = "Nouvelle catégorie";
  }

  if (btnToggle) {
    btnToggle.addEventListener("click", C.handler_toggle_formulaire);
  }

  // Slot : message de notification
  let slotMessage = fragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Slot : formulaire de catégorie
  let slotFormulaire = fragment.querySelector('slot[name="formulaire"]');
  if (slotFormulaire) {
    if (M.formulaireOuvert) {
      slotFormulaire.replaceWith(
        FormulaireCategorieView.dom(
          { categorieEnEdition: M.categorieEnEdition },
          {
            onEnregistrer: C.handler_enregistrer,
            onAnnuler: C.handler_fermer_formulaire,
          }
        )
      );
    } else {
      slotFormulaire.remove();
    }
  }

  // Slot : tableau des catégories
  let slotTable = fragment.querySelector('slot[name="table"]');
  if (slotTable) {
    if (M.categories) {
      slotTable.replaceWith(
        TableCategoriesView.dom(M.categories, {
          onModifier: C.handler_ouvrir_edition,
          onSupprimer: C.handler_demander_suppression,
        })
      );
    } else {
      slotTable.remove();
    }
  }

  // Slot : modale de confirmation de suppression
  let slotModale = fragment.querySelector('slot[name="modale"]');
  if (slotModale) {
    if (M.categorieASupprimer) {
      let cat = M.categorieASupprimer;
      let nbProduits = cat.nombre_produits ?? 0;
      let autres = (M.categories || []).filter((c) => Number(c.id) !== Number(cat.id));

      if (nbProduits > 0) {
        let containerSelect = document.createElement("div");
        containerSelect.className = "mb-6 space-y-2";

        let label = document.createElement("label");
        label.className = "block text-sm font-semibold text-white";
        label.textContent = "Action pour les produits rattachés *";

        let select = document.createElement("select");
        select.className =
          "w-full rounded-xl border border-white/20 bg-brand px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none cursor-pointer";

        // Option 1 : Aucune catégorie (détacher les produits)
        let optAucune = document.createElement("option");
        optAucune.value = "none";
        optAucune.textContent = "Aucune catégorie (laisser les produits sans catégorie)";
        if (M.nouvelleCategorieId === "none") {
          optAucune.selected = true;
        }
        select.appendChild(optAucune);

        // Options suivantes : réaffecter vers une autre catégorie existante
        for (let autre of autres) {
          let opt = document.createElement("option");
          opt.value = String(autre.id);
          opt.textContent = `Réaffecter vers : ${autre.nom} (${autre.nombre_produits ?? 0} produit(s))`;
          if (String(autre.id) === String(M.nouvelleCategorieId)) {
            opt.selected = true;
          }
          select.appendChild(opt);
        }

        select.addEventListener("change", (e) => {
          let val = e.target.value;
          M.nouvelleCategorieId = val === "none" ? "none" : Number(val);
        });

        containerSelect.appendChild(label);
        containerSelect.appendChild(select);

        slotModale.replaceWith(
          ModalConfirmationView.dom(
            {
              titre: `Supprimer « ${cat.nom} » (${nbProduits} produit(s))`,
              message: `Cette catégorie contient ${nbProduits} produit(s). Choisissez ce que vous souhaitez faire de ces produits avant de confirmer la suppression :`,
              corps: containerSelect,
              boutonAnnuler: "Annuler",
              boutonConfirmer: "Confirmer la suppression",
            },
            {
              surConfirmer: C.handler_confirmer_suppression,
              surAnnuler: C.handler_annuler_suppression,
            }
          )
        );
      } else {
        // Catégorie vide : confirmation directe
        slotModale.replaceWith(
          ModalConfirmationView.dom(
            {
              titre: "Supprimer cette catégorie ?",
              message: `La catégorie « ${cat.nom} » ne contient aucun produit. Confirmez-vous sa suppression ?`,
              boutonAnnuler: "Annuler",
              boutonConfirmer: "Supprimer",
            },
            {
              surConfirmer: C.handler_confirmer_suppression,
              surAnnuler: C.handler_annuler_suppression,
            }
          )
        );
      }
    } else {
      slotModale.remove();
    }
  }

  return fragment;
};

let AdminCategoriesPage = C.init;

export { AdminCategoriesPage };
