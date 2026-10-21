import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";
import templateLigne from "./ligne-categorie.html?raw";
import templateVide from "./vide.html?raw";

/**
 * Vue présentative du tableau des catégories.
 */
let TableCategoriesView = {
  /**
   * @param {Array<{
   *   id: number,
   *   nom: string,
   *   description?: string,
   *   nombre_produits?: number
   * }>} categories
   * @param {{
   *   onModifier?: (categorie: { id: number, nom: string, description: string, nombre_produits: number }) => void,
   *   onSupprimer?: (categorie: { id: number, nom: string, description: string, nombre_produits: number }) => void
   * }} [actions]
   */
  dom: function (categories, actions = {}) {
    if (!categories || categories.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = categories.map((cat) => {
      let descAffichage = cat.description && cat.description.trim() !== ""
        ? cat.description.trim()
        : "Aucune description renseignée.";

      let ligneFrag = htmlToFragment(
        genericRenderer(templateLigne, {
          id: cat.id,
          nom: cat.nom,
          description: descAffichage,
          nombre_produits: cat.nombre_produits ?? 0,
        })
      );

      if (actions.onModifier) {
        let btnModifier = ligneFrag.querySelector('[data-action="modifier"]');
        if (btnModifier) {
          btnModifier.addEventListener("click", () => actions.onModifier(cat));
        }
      }

      if (actions.onSupprimer) {
        let btnSupprimer = ligneFrag.querySelector('[data-action="supprimer"]');
        if (btnSupprimer) {
          btnSupprimer.addEventListener("click", () => actions.onSupprimer(cat));
        }
      }

      return ligneFrag;
    });

    let tbody = fragment.querySelector("tbody");
    if (tbody) {
      tbody.append(...lignes);
    }

    return fragment;
  },
};

export { TableCategoriesView };

