import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Vue présentative pour une modale / popup de confirmation.
 */
let ModalConfirmationView = {
  /**
   * Construit le DOM de la modale de confirmation.
   *
   * @param {{
   *   titre?: string,
   *   message?: string,
   *   boutonConfirmer?: string,
   *   boutonAnnuler?: string
   * }} data Données textuelles affichées dans la modale.
   * @param {{
   *   surConfirmer?: () => void,
   *   surAnnuler?: () => void
   * }} actions Callbacks d'action.
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        titre: data.titre || "Confirmation",
        message: data.message || "Êtes-vous sûr de vouloir effectuer cette action ?",
        boutonConfirmer: data.boutonConfirmer || "Confirmer",
        boutonAnnuler: data.boutonAnnuler || "Annuler",
      })
    );

    let btnConfirmer = fragment.querySelector('[data-action="confirmer"]');
    if (btnConfirmer && typeof actions.surConfirmer === "function") {
      btnConfirmer.addEventListener("click", () => actions.surConfirmer());
    }

    let btnAnnuler = fragment.querySelector('[data-action="annuler"]');
    if (btnAnnuler && typeof actions.surAnnuler === "function") {
      btnAnnuler.addEventListener("click", () => actions.surAnnuler());
    }

    let backdrop = fragment.querySelector('[role="dialog"]');
    if (backdrop && typeof actions.surAnnuler === "function") {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          actions.surAnnuler();
        }
      });
    }

    return fragment;
  },
};

export { ModalConfirmationView };

