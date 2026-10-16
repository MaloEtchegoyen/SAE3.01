import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne-produit.html?raw";
import templateVide from "./vide.html?raw";

/**
 * Vue présentative du tableau des produits.
 */
let TableProduitsView = {
  /**
   * @param {Array<{
   *   id: number,
   *   nom: string,
   *   categorie: string,
   *   prix: number,
   *   stock: number,
   *   seuil_alerte: number,
   *   description?: string|null
   * }>} produits
   * @param {{ onModifier?: (id: number) => void }} [actions]
   */
  dom: function (produits, actions = {}) {
    if (!produits || produits.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let lignes = produits.map((p) => {
      let ligneFrag = htmlToFragment(
        genericRenderer(templateLigne, {
          id: p.id,
          nom: p.nom,
          categorie: p.categorie || "Sans catégorie",
          prix: formaterPrix(p.prix),
          stock: p.stock ?? 0,
          seuil_alerte: p.seuil_alerte ?? 0,
        })
      );

      if (actions.onModifier) {
        let btn = ligneFrag.querySelector('[data-action="modifier"]');
        if (btn) {
          btn.addEventListener("click", () => actions.onModifier(p.id));
        }
      }

      return ligneFrag;
    });

    fragment.querySelector("tbody").append(...lignes);
    return fragment;
  },
};

export { TableProduitsView };

