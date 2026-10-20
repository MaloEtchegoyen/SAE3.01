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
    let nettoyee = source.trim();
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

    let nomFichier = nettoyee.includes("/") ? nettoyee.split("/").pop() : nettoyee;
    let base = import.meta.env.BASE_URL || "/";
    let racine = base.endsWith("/") ? base : `${base}/`;
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
    let produit = donnees.produit || {};
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
      let imgFallback = resoudreImageSource(produit.image_url, produit);
      if (imgFallback) {
        listeImages.push(imgFallback);
      }
    }

    let indexActif = Math.min(
      Math.max(0, Number(donnees.indexActif ?? 0)),
      Math.max(0, listeImages.length - 1)
    );

    let stockInfo = calculerEtatStock(produit.stock, produit.seuil_alerte);

    let htmlString = genericRenderer(template, {
      nom: produit.nom || "Produit Café Feuillette",
      etat_stock: stockInfo.texte,
      code_stock: stockInfo.code,
    });

    let fragment = htmlToFragment(htmlString);

    let imgPrincipale = fragment.querySelector('[data-ref="image-principale"]');
    let bgSecours = fragment.querySelector('[data-ref="bg-secours"]');
    let controlesNav = fragment.querySelector('[data-ref="controles-navigation"]');
    let btnPrecedent = fragment.querySelector('[data-action="precedent"]');
    let btnSuivant = fragment.querySelector('[data-action="suivant"]');
    let conteneurVignettes = fragment.querySelector('[data-ref="vignettes-conteneur"]');
    let slotVignettes = fragment.querySelector('slot[name="vignettes"]');

    // Mise à jour de l'image principale
    let imageActiveUrl = listeImages[indexActif];
    if (imageActiveUrl && imgPrincipale) {
      imgPrincipale.src = imageActiveUrl;
      imgPrincipale.classList.remove("hidden");
      if (bgSecours) bgSecours.classList.add("hidden");
    } else if (bgSecours) {
      if (imgPrincipale) imgPrincipale.classList.add("hidden");
      bgSecours.classList.remove("hidden");
    }

    // Gestion de l'affichage des flèches et vignettes
    let aPlusieursImages = listeImages.length > 1;

    if (!aPlusieursImages && controlesNav) {
      controlesNav.remove();
    } else if (aPlusieursImages) {
      if (btnPrecedent) {
        btnPrecedent.addEventListener("click", () => {
          let precedentIndex = (indexActif - 1 + listeImages.length) % listeImages.length;
          actions?.onChangerImage?.(precedentIndex);
        });
      }
      if (btnSuivant) {
        btnSuivant.addEventListener("click", () => {
          let suivantIndex = (indexActif + 1) % listeImages.length;
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
        let elementsVignettes = listeImages.map((urlImage, index) => {
          let fragmentVignette = htmlToFragment(
            genericRenderer(templateVignette, {
              aria_label: `Afficher l'image ${index + 1} sur ${listeImages.length}`,
              est_actif: String(index === indexActif),
              url_image: urlImage,
              alt_image: `${produit.nom || "Produit"} - vue ${index + 1}`,
            })
          );

          let btn = fragmentVignette.firstElementChild;
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

