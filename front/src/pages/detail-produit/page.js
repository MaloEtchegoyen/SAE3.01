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
  optionsChoisies: {}, // { [optionId]: valeurId }
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
    let produit = await ProductData.fetchBySlugOrId(slugOuId);
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

    // Pré-sélection par défaut des options obligatoires du produit (OPT-c)
    M.optionsChoisies = {};
    if (Array.isArray(produit.options)) {
      let nbOpts = produit.options.length;
      for (let i = 0; i < nbOpts; i++) {
        let opt = produit.options[i];
        if (opt.valeurs && opt.valeurs.length > 0) {
          if (opt.obligatoire || opt.valeurs.length === 1) {
            M.optionsChoisies[opt.id] = opt.valeurs[0].id;
          }
        }
      }
    }

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

  let nom = produit.nom || "Produit";
  let categorie = produit.categorie || "Café Feuillette";
  let description =
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

  let schemaDonnees = {
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

C.handler_choisir_option = function (optionId, valeurId) {
  let opt = M.produit?.options?.find((o) => Number(o.id) === Number(optionId));
  // Si déjà sélectionné et facultatif, permettre de désélectionner, sinon basculer
  if (Number(M.optionsChoisies[optionId]) === Number(valeurId) && opt && !opt.obligatoire) {
    delete M.optionsChoisies[optionId];
  } else {
    M.optionsChoisies[optionId] = valeurId;
  }
  V.rafraichir();
};

C.handler_ajouter_panier = function (produit, quantite, optionsChoisies, variante) {
  let qte = Number(quantite || M.quantite || 1);
  if (qte <= 0) {
    M.message = {
      type: "erreur",
      texte: "Veuillez sélectionner au moins 1 produit.",
    };
    V.rafraichir();
    return;
  }

  // Résolution détaillée des options choisies pour le panier (OPT-c)
  let optionsSelectionnees = [];
  let optionsProduit = Array.isArray(produit.options) ? produit.options : [];
  let nbOpts = optionsProduit.length;
  for (let i = 0; i < nbOpts; i++) {
    let opt = optionsProduit[i];
    let valId = optionsChoisies ? optionsChoisies[opt.id] : M.optionsChoisies[opt.id];
    if (valId && Array.isArray(opt.valeurs)) {
      let v = opt.valeurs.find((val) => Number(val.id) === Number(valId));
      if (v) {
        optionsSelectionnees.push({
          optionId: opt.id,
          optionNom: opt.nom,
          valeurId: v.id,
          valeurNom: v.nom,
          surcout: Number(v.surcout || 0),
        });
      }
    }
  }

  try {
    CartData.ajouterArticle({
      produit,
      quantite: qte,
      variante,
      options: optionsSelectionnees,
    });

    let resumeOptions = optionsSelectionnees.map((o) => o.valeurNom).join(", ");
    let nomProduit = resumeOptions
      ? `${produit.nom} (${resumeOptions})`
      : (variante ? `${produit.nom} (${variante.nom})` : produit.nom);

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
  let slugOuId = params?.slug || params?.id;
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
  let p = M.produit || {};
  let catNom = p.categorie || "Catalogue";
  let catSlug = slugifier(catNom);

  let htmlString = genericRenderer(template, {
    nom: p.nom || "Détail produit",
    categorie: catNom,
  });

  let pageFragment = htmlToFragment(htmlString);

  // Configuration des liens de navigation retour / catégorie
  let lienAriane = pageFragment.querySelector('[data-ref="lien-categorie-ariane"]');
  let lienRetour = pageFragment.querySelector('[data-ref="lien-retour"]');

  if (p.category_id && catSlug) {
    let urlCat = `/categorie/${catSlug}`;
    if (lienAriane) lienAriane.setAttribute("href", urlCat);
    if (lienRetour) {
      lienRetour.setAttribute("href", urlCat);
      let spanTexte = lienRetour.querySelector("span:last-child");
      if (spanTexte) spanTexte.textContent = `Retour aux ${catNom}`;
    }
  } else {
    if (lienAriane) lienAriane.setAttribute("href", "/");
    if (lienRetour) {
      lienRetour.setAttribute("href", "/");
      let spanTexte = lienRetour.querySelector("span:last-child");
      if (spanTexte) spanTexte.textContent = "Retour au catalogue";
    }
  }

  // Slot Message
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    slotMessage.replaceWith(MessageView.dom(M.message));
  }

  // Si aucun produit chargé, supprimer les slots de contenu
  if (!M.produit) {
    let conteneur = pageFragment.querySelector('[data-ref="conteneur-principal"]');
    if (conteneur) conteneur.remove();
    return pageFragment;
  }

  // Slot Galerie
  let slotGalerie = pageFragment.querySelector('slot[name="galerie"]');
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
  let slotFiche = pageFragment.querySelector('slot[name="fiche"]');
  if (slotFiche) {
    slotFiche.replaceWith(
      FicheProduitView.dom(
        {
          produit: M.produit,
          varianteActive: M.varianteActive,
          optionsChoisies: M.optionsChoisies,
          quantite: M.quantite,
        },
        {
          onAjouterPanier: C.handler_ajouter_panier,
          onChangerQuantite: C.handler_changer_quantite,
          onChoisirVariante: C.handler_choisir_variante,
          onChoisirOption: C.handler_choisir_option,
        }
      )
    );
  }

  return pageFragment;
};

/**
 * Page de détail d'un produit (galerie d'images, sélection de variante, ajout au panier).
 *
 * @param {object} [params={}] Paramètres de route
 * @returns {Promise<DocumentFragment>}
 */
export function DetailProduitPage(params = {}) {
  return C.init(params);
}

