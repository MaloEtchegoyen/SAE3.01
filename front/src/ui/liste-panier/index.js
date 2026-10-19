import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { resoudreUrlImage } from "../carte-produit/index.js";
import template from "./template.html?raw";
import ligneTemplate from "./ligne-panier.html?raw";
import videTemplate from "./vide.html?raw";

/**
 * Composant UI ListePanierView.
 * Affiche les lignes d'articles du panier et branche les événements de modification/suppression.
 */
let ListePanierView = {
  /**
   * Construit le DOM de la liste des articles.
   *
   * @param {Array<object>} articles
   * @param {{
   *   onModifierQuantite?: (cle: string, nouvelleQuantite: number) => void,
   *   onSupprimer?: (cle: string) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (articles = [], actions = {}) {
    if (!articles || articles.length === 0) {
      return htmlToFragment(videTemplate);
    }

    const fragment = htmlToFragment(template);
    const conteneurLignes = fragment.querySelector('[data-ref="liste-lignes"]');

    articles.forEach((article) => {
      const qte = Number(article.quantite || 1);
      const prixUnitaire = Number(article.prix || 0);
      const totalLigne = qte * prixUnitaire;
      const imageUrl = resoudreUrlImage(article.image);
      const optionNom = article.nomVariante ? String(article.nomVariante) : "";

      const ligneHtml = genericRenderer(ligneTemplate, {
        cle: article.cle,
        nom: article.nom,
        option: optionNom,
        classe_option: optionNom ? "" : "hidden",
        prix_unitaire: formaterPrix(prixUnitaire),
        quantite: String(qte),
        total_ligne: formaterPrix(totalLigne),
        image_url: imageUrl,
      });

      const ligneFragment = htmlToFragment(ligneHtml);
      const articleEl = ligneFragment.firstElementChild;

      const btnDiminuer = articleEl.querySelector('[data-action="diminuer"]');
      const btnAugmenter = articleEl.querySelector('[data-action="augmenter"]');
      const btnSupprimer = articleEl.querySelector('[data-action="supprimer"]');

      if (btnDiminuer) {
        btnDiminuer.disabled = qte <= 1;
        btnDiminuer.addEventListener("click", () => {
          if (qte > 1) {
            actions?.onModifierQuantite?.(article.cle, qte - 1);
          }
        });
      }

      if (btnAugmenter) {
        const stockMax = Number(article.stockMax || 99);
        btnAugmenter.disabled = qte >= stockMax;
        btnAugmenter.addEventListener("click", () => {
          if (qte < stockMax) {
            actions?.onModifierQuantite?.(article.cle, qte + 1);
          }
        });
      }

      if (btnSupprimer) {
        btnSupprimer.addEventListener("click", () => {
          actions?.onSupprimer?.(article.cle);
        });
      }

      conteneurLignes.appendChild(ligneFragment);
    });

    return fragment;
  },
};

export { ListePanierView };

