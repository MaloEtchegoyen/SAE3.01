import { ProductData } from "../../data/product.js";
import { CartData } from "../../data/cart.js";
import { htmlToFragment, genericRenderer } from "../../lib/utils.js";
import { slugifier } from "../../lib/format.js";
import { GalerieProduitView } from "../../ui/galerie-produit/index.js";
import { FicheProduitView } from "../../ui/fiche-produit/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Détail Produit.
 * Isole strictement l'état sans toucher au DOM.
 */
let M = {
  slugOuId: null,
  produit: null,
  varianteActive: null,
  quantite: 0,
  indexImage: 0,
  message: null, // { type: "succes" | "erreur" | "info", texte: string }
};

let C = {};

/**
 * Charge les données du produit à partir du slug ou de son ID.
 *
 * @param {string|number} slugOuId
 */
C.charger = async function (slugOuId) {
  try {
    const produit = await ProductData.fetchBySlugOrId(slugOuId);
    if (!produit) {
      M.produit = null;
      M.message = {
        type: "erreur",
        texte: `Le produit « ${slugOuId} » est introuvable ou n'est plus disponible.`,
      };
      return;
    }

    M.produit = produit;
    M.varianteActive = null;
    M.quantite = Number(produit.stock ?? 0) > 0 ? 1 : 0;
    M.indexImage = 0;
    M.message = null;

    // Mise à jour SEO (Title, Meta description, Schema.org)
    C.mettreAJourSeo(produit);
  } catch (erreur) {
    M.produit = null;
    M.message = {
      type: "erreur",
      texte: `Impossible de charger le produit : ${erreur.message}`,
    };
  }
};

/**
 * Met à jour dynamiquement les métadonnées de la page pour le SEO.
 *
 * @param {object} produit
 */
C.mettreAJourSeo = function (produit) {
  if (!produit || typeof document === "undefined") return;

  const nom = produit.nom || "Produit";
  const categorie = produit.categorie || "Café Feuillette";
  const description =
    produit.description ||
    `Découvrez ${nom} de la catégorie ${categorie} chez Café Feuillette. Commandez en click & collect.`;

  // 1. Titre de page
  document.title = `${nom} - ${categorie} | Café Feuillette Tours`;

  // 2. Balise Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = description;

  // 3. OpenGraph Tags
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement("meta");
    ogTitle.setAttribute("property", "og:title");
    document.head.appendChild(ogTitle);
  }
  ogTitle.content = `${nom} | Café Feuillette`;

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) {
    ogDesc = document.createElement("meta");
    ogDesc.setAttribute("property", "og:description");
    document.head.appendChild(ogDesc);
  }
  ogDesc.content = description;

  // 4. Balisage Schema.org JSON-LD
  let scriptLd = document.getElementById("seo-schema-product");
  if (!scriptLd) {
    scriptLd = document.createElement("script");
    scriptLd.id = "seo-schema-product";
    scriptLd.type = "application/ld+json";
    document.head.appendChild(scriptLd);
  }

  const schemaDonnees = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: nom,
    description: description,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(produit.prix ?? 0),
      availability:
        Number(produit.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };
  scriptLd.textContent = JSON.stringify(schemaDonnees);
};

/**
 * Handlers d'actions utilisateur.
 */
C.handler_changer_image = function (nouvelIndex) {
  M.indexImage = nouvelIndex;
  V.rafraichir();
};

C.handler_changer_quantite = function (nouvelleQte) {
  M.quantite = nouvelleQte;
  V.rafraichir();
};

C.handler_choisir_variante = function (variante) {
  M.varianteActive = variante;
  V.rafraichir();
};

C.handler_ajouter_panier = function (produit, quantite, variante) {
  const qte = Number(quantite || M.quantite || 1);
  if (qte <= 0) {
    M.message = {
      type: "erreur",
      texte: "Veuillez sélectionner au moins 1 produit.",
    };
    V.rafraichir();
    return;
  }

  try {
    CartData.ajouterArticle({ produit, quantite: qte, variante });
    const nomProduit = variante ? `${produit.nom} (${variante.nom})` : produit.nom;
    M.message = {
      type: "succes",
      texte: `${qte} × « ${nomProduit} » ajouté(s) à votre panier avec succès !`,
    };
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: `Impossible d'ajouter au panier : ${erreur.message}`,
    };
  }
  V.rafraichir();
};

/**
 * Initialisation lors de l'accès à la route.
 *
 * @param {{ slug?: string, id?: string }} params
 * @returns {Promise<DocumentFragment>}
 */
C.init = async function (params = {}) {
  const slugOuId = params?.slug || params?.id;
  M.slugOuId = slugOuId;
  M.message = null;

  await C.charger(slugOuId);

  return V.init();
};

let V = {};

V.racine = null;

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  if (V.racine && V.racine.parentNode) {
    V.racine.replaceWith(fragment);
    V.racine = nouvelleRacine;
  }
};

/**
 * Déduit l'interface HTML à partir de l'état M.
 *
 * @returns {DocumentFragment}
 */
V.createPageFragment = function () {
  const p = M.produit || {};
  const catNom = p.categorie || "Catalogue";
  const catSlug = slugifier(catNom);

  const htmlString = genericRenderer(template, {
    nom: p.nom || "Détail produit",
    categorie: catNom,
  });

  const pageFragment = htmlToFragment(htmlString);

  // Configuration des liens de navigation retour / catégorie
  const lienAriane = pageFragment.querySelector('[data-ref="lien-categorie-ariane"]');
  const lienRetour = pageFragment.querySelector('[data-ref="lien-retour"]');

  if (p.category_id && catSlug) {
    const urlCat = `/categorie/${catSlug}`;
    if (lienAriane) lienAriane.setAttribute("href", urlCat);
    if (lienRetour) {
      lienRetour.setAttribute("href", urlCat);
      const spanTexte = lienRetour.querySelector("span:last-child");
      if (spanTexte) spanTexte.textContent = `Retour aux ${catNom}`;
    }
  } else {
    if (lienAriane) lienAriane.setAttribute("href", "/");
    if (lienRetour) {
      lienRetour.setAttribute("href", "/");
      const spanTexte = lienRetour.querySelector("span:last-child");
      if (spanTexte) spanTexte.textContent = "Retour au catalogue";
    }
  }

  // Slot Message
  const slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    slotMessage.replaceWith(MessageView.dom(M.message));
  }

  // Si aucun produit chargé, supprimer les slots de contenu
  if (!M.produit) {
    const conteneur = pageFragment.querySelector('[data-ref="conteneur-principal"]');
    if (conteneur) conteneur.remove();
    return pageFragment;
  }

  // Slot Galerie
  const slotGalerie = pageFragment.querySelector('slot[name="galerie"]');
  if (slotGalerie) {
    slotGalerie.replaceWith(
      GalerieProduitView.dom(
        {
          produit: M.produit,
          images: M.produit.images,
          indexActif: M.indexImage,
        },
        {
          onChangerImage: C.handler_changer_image,
        }
      )
    );
  }

  // Slot Fiche Produit
  const slotFiche = pageFragment.querySelector('slot[name="fiche"]');
  if (slotFiche) {
    slotFiche.replaceWith(
      FicheProduitView.dom(
        {
          produit: M.produit,
          varianteActive: M.varianteActive,
          quantite: M.quantite,
        },
        {
          onAjouterPanier: C.handler_ajouter_panier,
          onChangerQuantite: C.handler_changer_quantite,
          onChoisirVariante: C.handler_choisir_variante,
        }
      )
    );
  }

  return pageFragment;
};

export function DetailProduitPage(params = {}) {
  return C.init(params);
}

