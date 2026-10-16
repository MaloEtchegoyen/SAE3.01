import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

let StatistiquesView = {
  /**
   * @param {{ totalProduits: number, totalCategories: number }} stats
   * @param {{ onGererProduits?: () => void }} [actions]
   */
  dom: function (stats, actions = {}) {
    let fragment = htmlToFragment(
      genericRenderer(template, {
        totalProduits: stats.totalProduits ?? 0,
        totalCategories: stats.totalCategories ?? 0,
      })
    );

    if (actions.onGererProduits) {
      let bouton = fragment.querySelector("a[data-link]");
      if (bouton) {
        bouton.addEventListener("click", (e) => {
          e.preventDefault();
          actions.onGererProduits();
        });
      }
    }

    return fragment;
  },
};

export { StatistiquesView };
