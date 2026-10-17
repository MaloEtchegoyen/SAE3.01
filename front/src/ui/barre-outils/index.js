import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

const CLASSE_BOUTON_ACTIF =
  "px-4 py-2 rounded-xl text-sm font-medium transition-all bg-input text-default border border-border shadow-xs cursor-pointer inline-flex items-center";
const CLASSE_BOUTON_INACTIF =
  "px-4 py-2 rounded-xl text-sm font-medium transition-all bg-brand text-default border border-border hover:bg-input-hover cursor-pointer inline-flex items-center";

/**
 * Barre d'outils, fil d'Ariane et filtres du catalogue (catégories sous forme de liens / pilules).
 *
 * Composant purement présentatif : il reçoit la liste des catégories, la catégorie
 * sélectionnée, le fil d'Ariane et le total, et signale les changements via les callbacks dans `actions`.
 */
let BarreOutilsView = {
  html: function (data = {}) {
    return genericRenderer(template, {
      total: data.total ?? "",
      arianeActif: data.arianeActif ?? "Tous les produits",
    });
  },

  /**
   * @param {{
   *   categories: Array<{ id: number, nom: string, slug?: string, nbProduits?: number }>,
   *   categorieActive: number|null,
   *   slugActif?: string|null,
   *   arianeActif?: string,
   *   totalGeneral?: number,
   *   total: number
   * }} data
   * @param {{
   *   surChangementCategorie?: (id: number|null, slug?: string|null) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let nbTotal = data.total ?? 0;
    let libelleTotal = `${nbTotal} produit${nbTotal > 1 ? "s" : ""} affiché${nbTotal > 1 ? "s" : ""}`;
    let arianeActif = data.arianeActif || "Tous les produits";

    let fragment = htmlToFragment(
      BarreOutilsView.html({
        total: libelleTotal,
        arianeActif: arianeActif,
      })
    );

    let conteneurCategories = fragment.querySelector('[data-ref="categories"]');
    if (!conteneurCategories) return fragment;

    // Lien « Tous les produits »
    let btnTous = document.createElement("a");
    btnTous.href = "/";
    btnTous.setAttribute("data-link", "");
    btnTous.setAttribute("role", "button");
    let nbTotalGeneral = data.totalGeneral ?? (Array.isArray(data.produits) ? data.produits.length : 0);
    btnTous.textContent =
      nbTotalGeneral > 0 ? `Tous les produits (${nbTotalGeneral})` : "Tous les produits";
    let estTousActif = data.categorieActive === null || data.categorieActive === undefined;
    btnTous.className = estTousActif ? CLASSE_BOUTON_ACTIF : CLASSE_BOUTON_INACTIF;
    btnTous.setAttribute("aria-pressed", estTousActif ? "true" : "false");
    btnTous.addEventListener("click", () => {
      if (typeof actions.surChangementCategorie === "function") {
        actions.surChangementCategorie(null, null);
      }
    });
    conteneurCategories.appendChild(btnTous);

    // Liens pour chaque catégorie
    const categories = Array.isArray(data.categories) ? data.categories : [];
    for (const cat of categories) {
      let lien = document.createElement("a");
      let slug = cat.slug || String(cat.id);
      lien.href = `/categorie/${slug}`;
      lien.setAttribute("data-link", "");
      lien.setAttribute("role", "button");
      let nbCat = cat.nbProduits !== undefined ? ` (${cat.nbProduits})` : "";
      lien.textContent = `${cat.nom}${nbCat}`;
      let estActif =
        (data.categorieActive !== null && Number(data.categorieActive) === Number(cat.id)) ||
        (data.slugActif && data.slugActif === slug);
      lien.className = estActif ? CLASSE_BOUTON_ACTIF : CLASSE_BOUTON_INACTIF;
      lien.setAttribute("aria-pressed", estActif ? "true" : "false");
      lien.addEventListener("click", () => {
        if (typeof actions.surChangementCategorie === "function") {
          actions.surChangementCategorie(cat.id, slug);
        }
      });
      conteneurCategories.appendChild(lien);
    }

    return fragment;
  },
};

export { BarreOutilsView };
