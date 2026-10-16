import { htmlToFragment } from "../../lib/utils.js";
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
    return template.replace('data-ref="logo"', `data-ref="logo" src="${logoUrl}"`);
  },

  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(template);

    let imgLogo = fragment.querySelector('[data-ref="logo"]');
    if (imgLogo) {
      imgLogo.src = logoUrl;
    }

    let btnLogout = fragment.querySelector('[data-action="logout"]');
    if (btnLogout && typeof actions?.onLogout === "function") {
      btnLogout.addEventListener("click", actions.onLogout);
    }

    return fragment;
  },
};

export { HeaderView };
