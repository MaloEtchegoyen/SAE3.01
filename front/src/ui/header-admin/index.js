import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * HeaderView est le composant de navigation pour l'administration.
 */
let HeaderView = {
  html: function () {
    return template;
  },

  dom: function () {
    let fragment = htmlToFragment(template);

    let btnBurger = fragment.querySelector('[data-action="toggle-menu-admin"]');
    let navAdmin = fragment.querySelector('[data-ref="nav-admin"]');
    let iconeBurger = fragment.querySelector('[data-ref="icone-burger-admin"]');
    let iconeFermer = fragment.querySelector('[data-ref="icone-fermer-admin"]');

    if (btnBurger && navAdmin) {
      let toggleMenu = function (ouvrir) {
        let estOuvert = typeof ouvrir === "boolean" ? ouvrir : navAdmin.classList.contains("hidden");
        if (estOuvert) {
          navAdmin.classList.remove("hidden");
          navAdmin.classList.add("flex");
          btnBurger.setAttribute("aria-expanded", "true");
          btnBurger.setAttribute("aria-label", "Fermer le menu d'administration");
          iconeBurger?.classList.add("hidden");
          iconeFermer?.classList.remove("hidden");
        } else {
          navAdmin.classList.add("hidden");
          navAdmin.classList.remove("flex");
          btnBurger.setAttribute("aria-expanded", "false");
          btnBurger.setAttribute("aria-label", "Ouvrir le menu d'administration");
          iconeBurger?.classList.remove("hidden");
          iconeFermer?.classList.add("hidden");
        }
      };

      btnBurger.addEventListener("click", () => toggleMenu());

      let liens = navAdmin.querySelectorAll("a[data-link]");
      for (let lien of liens) {
        lien.addEventListener("click", () => {
          if (window.innerWidth < 768) {
            toggleMenu(false);
          }
        });
      }
    }

    return fragment;
  },
};

export { HeaderView };
export default HeaderView;
