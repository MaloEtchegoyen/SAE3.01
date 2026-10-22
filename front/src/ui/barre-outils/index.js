import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Barre d'outils, fil d'Ariane et filtres du catalogue (sélection des catégories sous forme de liste déroulante).
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

    let selectCategories = fragment.querySelector('[data-ref="select-categories"]');
    if (!selectCategories) return fragment;

    // Option par défaut : toutes les catégories
    let nbTotalGeneral = data.totalGeneral ?? (Array.isArray(data.produits) ? data.produits.length : 0);
    let optTous = document.createElement("option");
    optTous.value = "";
    optTous.className = "bg-strong text-white";
    optTous.textContent =
      nbTotalGeneral > 0 ? `Toutes les catégories (${nbTotalGeneral})` : "Toutes les catégories";
    let estTousActif = data.categorieActive === null || data.categorieActive === undefined;
    if (estTousActif) {
      optTous.selected = true;
    }
    selectCategories.appendChild(optTous);

    // Options pour chaque catégorie
    let categories = Array.isArray(data.categories) ? data.categories : [];
    for (let cat of categories) {
      let opt = document.createElement("option");
      let slug = cat.slug || String(cat.id);
      opt.value = slug;
      opt.dataset.id = String(cat.id);
      opt.className = "bg-strong text-white";
      let nbCat = cat.nbProduits !== undefined ? ` (${cat.nbProduits})` : "";
      opt.textContent = `${cat.nom}${nbCat}`;
      let estActif =
        (data.categorieActive !== null && Number(data.categorieActive) === Number(cat.id)) ||
        (data.slugActif && data.slugActif === slug);
      if (estActif) {
        opt.selected = true;
      }
      selectCategories.appendChild(opt);
    }

    selectCategories.addEventListener("change", () => {
      let selectedOption = selectCategories.options[selectCategories.selectedIndex];
      let slug = selectedOption.value || null;
      let catId = selectedOption.dataset.id ? Number(selectedOption.dataset.id) : null;
      if (typeof actions.surChangementCategorie === "function") {
        actions.surChangementCategorie(catId, slug);
      }
    });

    return fragment;
  },
};

export { BarreOutilsView };
