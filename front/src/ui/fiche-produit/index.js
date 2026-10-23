import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

/**
 * Évalue la disponibilité d'une valeur d'option en fonction des autres options déjà sélectionnées (OPT-b).
 *
 * @param {number|string} optId
 * @param {number|string} valId
 * @param {Record<string|number, number>} optionsChoisies
 * @param {Array<object>} variantes
 * @returns {{
 *   existe: boolean,
 *   stock: number,
 *   epuise: boolean,
 *   variante?: object,
 *   code: "disponible" | "epuise" | "inexistant"
 * }}
 */
function evaluerDisponibiliteValeur(optId, valId, optionsChoisies, variantes) {
  if (!Array.isArray(variantes) || variantes.length === 0) {
    return { existe: true, stock: 99, epuise: false, code: "disponible" };
  }

  let variantesAvecValeurs = variantes.filter(
    (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
  );

  if (variantesAvecValeurs.length === 0) {
    return { existe: true, stock: 99, epuise: false, code: "disponible" };
  }

  let numValId = Number(valId);
  let numOptId = Number(optId);

  // 1. Vérifier si cette valeur d'option existe dans au moins une variante
  let variantesAvecCetteValeur = variantesAvecValeurs.filter((v) =>
    (v.valeur_ids || []).map(Number).includes(numValId)
  );

  if (variantesAvecCetteValeur.length === 0) {
    return { existe: false, stock: 0, epuise: true, code: "inexistant" };
  }

  // 2. Vérifier si cette valeur existe dans au moins une variante avec stock > 0
  let variantesEnStock = variantesAvecCetteValeur.filter(
    (v) => Number(v.stock ?? 0) > 0
  );

  if (variantesEnStock.length === 0) {
    return { existe: true, stock: 0, epuise: true, code: "epuise" };
  }

  // 3. Combinaison avec les options actuellement choisies
  let hypo = { ...optionsChoisies, [numOptId]: numValId };
  let idsHypo = Object.values(hypo).map(Number).sort((a, b) => a - b);

  // Recherche d'une variante exacte
  let varianteTrouvee = variantesAvecValeurs.find((v) => {
    let vIds = (v.valeur_ids || []).map(Number).sort((a, b) => a - b);
    if (vIds.length !== idsHypo.length) return false;
    for (let i = 0; i < vIds.length; i++) {
      if (vIds[i] !== idsHypo[i]) return false;
    }
    return true;
  });

  if (varianteTrouvee) {
    let stock = Number(varianteTrouvee.stock ?? 0);
    return {
      existe: true,
      stock,
      epuise: stock <= 0,
      variante: varianteTrouvee,
      code: stock <= 0 ? "epuise" : "disponible",
    };
  }

  // 4. Recherche si au moins une variante contient ce sous-ensemble
  let variantesPossibles = variantesAvecValeurs.filter((v) => {
    let vIds = (v.valeur_ids || []).map(Number);
    return idsHypo.every((id) => vIds.includes(id));
  });

  if (variantesPossibles.length === 0) {
    return { existe: false, stock: 0, epuise: true, code: "inexistant" };
  }

  let maxStock = Math.max(...variantesPossibles.map((v) => Number(v.stock ?? 0)));
  return {
    existe: true,
    stock: maxStock,
    epuise: maxStock <= 0,
    code: maxStock <= 0 ? "epuise" : "disponible",
  };
}

/**
 * Vue FicheProduitView.
 * Composant de présentation affichant les détails du produit, son prix dynamique,
 * ses combinaisons d'options avec contrôle du stock par variante (OPT-b),
 * le sélecteur de quantité et le bouton d'ajout au panier.
 */
let FicheProduitView = {
  /**
   * Construit le DocumentFragment de la fiche produit.
   *
   * @param {{
   *   produit: object,
   *   varianteActive?: object|null,
   *   optionsChoisies?: Record<string|number, number>,
   *   quantite?: number
   * }} donnees
   * @param {{
   *   onAjouterPanier?: (produit: object, quantite: number, optionsChoisies: object, variante: object|null) => void,
   *   onChangerQuantite?: (nouvelleQuantite: number) => void,
   *   onChoisirOption?: (optionId: number, valeurId: number) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (donnees = {}, actions = {}) {
    let produit = donnees.produit || {};
    let varianteActive = donnees.varianteActive || null;
    let optionsChoisies = donnees.optionsChoisies || {};
    let quantite = Math.max(0, Number(donnees.quantite ?? 0));

    let options = Array.isArray(produit.options) ? produit.options : [];
    let variantes = Array.isArray(produit.variantes) ? produit.variantes : [];
    let variantesAvecValeurs = variantes.filter(
      (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
    );

    // Détermination du statut de disponibilité de la combinaison active
    let combinaisonInexistante = false;
    let stockDisponible = 0;
    let seuilAlerte = Number(varianteActive?.seuil_alerte ?? produit.seuil_alerte ?? 5);

    if (variantesAvecValeurs.length > 0) {
      if (varianteActive) {
        stockDisponible = Number(varianteActive.stock ?? 0);
      } else {
        combinaisonInexistante = true;
        stockDisponible = 0;
      }
    } else if (varianteActive) {
      stockDisponible = Number(varianteActive.stock ?? 0);
    } else {
      stockDisponible = Number(produit.stock ?? 0);
    }

    let estEpuise = stockDisponible <= 0;

    // Détermination du prix affiché
    let prixAffiche = 0;
    if (varianteActive?.prix !== undefined) {
      prixAffiche = Number(varianteActive.prix);
    } else {
      let surcoutOptions = 0;
      let nbOpts = options.length;
      for (let i = 0; i < nbOpts; i++) {
        let opt = options[i];
        let valIdChoisi = optionsChoisies[opt.id];
        if (valIdChoisi && Array.isArray(opt.valeurs)) {
          let nbVals = opt.valeurs.length;
          for (let j = 0; j < nbVals; j++) {
            let v = opt.valeurs[j];
            if (Number(v.id) === Number(valIdChoisi)) {
              surcoutOptions += Number(v.surcout || 0);
              break;
            }
          }
        }
      }
      prixAffiche = Math.round((Number(produit.prix ?? 0) + surcoutOptions) * 100) / 100;
    }

    let htmlString = genericRenderer(template, {
      nom: produit.nom || "Produit sans nom",
      categorie: produit.categorie || "Café Feuillette",
      prix: formaterPrix(prixAffiche),
      description:
        produit.description ||
        "Ce produit ne possède pas encore de description.",
    });

    let fragment = htmlToFragment(htmlString);

    // Sélecteur de quantité & Stock
    let valQuantite = fragment.querySelector('[data-ref="valeur-quantite"]');
    let selecteurQuantite = fragment.querySelector('[data-ref="selecteur-quantite"]');
    let labelQuantite = fragment.querySelector('[data-ref="label-quantite"]');
    let btnDiminuer = fragment.querySelector('[data-action="diminuer-quantite"]');
    let btnAugmenter = fragment.querySelector('[data-action="augmenter-quantite"]');
    let spanStock = fragment.querySelector('[data-ref="stock-restant"]');
    let btnAjouter = fragment.querySelector('[data-action="ajouter-panier"]');
    let txtBouton = fragment.querySelector('[data-ref="texte-bouton-panier"]');

    // Affichage des stocks par variante (STK-b / OPT-b)
    if (spanStock) {
      if (combinaisonInexistante) {
        spanStock.textContent = "Combinaison indisponible";
        spanStock.className = "text-caption font-semibold text-red-500";
      } else if (estEpuise) {
        spanStock.textContent = "Victime de son succès";
        spanStock.className = "text-caption font-semibold text-red-500";
      } else if (stockDisponible <= seuilAlerte) {
        spanStock.textContent = `Plus que ${stockDisponible} en stock`;
        spanStock.className = "text-caption font-semibold text-amber-500";
      } else {
        spanStock.textContent = `${stockDisponible} disponibles`;
        spanStock.className = "text-caption font-semibold text-emerald-500";
      }
    }

    // Si le produit ou la variante est en rupture de stock, ne pas afficher le sélecteur de quantité
    if (estEpuise || combinaisonInexistante) {
      if (selecteurQuantite) {
        selecteurQuantite.remove();
      }
      if (labelQuantite) {
        labelQuantite.textContent = "Disponibilité";
      }
    } else {
      if (valQuantite) {
        valQuantite.textContent = String(quantite);
      }

      // Contraintes de quantité (STK-c / OPT-b)
      if (btnDiminuer) {
        btnDiminuer.disabled = quantite <= 1;
        btnDiminuer.addEventListener("click", () => {
          if (quantite > 1) {
            actions?.onChangerQuantite?.(quantite - 1);
          }
        });
      }

      if (btnAugmenter) {
        btnAugmenter.disabled = quantite >= stockDisponible;
        btnAugmenter.addEventListener("click", () => {
          if (quantite < stockDisponible) {
            actions?.onChangerQuantite?.(quantite + 1);
          }
        });
      }
    }

    // Bouton d'ajout au panier
    if (btnAjouter) {
      if (combinaisonInexistante) {
        btnAjouter.disabled = true;
        if (txtBouton) txtBouton.textContent = "Combinaison indisponible";
      } else if (estEpuise) {
        btnAjouter.disabled = true;
        if (txtBouton) txtBouton.textContent = "Variante épuisée";
      } else {
        btnAjouter.disabled = false;
        if (txtBouton) txtBouton.textContent = "Ajouter au panier";
        btnAjouter.addEventListener("click", () => {
          actions?.onAjouterPanier?.(produit, quantite, optionsChoisies, varianteActive);
        });
      }
    }


    // Options personnalisables (OPT-c & OPT-b : taille, format, lait, parfum avec stock par combinaison)
    let sectionOptions = fragment.querySelector('[data-ref="section-options"]');
    let listeGroupes = fragment.querySelector('[data-ref="liste-groupes-options"]');

    if (options.length > 0 && sectionOptions && listeGroupes) {
      sectionOptions.classList.remove("hidden");
      sectionOptions.classList.add("flex");

      options.forEach((opt) => {
        let groupeEl = document.createElement("div");
        groupeEl.className = "flex flex-col gap-2.5";

        let labelEl = document.createElement("div");
        labelEl.className = "flex items-center justify-between";

        let spanNom = document.createElement("span");
        spanNom.className = "text-body-sm font-semibold text-content-primary";
        spanNom.textContent = opt.nom;

        let spanBadge = document.createElement("span");
        spanBadge.className = opt.obligatoire ? "text-caption text-default font-medium" : "text-caption text-content-muted";
        spanBadge.textContent = opt.obligatoire ? "Choix requis" : "Optionnel";

        labelEl.appendChild(spanNom);
        labelEl.appendChild(spanBadge);
        groupeEl.appendChild(labelEl);

        let valeurs = Array.isArray(opt.valeurs) ? opt.valeurs : [];
        let estOptionFormat =
          (opt.nom && opt.nom.toLowerCase().includes("format")) || opt.type === "select";

        if (estOptionFormat) {
          // Affichage sous forme de select pour les options de format
          let conteneurSelect = document.createElement("div");
          conteneurSelect.className = "relative";

          let selectEl = document.createElement("select");
          selectEl.className =
            "w-full appearance-none rounded-xl border border-border bg-input px-3.5 py-2.5 pr-10 text-body-sm font-medium text-white transition focus:border-brand focus:outline-hidden disabled:opacity-50 cursor-pointer";

          if (!opt.obligatoire) {
            let optionVide = document.createElement("option");
            optionVide.value = "";
            optionVide.textContent = "Aucun (optionnel)";
            if (!optionsChoisies[opt.id]) {
              optionVide.selected = true;
            }
            selectEl.appendChild(optionVide);
          }

          valeurs.forEach((valeur) => {
            let estChoisie = Number(optionsChoisies[opt.id]) === Number(valeur.id);
            let dispo = evaluerDisponibiliteValeur(opt.id, valeur.id, optionsChoisies, variantes);

            let surcout = Number(valeur.surcout || 0);
            let labelSurcout = surcout > 0 ? ` (+${formaterPrix(surcout)})` : "";

            let optionEl = document.createElement("option");
            optionEl.value = String(valeur.id);

            let indisponible = !dispo.existe || dispo.epuise;
            let suffixe = "";
            if (!dispo.existe) {
              suffixe = " - Indisponible";
            } else if (dispo.epuise) {
              suffixe = " - Épuisé";
            }

            optionEl.textContent = `${valeur.nom}${labelSurcout}${suffixe}`;

            if (indisponible) {
              optionEl.disabled = true;
            }

            if (estChoisie) {
              optionEl.selected = true;
            }

            selectEl.appendChild(optionEl);
          });

          selectEl.addEventListener("change", (e) => {
            let val = e.target.value;
            actions?.onChoisirOption?.(opt.id, val ? Number(val) : null);
          });

          let chevronWrapper = document.createElement("div");
          chevronWrapper.className =
            "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-content-secondary";
          chevronWrapper.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          `;

          conteneurSelect.appendChild(selectEl);
          conteneurSelect.appendChild(chevronWrapper);
          groupeEl.appendChild(conteneurSelect);
        } else {
          // Affichage par boutons / pastilles
          let conteneurValeurs = document.createElement("div");
          conteneurValeurs.className = "flex flex-wrap gap-2";

          valeurs.forEach((valeur) => {
            let estChoisie = Number(optionsChoisies[opt.id]) === Number(valeur.id);
            let dispo = evaluerDisponibiliteValeur(opt.id, valeur.id, optionsChoisies, variantes);

            let btnVal = document.createElement("button");
            btnVal.type = "button";

            let surcout = Number(valeur.surcout || 0);
            let labelSurcout = surcout > 0 ? ` (+${formaterPrix(surcout)})` : "";

            let indisponible = !dispo.existe || dispo.epuise;
            let etiquetteStatut = !dispo.existe ? "Indisponible" : "Épuisé";

            if (indisponible) {
              btnVal.disabled = true;
              btnVal.className = estChoisie
                ? "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/50 bg-red-500/20 text-red-300 text-body-sm font-semibold opacity-60 cursor-not-allowed"
                : "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-zinc-600 bg-black/20 text-content-muted text-body-sm font-medium opacity-50 cursor-not-allowed";
              btnVal.textContent = `${valeur.nom}${labelSurcout} (${etiquetteStatut})`;
            } else {
              btnVal.className = `flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-body-sm font-medium transition cursor-pointer ${
                estChoisie
                  ? "bg-brand text-default border-border font-semibold shadow-2xs"
                  : "border-border bg-input hover:bg-input-hover text-white"
              }`;
              btnVal.textContent = `${valeur.nom}${labelSurcout}`;
              btnVal.addEventListener("click", () => {
                actions?.onChoisirOption?.(opt.id, valeur.id);
              });
            }

            conteneurValeurs.appendChild(btnVal);
          });

          groupeEl.appendChild(conteneurValeurs);
        }

        listeGroupes.appendChild(groupeEl);
      });
    }

    return fragment;
  },
};

export { FicheProduitView };
