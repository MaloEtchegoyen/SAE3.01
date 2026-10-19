import { htmlToFragment } from "../../lib/utils.js";
import { HeaderView } from "../../ui/header/index.js";
import { CartData } from "../../data/cart.js";
import template from "./template.html?raw";

// Variable pour mémoriser le désabonnement précédent et éviter les fuites
let desabonnementPanier = null;

/**
 * Layout principal : l'en-tête, puis la page affichée.
 *
 * Le slot nommé « header » est remplacé ici. Le slot sans nom est laissé au
 * routeur, qui y place la page.
 *
 * @returns {DocumentFragment}
 */
export function RootLayout() {
  let layout = htmlToFragment(template);
  layout
    .querySelector('slot[name="header"]')
    .replaceWith(HeaderView.dom({ nbArticles: CartData.compterArticles() }));

  if (typeof desabonnementPanier === "function") {
    desabonnementPanier();
  }

  desabonnementPanier = CartData.abonner(() => {
    const spanCompteur = document.querySelector('[data-ref="compteur-panier"]');
    if (spanCompteur) {
      spanCompteur.textContent = `Panier (${CartData.compterArticles()})`;
    }
  });

  return layout;
}
