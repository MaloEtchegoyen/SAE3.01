import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Composant UI pour le formulaire de connexion.
 * Reçoit les données à afficher et délègue les événements via actions.
 */
let FormulaireConnexionView = {
  html: function (data = {}) {
    return genericRenderer(template, {
      login: data.login ?? "",
    });
  },

  /**
   * @param {{login?: string, afficherDeconnexion?: boolean}} data
   * @param {{
   *   surConnexion?: (login: string, mdp: string) => void,
   *   surDeconnexion?: () => void,
   *   surBasculeInscription?: () => void
   * }} actions
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(FormulaireConnexionView.html(data));
    let formulaire = fragment.querySelector("form");

    if (formulaire && typeof actions?.surConnexion === "function") {
      formulaire.addEventListener("submit", (ev) => {
        ev.preventDefault();
        actions.surConnexion(
          formulaire.elements.login?.value.trim() ?? "",
          formulaire.elements.mdp?.value ?? ""
        );
      });
    }

    let btnDeconnexion = fragment.querySelector('[data-action="deconnexion"]');
    if (btnDeconnexion) {
      if (data.afficherDeconnexion && typeof actions?.surDeconnexion === "function") {
        btnDeconnexion.classList.remove("hidden");
        btnDeconnexion.addEventListener("click", () => actions.surDeconnexion());
      } else {
        btnDeconnexion.remove();
      }
    }

    let btnBascule = fragment.querySelector('[data-action="basculer-inscription"]');
    if (btnBascule) {
      if (typeof actions?.surBasculeInscription === "function") {
        btnBascule.addEventListener("click", () => actions.surBasculeInscription());
      } else {
        btnBascule.parentElement?.remove();
      }
    }

    return fragment;
  },
};

export { FormulaireConnexionView };
