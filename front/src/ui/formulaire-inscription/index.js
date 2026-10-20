import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Composant UI pour le formulaire d'inscription.
 * Composant strictement présentatif : il valide les champs en front et
 * délègue le traitement aux callbacks d'actions fournis.
 */
let FormulaireInscriptionView = {
  html: function (data = {}) {
    return genericRenderer(template, {
      email: data.email ?? "",
    });
  },

  /**
   * @param {{email?: string}} data
   * @param {{
   *   surInscription?: (email: string, mdp: string, confirmation: string) => void,
   *   surBasculeConnexion?: () => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(FormulaireInscriptionView.html(data));
    let formulaire = fragment.querySelector("form");

    if (formulaire && typeof actions.surInscription === "function") {
      formulaire.addEventListener("submit", (ev) => {
        ev.preventDefault();
        let email = formulaire.elements.email?.value.trim() ?? "";
        let mdp = formulaire.elements.mdp?.value ?? "";
        let confirmation = formulaire.elements.confirmation?.value ?? "";
        actions.surInscription(email, mdp, confirmation);
      });
    }

    let btnBascule = fragment.querySelector('[data-action="basculer-connexion"]');
    if (btnBascule && typeof actions.surBasculeConnexion === "function") {
      btnBascule.addEventListener("click", () => {
        actions.surBasculeConnexion();
      });
    }

    return fragment;
  },
};

export { FormulaireInscriptionView };

