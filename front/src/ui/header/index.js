import { escapeHtml, htmlToFragment } from "../../lib/utils.js";
import logoUrl from "../../../assets/logo/logo-cafe-feuillette-tours.svg";
import template from "./template.html?raw";

/**
 * HeaderView est le composant de navigation public (en-tête).
 *
 * @type {{
 *   html: (data?: object) => string,
 *   dom: (data?: object, actions?: { onLogout?: () => void }) => DocumentFragment
 * }}
 */
let HeaderView = {
  html: function (data = {}) {
    let nb = data.nbArticles ?? data.nb ?? 0;
    let connecte = Boolean(data.connecte);
    let libelleCompte = connecte
      ? (data.utilisateur ? `Mon compte` : "Mon compte")
      : "Connexion";
    let lienCompte = connecte ? "/compte" : "/connexion";

    return template
      .replace("{{nb}}", String(nb))
      .replace("{{libelleCompte}}", libelleCompte)
      .replace("{{lienCompte}}", lienCompte)
      .replace('data-ref="logo"', `data-ref="logo" src="${logoUrl}"`);
  },

  dom: function (data = {}, actions = {}) {
    let html = HeaderView.html(data);
    let fragment = htmlToFragment(html);

    let btnLogout = fragment.querySelector('[data-action="logout"]');
    if (btnLogout) {
      if (data.connecte && typeof actions?.onLogout === "function") {
        btnLogout.addEventListener("click", actions.onLogout);
      } else {
        btnLogout.remove();
      }
    }

    return fragment;
  },
};

export { HeaderView };
