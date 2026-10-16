import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import defaultImageUrl from "../../../assets/back/cafeFeuillette-desktop.jpg";
import template from "./template.html?raw";

/**
 * Calcule l'état du stock et les classes Tailwind correspondantes.
 *
 * États :
 * - « Épuisé » : stock <= 0
 * - « Bientôt épuisé » : stock <= seuil_alerte
 * - « En stock » : stock > seuil_alerte
 *
 * @param {number|string|null|undefined} stock
 * @param {number|string|null|undefined} [seuilAlerte=5]
 * @returns {{ texte: string, classes: string, code: string }}
 */
function calculerEtatStock(stock, seuilAlerte = 5) {
  const quantite = Number(stock ?? 0);
  const seuil = Number(seuilAlerte ?? 5);

  if (quantite <= 0) {
    return {
      texte: "Épuisé",
      classes: "bg-red-600 text-white",
      code: "epuise",
    };
  }

  if (quantite <= seuil) {
    return {
      texte: "Bientôt épuisé",
      classes: "bg-amber-600 text-white",
      code: "bientot-epuise",
    };
  }

  return {
    texte: "En stock",
    classes: "bg-emerald-600 text-white",
    code: "en-stock",
  };
}

/**
 * Vue présentative CarteProduitView.
 *
 * Affiche une carte produit avec :
 * - Une image en arrière-plan (avec voile dégradé pour la lisibilité)
 * - Le nom du produit
 * - L'état du stock (« Épuisé », « Bientôt épuisé », « En stock »)
 * - Le prix unitaire formaté
 */
let CarteProduitView = {
  /**
   * Génère le HTML brut de la carte produit.
   *
   * @param {{
   *   id?: number,
   *   nom: string,
   *   prix: number|string,
   *   stock?: number|string,
   *   seuil_alerte?: number|string,
   *   image_url?: string,
   *   image?: string,
   *   imageUrl?: string,
   *   url?: string,
   *   categorie?: string
   * }} produit
   * @returns {string}
   */
  html: function (produit = {}) {
    const stockInfo = calculerEtatStock(produit.stock, produit.seuil_alerte);
    const imageUrl = produit.image_url || produit.image || produit.imageUrl || produit.url || defaultImageUrl;

    return genericRenderer(template, {
      id: produit.id ?? "",
      nom: produit.nom || produit.titre || "Produit sans nom",
      prix: formaterPrix(produit.prix),
      image_url: imageUrl,
      etat_stock: stockInfo.texte,
      classe_stock: stockInfo.classes,
      code_stock: stockInfo.code,
      categorie: produit.categorie || "",
    });
  },

  /**
   * Construit le DocumentFragment de la carte produit et attache les événements éventuels.
   *
   * @param {{
   *   id?: number,
   *   nom: string,
   *   prix: number|string,
   *   stock?: number|string,
   *   seuil_alerte?: number|string,
   *   image_url?: string,
   *   image?: string,
   *   imageUrl?: string,
   *   url?: string,
   *   categorie?: string
   * }} produit
   * @param {{
   *   onClick?: (produit: object) => void
   * }} [actions]
   * @returns {DocumentFragment}
   */
  dom: function (produit = {}, actions = {}) {
    const fragment = htmlToFragment(CarteProduitView.html(produit));
    const article = fragment.querySelector("article");

    // Fallback automatique si l'image distante échoue au chargement
    const imageElement = fragment.querySelector('[data-ref="image"]');
    if (imageElement) {
      imageElement.addEventListener("error", () => {
        imageElement.src = defaultImageUrl;
      });
    }

    if (article && typeof actions?.onClick === "function") {
      article.classList.add("cursor-pointer");
      article.addEventListener("click", () => actions.onClick(produit));
    }

    return fragment;
  },
};

export { CarteProduitView, calculerEtatStock };

