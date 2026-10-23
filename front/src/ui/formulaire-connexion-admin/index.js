import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Formulaire de connexion administrateur. Il ne conserve rien et ne décide de rien : il
// transmet les identifiants saisis, et c'est le serveur qui accepte ou refuse.
let FormulaireConnexionAdminView = {
  html: function (data) {
    return genericRenderer(template, data);
  },

  /**
   * @param {{login: string}} data  Identifiant à pré-remplir.
   * @param {{surConnexion: (login: string, mdp: string) => void,
   *          surDeconnexion?: () => void}} actions
   */
  dom: function (data, actions) {
    let fragment = htmlToFragment(FormulaireConnexionAdminView.html(data));
    let formulaire = fragment.querySelector("form");

    formulaire.addEventListener("submit", (ev) => {
      // Sans cela, le navigateur enverrait le formulaire de manière classique,
      // en rechargeant la page.
      ev.preventDefault();
      actions.surConnexion(formulaire.elements.login.value.trim(), formulaire.elements.mdp.value);
    });

    let boutonDeconnexion = fragment.querySelector('[data-action="deconnexion"]');
    if (boutonDeconnexion && actions.surDeconnexion) {
      boutonDeconnexion.addEventListener("click", () => actions.surDeconnexion());
    }

    return fragment;
  },
};

export { FormulaireConnexionAdminView };
