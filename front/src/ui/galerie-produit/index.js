import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { calculerEtatStock } from "../carte-produit/index.js";
import placeholderImg from "../../../assets/landscape-placeholder.svg";
import template from "./template.html?raw";
import templateVignette from "./vignette.html?raw";

/**
 * Résout l'URL publique d'une image ou utilise le placeholder SVG de secours.
 *
 * @param {string|null|undefined} source
 * @param {object} [produit={}]
 * @returns {string}
 */
export function resoudreImageSource(source, produit = {}) {
  if (source && typeof source === "string") {
    const nettoyee = source.trim();
    if (
      nettoyee.startsWith("http://") ||
      nettoyee.startsWith("https://") ||
      nettoyee.startsWith("data:") ||
      nettoyee.startsWith("blob:")
    ) {
      return nettoyee;
    }
    if (nettoyee.startsWith("/assets/") || nettoyee.includes("assets/")) {
      return nettoyee;
    }

    const nomFichier = nettoyee.includes("/") ? nettoyee.split("/").pop() : nettoyee;
    const base = import.meta.env.BASE_URL || "/";
    const racine = base.endsWith("/") ? base : `${base}/`;
    return `${racine}api/products/image?nom=${encodeURIComponent(nomFichier)}`;
  }

  // Image de secours : placeholder SVG officiel
  return placeholderImg;
}

/**
 * Vue GalerieProduitView.
 * Composant de présentation pour la navigation dans la galerie photo d'un produit.
 */
let GalerieProduitView = {
  /**
   * Construit le DOM de la galerie.
   *
   * @param {{
   *   produit: object,
   *   images?: Array<{ url: string, alt?: string, id?: number }>,
   *   indexActif?: number
   * }} donnees
   * @param {{
   *   onChangerImage?: (nouvelIndex: number) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (donnees = {}, actions = {}) {
    const produit = donnees.produit || {};
    // Liste normalisée des URLs d'images disponibles
    let listeImages = [];
    if (Array.isArray(donnees.images) && donnees.images.length > 0) {
      listeImages = donnees.images
        .map((img) => (typeof img === "string" ? img : img.url))
        .filter(Boolean)
        .map((src) => resoudreImageSource(src, produit));
    }

    // Si aucune image en BDD, utiliser l'image principale ou le placeholder par défaut
    if (listeImages.length === 0) {
      const imgFallback = resoudreImageSource(produit.image_url, produit);
      if (imgFallback) {
        listeImages.push(imgFallback);
      }
    }

    const indexActif = Math.min(
      Math.max(0, Number(donnees.indexActif ?? 0)),
      Math.max(0, listeImages.length - 1)
    );

    const stockInfo = calculerEtatStock(produit.stock, produit.seuil_alerte);

    const htmlString = genericRenderer(template, {
      nom: produit.nom || "Produit Café Feuillette",
      etat_stock: stockInfo.texte,
      code_stock: stockInfo.code,
    });

    const fragment = htmlToFragment(htmlString);

    const imgPrincipale = fragment.querySelector('[data-ref="image-principale"]');
    const bgSecours = fragment.querySelector('[data-ref="bg-secours"]');
    const controlesNav = fragment.querySelector('[data-ref="controles-navigation"]');
    const btnPrecedent = fragment.querySelector('[data-action="precedent"]');
    const btnSuivant = fragment.querySelector('[data-action="suivant"]');
    const conteneurVignettes = fragment.querySelector('[data-ref="vignettes-conteneur"]');
    const slotVignettes = fragment.querySelector('slot[name="vignettes"]');

    // Mise à jour de l'image principale
    const imageActiveUrl = listeImages[indexActif];
    if (imageActiveUrl && imgPrincipale) {
      imgPrincipale.src = imageActiveUrl;
      imgPrincipale.classList.remove("hidden");
      if (bgSecours) bgSecours.classList.add("hidden");
    } else if (bgSecours) {
      if (imgPrincipale) imgPrincipale.classList.add("hidden");
      bgSecours.classList.remove("hidden");
    }

    // Gestion de l'affichage des flèches et vignettes
    const aPlusieursImages = listeImages.length > 1;

    if (!aPlusieursImages && controlesNav) {
      controlesNav.remove();
    } else if (aPlusieursImages) {
      if (btnPrecedent) {
        btnPrecedent.addEventListener("click", () => {
          const precedentIndex = (indexActif - 1 + listeImages.length) % listeImages.length;
          actions?.onChangerImage?.(precedentIndex);
        });
      }
      if (btnSuivant) {
        btnSuivant.addEventListener("click", () => {
          const suivantIndex = (indexActif + 1) % listeImages.length;
          actions?.onChangerImage?.(suivantIndex);
        });
      }
    }

    // Génération des vignettes interactives
    if (slotVignettes) {
      if (!aPlusieursImages) {
        conteneurVignettes?.remove();
        slotVignettes.remove();
      } else {
        const elementsVignettes = listeImages.map((urlImage, index) => {
          const fragmentVignette = htmlToFragment(
            genericRenderer(templateVignette, {
              aria_label: `Afficher l'image ${index + 1} sur ${listeImages.length}`,
              est_actif: String(index === indexActif),
              url_image: urlImage,
              alt_image: `${produit.nom || "Produit"} - vue ${index + 1}`,
            })
          );

          const btn = fragmentVignette.firstElementChild;
          btn.addEventListener("click", () => {
            actions?.onChangerImage?.(index);
          });

          return btn;
        });

        slotVignettes.replaceWith(...elementsVignettes);
      }
    }

    return fragment;
  },
};

export { GalerieProduitView };

