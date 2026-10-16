import { htmlToFragment } from "../../lib/utils.js";
import { CarteProduitView } from "../carte-produit/index.js";
import template from "./template.html?raw";
import templateVide from "./vide.html?raw";

// Grille de cartes. Elle compose CarteProduitView : les
// cartes prennent la place du <slot name="cartes">.
let GrilleFilmsView = {
  dom: function (produits = [], actions = {}) {
    if (!produits || produits.length === 0) {
      return htmlToFragment(templateVide);
    }

    let fragment = htmlToFragment(template);
    let cartes = produits.map((produit) => CarteProduitView.dom(produit, actions));
    fragment.querySelector('slot[name="cartes"]').replaceWith(...cartes);
    return fragment;
  },
};

export { GrilleFilmsView };
