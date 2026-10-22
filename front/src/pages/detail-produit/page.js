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
    M.indexImage = 0;
    M.message = null;

    // Résolution initiale des options et variantes (OPT-b)
    M.optionsChoisies = {};
    let variantes = Array.isArray(produit.variantes) ? produit.variantes : [];
    let variantesAvecValeurs = variantes.filter(
      (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
    );

    if (variantesAvecValeurs.length > 0) {
      // Trouver de préférence une variante en stock (stock > 0), sinon la première
      let varianteParDefaut =
        variantesAvecValeurs.find((v) => Number(v.stock ?? 0) > 0) || variantesAvecValeurs[0];

      if (varianteParDefaut && Array.isArray(produit.options)) {
        let vIds = (varianteParDefaut.valeur_ids || []).map(Number);
        for (let i = 0; i < produit.options.length; i++) {
          let opt = produit.options[i];
          let valTrouvee = opt.valeurs?.find((v) => vIds.includes(Number(v.id)));
          if (valTrouvee) {
            M.optionsChoisies[opt.id] = valTrouvee.id;
          }
        }
      }
      M.varianteActive = varianteParDefaut;
      let stockVar = Number(varianteParDefaut?.stock ?? 0);
      M.quantite = stockVar > 0 ? 1 : 0;
    } else {
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
      // Préférer la première variante avec du stock disponible
      M.varianteActive =
        variantes.length > 0
          ? variantes.find((v) => Number(v.stock ?? 0) > 0 && Number(v.actif ?? 1) === 1) || variantes[0]
          : null;
      let stockBase = Number(M.varianteActive?.stock ?? produit.stock ?? 0);
      M.quantite = stockBase > 0 ? 1 : 0;
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

C.handler_choisir_option = function (optionId, valeurId) {
  let opt = M.produit?.options?.find((o) => Number(o.id) === Number(optionId));
  // Si déjà sélectionné et facultatif, permettre de désélectionner, sinon basculer
  if (Number(M.optionsChoisies[optionId]) === Number(valeurId) && opt && !opt.obligatoire) {
    delete M.optionsChoisies[optionId];
  } else {
    M.optionsChoisies[optionId] = valeurId;
  }

  // Recalcul de la variante correspondante (OPT-b)
  let variantes = Array.isArray(M.produit?.variantes) ? M.produit.variantes : [];
  let variantesAvecValeurs = variantes.filter(
    (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
  );

  if (variantesAvecValeurs.length > 0) {
    let idsChoisis = Object.values(M.optionsChoisies).map(Number).sort((a, b) => a - b);
    let varianteTrouvee = variantesAvecValeurs.find((v) => {
      let vIds = (v.valeur_ids || []).map(Number).sort((a, b) => a - b);
      if (vIds.length !== idsChoisis.length) return false;
      for (let k = 0; k < vIds.length; k++) {
        if (vIds[k] !== idsChoisis[k]) return false;
      }
      return true;
    });

    // Si la combinaison exacte n'est pas trouvée ou épuisée (stock <= 0),
    // rechercher une variante alternative EN STOCK (> 0) contenant la valeur sélectionnée
    if ((!varianteTrouvee || Number(varianteTrouvee.stock ?? 0) <= 0) && valeurId) {
      let numValId = Number(valeurId);
      let variantesDisponibles = variantesAvecValeurs.filter(
        (v) => (v.valeur_ids || []).map(Number).includes(numValId) && Number(v.stock ?? 0) > 0
      );

      if (variantesDisponibles.length > 0) {
        // Retenir la variante qui partage le plus d'options avec le choix courant
        let meilleureVariante = variantesDisponibles[0];
        let maxCommuns = -1;
        let nbVars = variantesDisponibles.length;

        for (let i = 0; i < nbVars; i++) {
          let cand = variantesDisponibles[i];
          let candIds = (cand.valeur_ids || []).map(Number);
          let communs = idsChoisis.filter((id) => candIds.includes(id)).length;
          if (communs > maxCommuns) {
            maxCommuns = communs;
            meilleureVariante = cand;
          }
        }

        varianteTrouvee = meilleureVariante;

        // Réaligner M.optionsChoisies sur cette variante valide en stock
        if (Array.isArray(M.produit.options)) {
          let vIds = (varianteTrouvee.valeur_ids || []).map(Number);
          let nbOpts = M.produit.options.length;
          for (let o = 0; o < nbOpts; o++) {
            let oObj = M.produit.options[o];
            let valTrouvee = oObj.valeurs?.find((v) => vIds.includes(Number(v.id)));
            if (valTrouvee) {
              M.optionsChoisies[oObj.id] = valTrouvee.id;
            }
          }
        }
      }
    }

    M.varianteActive = varianteTrouvee || null;
    let stockDispo = Number(M.varianteActive?.stock ?? 0);
    if (!M.varianteActive || stockDispo <= 0) {
      M.quantite = 0;
    } else {
      M.quantite = Math.min(Math.max(1, M.quantite), stockDispo);
    }
  }

  V.rafraichir();
};

C.handler_ajouter_panier = function (produit, quantite, optionsChoisies, variante) {
  let qte = Number(quantite || M.quantite || 0);
  let stockDispo = Number(variante?.stock !== undefined ? variante.stock : (produit.stock ?? 0));

  if (!variante && Array.isArray(produit.variantes) && produit.variantes.length > 0) {
    let aDesVariantesCombinaisons = produit.variantes.some(
      (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
    );
    if (aDesVariantesCombinaisons) {
      M.message = {
        type: "erreur",
        texte: "Cette combinaison d'options n'est pas disponible.",
      };
      V.rafraichir();
      return;
    }
  }

  if (stockDispo <= 0) {
    M.message = {
      type: "erreur",
      texte: "Cette variante est victime de son succès et actuellement épuisée.",
    };
    V.rafraichir();
    return;
  }

  if (qte <= 0) {
    M.message = {
      type: "erreur",
      texte: "Veuillez sélectionner au moins 1 produit.",
    };
    V.rafraichir();
    return;
  }

  if (qte > stockDispo) {
    M.message = {
      type: "erreur",
      texte: `Quantité demandée indisponible. Stock restant : ${stockDispo}.`,
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

