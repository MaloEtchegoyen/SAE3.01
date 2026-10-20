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

    let fragment = htmlToFragment(template);
    let conteneurLignes = fragment.querySelector('[data-ref="liste-lignes"]');

    articles.forEach((article) => {
      let qte = Number(article.quantite || 1);
      let prixUnitaire = Number(article.prix || 0);
      let totalLigne = qte * prixUnitaire;
      let imageUrl = resoudreUrlImage(article.image);
      let optionNom = article.nomVariante ? String(article.nomVariante) : "";

      let ligneHtml = genericRenderer(ligneTemplate, {
        cle: article.cle,
        nom: article.nom,
        option: optionNom,
        classe_option: optionNom ? "" : "hidden",
        prix_unitaire: formaterPrix(prixUnitaire),
        quantite: String(qte),
        total_ligne: formaterPrix(totalLigne),
        image_url: imageUrl,
      });

      let ligneFragment = htmlToFragment(ligneHtml);
      let articleEl = ligneFragment.firstElementChild;

      let btnDiminuer = articleEl.querySelector('[data-action="diminuer"]');
      let btnAugmenter = articleEl.querySelector('[data-action="augmenter"]');
      let btnSupprimer = articleEl.querySelector('[data-action="supprimer"]');

      if (btnDiminuer) {
        btnDiminuer.disabled = qte <= 1;
        btnDiminuer.addEventListener("click", () => {
          if (qte > 1) {
            actions?.onModifierQuantite?.(article.cle, qte - 1);
          }
        });
      }

      if (btnAugmenter) {
        let stockMax = Number(article.stockMax || 99);
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

