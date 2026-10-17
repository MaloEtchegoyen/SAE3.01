import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

const CLASSE_BOUTON_ACTIF =
  "px-4 py-2 rounded-xl text-sm font-medium transition-all bg-input text-default border border-border shadow-xs cursor-pointer";
const CLASSE_BOUTON_INACTIF =
  "px-4 py-2 rounded-xl text-sm font-medium transition-all bg-brand text-default border border-border hover:bg-input-hover cursor-pointer";

/**
 * Barre d'outils et de filtres du catalogue (catégories sous forme de pilules).
 *
 * Composant purement présentatif : il reçoit la liste des catégories, la catégorie
 * sélectionnée et le total, et signale les changements via les callbacks dans `actions`.
 */
let BarreOutilsView = {
  html: function (data = {}) {
    return genericRenderer(template, data);
  },

  /**
   * @param {{
   *   categories: Array<{ id: number, nom: string }>,
   *   categorieActive: number|null,
   *   total: number
   * }} data
   * @param {{
   *   surChangementCategorie?: (id: number|null) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let nbTotal = data.total ?? 0;
    let libelleTotal = `${nbTotal} produit${nbTotal > 1 ? "s" : ""} affiché${nbTotal > 1 ? "s" : ""}`;

    let fragment = htmlToFragment(
      BarreOutilsView.html({
        total: libelleTotal,
      })
    );

    let conteneurCategories = fragment.querySelector('[data-ref="categories"]');
    if (!conteneurCategories) return fragment;

    // Bouton « Tous »
    let btnTous = document.createElement("button");
    btnTous.type = "button";
    btnTous.textContent = "Tous";
    let estTousActif = data.categorieActive === null || data.categorieActive === undefined;
    btnTous.className = estTousActif ? CLASSE_BOUTON_ACTIF : CLASSE_BOUTON_INACTIF;
    btnTous.setAttribute("aria-pressed", estTousActif ? "true" : "false");
    btnTous.addEventListener("click", () => {
      if (typeof actions.surChangementCategorie === "function") {
        actions.surChangementCategorie(null);
      }
    });
    conteneurCategories.appendChild(btnTous);

    // Boutons pour chaque catégorie
    const categories = Array.isArray(data.categories) ? data.categories : [];
    for (const cat of categories) {
      let btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = cat.nom;
      let estActif = Number(data.categorieActive) === Number(cat.id);
      btn.className = estActif ? CLASSE_BOUTON_ACTIF : CLASSE_BOUTON_INACTIF;
      btn.setAttribute("aria-pressed", estActif ? "true" : "false");
      btn.addEventListener("click", () => {
        if (typeof actions.surChangementCategorie === "function") {
          actions.surChangementCategorie(cat.id);
        }
      });
      conteneurCategories.appendChild(btn);
    }

    return fragment;
  },
};

export { BarreOutilsView };
