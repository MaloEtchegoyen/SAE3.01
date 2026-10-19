import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

/**
 * Composant UI RecapitulatifPanierView.
 * Affiche le récapitulatif du panier (total, nombre d'articles, bouton validation, code promo).
 */
let RecapitulatifPanierView = {
  /**
   * Construit le DOM du récapitulatif.
   *
   * @param {{
   *   total: number,
   *   nbArticles: number
   * }} donnees
   * @param {{
   *   onValider?: () => void,
   *   onAppliquerPromo?: (code: string) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (donnees = {}, actions = {}) {
    const total = Number(donnees.total || 0);
    const nbArticles = Number(donnees.nbArticles || 0);
    const estVide = nbArticles === 0;

    const texteArticles =
      nbArticles > 1 ? `${nbArticles} produits` : `${nbArticles} produit`;

    const htmlString = genericRenderer(template, {
      total: formaterPrix(total),
      nb_produits: texteArticles,
      disabled_si_vide: estVide ? "disabled" : "",
    });

    const fragment = htmlToFragment(htmlString);

    const btnValider = fragment.querySelector('[data-action="valider-panier"]');
    if (btnValider && !estVide) {
      btnValider.addEventListener("click", () => {
        actions?.onValider?.();
      });
    }

    const formPromo = fragment.querySelector('[data-ref="form-code-promo"]');
    if (formPromo) {
      formPromo.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = formPromo.querySelector('input[name="code"]');
        const code = input ? input.value.trim() : "";
        actions?.onAppliquerPromo?.(code);
      });
    }

    return fragment;
  },
};

export { RecapitulatifPanierView };

