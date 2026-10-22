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
      .replaceAll("{{nb}}", String(nb))
      .replaceAll("{{libelleCompte}}", libelleCompte)
      .replaceAll("{{lienCompte}}", lienCompte)
      .replace('data-ref="logo"', `data-ref="logo" src="${logoUrl}"`);
  },

  dom: function (data = {}, actions = {}) {
    let html = HeaderView.html(data);
    let fragment = htmlToFragment(html);

    // Déconnexion desktop & mobile
    let btnLogout = fragment.querySelector('[data-action="logout"]');
    let btnLogoutMobile = fragment.querySelector('[data-action="logout-mobile"]');

    let attacherLogout = function (btn) {
      if (!btn) return;
      if (data.connecte && typeof actions?.onLogout === "function") {
        btn.addEventListener("click", actions.onLogout);
      } else {
        btn.remove();
      }
    };

    attacherLogout(btnLogout);
    attacherLogout(btnLogoutMobile);

    // Gestion du menu burger mobile
    let btnBurger = fragment.querySelector('[data-action="toggle-menu"]');
    let menuMobile = fragment.querySelector('[data-ref="menu-mobile"]');
    let iconeBurger = fragment.querySelector('[data-ref="icone-burger"]');
    let iconeFermer = fragment.querySelector('[data-ref="icone-fermer"]');

    if (btnBurger && menuMobile) {
      let toggleMenu = function (ouvrir) {
        let estOuvert = typeof ouvrir === "boolean" ? ouvrir : menuMobile.classList.contains("hidden");
        if (estOuvert) {
          menuMobile.classList.remove("hidden");
          menuMobile.classList.add("flex");
          btnBurger.setAttribute("aria-expanded", "true");
          btnBurger.setAttribute("aria-label", "Fermer le menu de navigation");
          iconeBurger?.classList.add("hidden");
          iconeFermer?.classList.remove("hidden");
        } else {
          menuMobile.classList.add("hidden");
          menuMobile.classList.remove("flex");
          btnBurger.setAttribute("aria-expanded", "false");
          btnBurger.setAttribute("aria-label", "Ouvrir le menu de navigation");
          iconeBurger?.classList.remove("hidden");
          iconeFermer?.classList.add("hidden");
        }
      };

      btnBurger.addEventListener("click", () => toggleMenu());

      // Fermeture automatique lors du clic sur un lien du menu mobile
      let liensMenu = menuMobile.querySelectorAll("a[data-link], button");
      for (let lien of liensMenu) {
        lien.addEventListener("click", () => toggleMenu(false));
      }
    }

    return fragment;
  },
};

export { HeaderView };
