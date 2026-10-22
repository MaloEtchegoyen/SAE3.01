import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix, slugifier } from "../../lib/format.js";
import placeholderImg from "../../../assets/landscape-placeholder.svg";
import template from "./template.html?raw";

/**
 * Calcule l'état du stock (libellé et code).
 *
 * États :
 * - « Épuisé » : stock <= 0
 * - « Bientôt épuisé » : stock <= seuil_alerte
 * - « En stock » : stock > seuil_alerte
 *
 * @param {number|string|null|undefined} stock
 * @param {number|string|null|undefined} [seuilAlerte=5]
 * @returns {{ texte: string, code: string }}
 */
function calculerEtatStock(stock, seuilAlerte = 5) {
  let quantite = Number(stock ?? 0);
  let seuil = Number(seuilAlerte ?? 5);

  if (quantite <= 0) {
    return {
      texte: "Épuisé",
      code: "epuise",
    };
  }

  if (quantite <= seuil) {
    return {
      texte: "Bientôt épuisé",
      code: "bientot-epuise",
    };
  }

  return {
    texte: "En stock",
    code: "en-stock",
  };
}

/**
 * Résout l'URL d'affichage pour une image de produit.
 * Si aucune image n'est spécifiée, utilise le placeholder officiel landscape-placeholder.svg.
 *
 * @param {string|null|undefined} sourceImage Nom de l'image ou URL
 * @returns {string}
 */
function resoudreUrlImage(sourceImage) {
  if (!sourceImage || typeof sourceImage !== "string") return placeholderImg;

  let nettoyee = sourceImage.trim();
  if (!nettoyee) return placeholderImg;

  if (
    nettoyee.startsWith("http://") ||
    nettoyee.startsWith("https://") ||
    nettoyee.startsWith("data:") ||
    nettoyee.startsWith("blob:")
  ) {
    return nettoyee;
  }

  let base = import.meta.env.BASE_URL || "/";
  let racine = base.endsWith("/") ? base : `${base}/`;

  if (nettoyee.includes("api/products/image")) {
    if (nettoyee.startsWith("/")) {
      return nettoyee;
    }
    return `${racine}${nettoyee.replace(/^\/+/, "")}`;
  }

  let nomFichier = nettoyee.includes("/") ? nettoyee.split("/").pop() : nettoyee;
  return `${racine}api/products/image?nom=${encodeURIComponent(nomFichier)}`;
}

/**
 * Vue présentative CarteProduitView.
 *
 * Affiche une carte produit avec :
 * - Une image d'arrière-plan ou placeholder SVG
 * - Le nom du produit cliquable
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
    let stockInfo = calculerEtatStock(produit.stock, produit.seuil_alerte);
    let sourceImage = produit.image_url || produit.imageUrl || produit.url || null;
    let urlExplicite = resoudreUrlImage(sourceImage);
    let slug = slugifier(produit.nom || produit.titre || "");

    return genericRenderer(template, {
      id: produit.id ?? "",
      nom: produit.nom || produit.titre || "Produit sans nom",
      slug: slug || String(produit.id ?? ""),
      prix: formaterPrix(produit.prix),
      image_url: urlExplicite,
      etat_stock: stockInfo.texte,
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
    let fragment = htmlToFragment(CarteProduitView.html(produit));
    let article = fragment.querySelector("article");

    if (article && typeof actions?.onClick === "function") {
      article.addEventListener("click", () => actions.onClick(produit));
    }

    return fragment;
  },
};

export { CarteProduitView, calculerEtatStock, resoudreUrlImage, placeholderImg };
