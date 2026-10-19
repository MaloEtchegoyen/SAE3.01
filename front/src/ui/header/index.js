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
    const nb = data.nbArticles ?? data.nb ?? 0;
    return template
      .replace("{{nb}}", String(nb))
      .replace('data-ref="logo"', `data-ref="logo" src="${logoUrl}"`);
  },

  dom: function (data = {}, actions = {}) {
    const nb = data.nbArticles ?? data.nb ?? 0;
    const html = template
      .replace("{{nb}}", String(nb))
      .replace('data-ref="logo"', `data-ref="logo" src="${logoUrl}"`);
    let fragment = htmlToFragment(html);

    let btnLogout = fragment.querySelector('[data-action="logout"]');
    if (btnLogout && typeof actions?.onLogout === "function") {
      btnLogout.addEventListener("click", actions.onLogout);
    }

    return fragment;
  },
};

export { HeaderView };
