import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

/**
 * Dictionnaire exhaustif associant chaque clé d'image produit à sa classe Tailwind complète.
 * Respecte la règle d'interdiction de concaténation dynamique des classes Tailwind.
 */
const CLASSES_IMAGES_PRODUITS = {
  "cafe-noisettes": "bg-prod-cafe-noisettes",
  "chai-latte": "bg-prod-chai-latte",
  "chocolat-chaud": "bg-prod-chocolat-chaud",
  "citronnade": "bg-prod-citronnade",
  "eclair": "bg-prod-eclair",
  "flan": "bg-prod-flan",
  "latte-macchiato": "bg-prod-latte-macchiato",
  "milkshake": "bg-prod-milkshake",
  "mousse-chocolat": "bg-prod-mousse-chocolat",
  "orange": "bg-prod-orange",
  "riz": "bg-prod-riz",
  "the-glace": "bg-prod-the-glace",
  defaut: "bg-prod-defaut",
};

/**
 * Liste des correspondances par mots-clés pour identifier l'image adaptée d'un produit selon son nom.
 */
const CORRESPONDANCES_PRODUITS = [
  { motif: /noisette/i, cle: "cafe-noisettes" },
  { motif: /chai/i, cle: "chai-latte" },
  { motif: /chocolat.*chaud|chocolat chaud/i, cle: "chocolat-chaud" },
  { motif: /citron/i, cle: "citronnade" },
  { motif: /eclair|éclair/i, cle: "eclair" },
  { motif: /flan/i, cle: "flan" },
  { motif: /macchiato|latte/i, cle: "latte-macchiato" },
  { motif: /milkshake/i, cle: "milkshake" },
  { motif: /mousse/i, cle: "mousse-chocolat" },
  { motif: /orange/i, cle: "orange" },
  { motif: /riz/i, cle: "riz" },
  { motif: /thé|the.*glac/i, cle: "the-glace" },
];

/**
 * Détermine la classe Tailwind de fond correspondant à un produit.
 *
 * @param {{
 *   nom?: string,
 *   titre?: string,
 *   image?: string,
 *   image_cle?: string,
 *   classe_image?: string
 * }} produit
 * @returns {string} Classe Tailwind complète (ex. « bg-prod-cafe-noisettes »)
 */
function obtenirClasseImage(produit = {}) {
  if (produit.classe_image && CLASSES_IMAGES_PRODUITS[produit.classe_image]) {
    return CLASSES_IMAGES_PRODUITS[produit.classe_image];
  }

  const cleExplicite = produit.image_cle || produit.image;
  if (cleExplicite && CLASSES_IMAGES_PRODUITS[cleExplicite]) {
    return CLASSES_IMAGES_PRODUITS[cleExplicite];
  }

  const nom = produit.nom || produit.titre || "";
  for (let i = 0; i < CORRESPONDANCES_PRODUITS.length; i++) {
    if (CORRESPONDANCES_PRODUITS[i].motif.test(nom)) {
      return CLASSES_IMAGES_PRODUITS[CORRESPONDANCES_PRODUITS[i].cle];
    }
  }

  return CLASSES_IMAGES_PRODUITS.defaut;
}

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
      classes: "bg-amber-600 text-default",
      code: "bientot-epuise",
    };
  }

  return {
    texte: "En stock",
    classes: "bg-brand text-default",
    code: "en-stock",
  };
}

/**
 * Vue présentative CarteProduitView.
 *
 * Affiche une carte produit avec :
 * - Une image en arrière-plan via Tailwind CSS (avec voile dégradé pour la lisibilité)
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
   *   categorie?: string,
   *   classe_image?: string
   * }} produit
   * @returns {string}
   */
  html: function (produit = {}) {
    const stockInfo = calculerEtatStock(produit.stock, produit.seuil_alerte);
    const classeImage = obtenirClasseImage(produit);
    const urlExplicite = produit.image_url || (produit.url && produit.url.startsWith("http") ? produit.url : null);
    const styleImage = urlExplicite ? `style="background-image: url('${urlExplicite}')"` : "";

    return genericRenderer(template, {
      id: produit.id ?? "",
      nom: produit.nom || produit.titre || "Produit sans nom",
      prix: formaterPrix(produit.prix),
      classe_image: classeImage,
      style_image: styleImage,
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
   *   categorie?: string,
   *   classe_image?: string
   * }} produit
   * @param {{
   *   onClick?: (produit: object) => void
   * }} [actions]
   * @returns {DocumentFragment}
   */
  dom: function (produit = {}, actions = {}) {
    const fragment = htmlToFragment(CarteProduitView.html(produit));
    const article = fragment.querySelector("article");

    if (article && typeof actions?.onClick === "function") {
      article.classList.add("cursor-pointer");
      article.addEventListener("click", () => actions.onClick(produit));
    }

    return fragment;
  },
};

export { CarteProduitView, calculerEtatStock, obtenirClasseImage, CLASSES_IMAGES_PRODUITS };

