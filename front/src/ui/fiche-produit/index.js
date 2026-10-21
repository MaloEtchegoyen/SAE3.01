import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

/**
 * Vue FicheProduitView.
 * Composant de présentation affichant les détails du produit, son prix dynamique,
 * ses options personnalisables (OPT-c), ses variantes éventuelles,
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
   *   onChoisirVariante?: (variante: object|null) => void,
   *   onChoisirOption?: (optionId: number, valeurId: number) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (donnees = {}, actions = {}) {
    let produit = donnees.produit || {};
    let varianteActive = donnees.varianteActive || null;
    let optionsChoisies = donnees.optionsChoisies || {};
    let quantite = Math.max(0, Number(donnees.quantite ?? 0));

    // Détermination du prix de base selon variante ou produit de base
    let prixBase = Number(varianteActive?.prix !== undefined ? varianteActive.prix : (produit.prix ?? 0));
    let stockDisponible = Number(
      varianteActive?.stock !== undefined ? varianteActive.stock : (produit.stock ?? 0)
    );
    let estEpuise = stockDisponible <= 0;

    // Calcul dynamique du surcoût des options personnalisées (OPT-c)
    let options = Array.isArray(produit.options) ? produit.options : [];
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

    let prixDynamique = Math.round((prixBase + surcoutOptions) * 100) / 100;

    let htmlString = genericRenderer(template, {
      nom: produit.nom || "Produit sans nom",
      categorie: produit.categorie || "Café Feuillette",
      prix: formaterPrix(prixDynamique),
      description:
        produit.description ||
        "Ce produit ne possède pas encore de description.",
    });

    let fragment = htmlToFragment(htmlString);

    // Sélecteur de quantité
    let valQuantite = fragment.querySelector('[data-ref="valeur-quantite"]');
    let btnDiminuer = fragment.querySelector('[data-action="diminuer-quantite"]');
    let btnAugmenter = fragment.querySelector('[data-action="augmenter-quantite"]');
    let spanStock = fragment.querySelector('[data-ref="stock-restant"]');
    let btnAjouter = fragment.querySelector('[data-action="ajouter-panier"]');
    let txtBouton = fragment.querySelector('[data-ref="texte-bouton-panier"]');

    if (valQuantite) {
      valQuantite.textContent = String(quantite);
    }

    if (spanStock) {
      if (estEpuise) {
        spanStock.textContent = "Victime de son succès";
        spanStock.classList.add("text-red-600");
      } else if (stockDisponible <= 5) {
        spanStock.textContent = `Plus que ${stockDisponible} en stock`;
        spanStock.classList.add("text-amber-600");
      } else {
        spanStock.textContent = `${stockDisponible} disponibles`;
      }
    }

    if (btnDiminuer) {
      btnDiminuer.disabled = quantite <= 1 || estEpuise;
      btnDiminuer.addEventListener("click", () => {
        if (quantite > 1) {
          actions?.onChangerQuantite?.(quantite - 1);
        }
      });
    }

    if (btnAugmenter) {
      btnAugmenter.disabled = quantite >= stockDisponible || estEpuise;
      btnAugmenter.addEventListener("click", () => {
        if (quantite < stockDisponible) {
          actions?.onChangerQuantite?.(quantite + 1);
        }
      });
    }

    // Gestion du bouton d'ajout au panier avec transmission des options
    if (btnAjouter) {
      if (estEpuise) {
        btnAjouter.disabled = true;
        if (txtBouton) txtBouton.textContent = "Produit épuisé";
      } else {
        btnAjouter.disabled = false;
        btnAjouter.addEventListener("click", () => {
          actions?.onAjouterPanier?.(produit, quantite, optionsChoisies, varianteActive);
        });
      }
    }

    // Variantes / formats si le produit en comporte
    let sectionVariantes = fragment.querySelector('[data-ref="section-variantes"]');
    let listeVariantes = fragment.querySelector('[data-ref="liste-variantes"]');
    let variantes = Array.isArray(produit.variantes) ? produit.variantes : [];

    if (variantes.length > 0 && sectionVariantes && listeVariantes) {
      sectionVariantes.classList.remove("hidden");
      sectionVariantes.classList.add("flex");

      variantes.forEach((variante) => {
        let estChoisie =
          varianteActive?.id !== undefined
            ? Number(varianteActive.id) === Number(variante.id)
            : false;

        let btnVar = document.createElement("button");
        btnVar.type = "button";
        btnVar.className = `px-3.5 py-1.5 rounded-xl border text-sm font-medium transition cursor-pointer ${
          estChoisie
            ? "border-brand bg-brand/10 text-brand font-semibold shadow-2xs"
            : "border-border text-content-secondary hover:border-brand/40"
        }`;
        btnVar.textContent = `${variante.nom} (${formaterPrix(variante.prix)})`;
        btnVar.addEventListener("click", () => {
          actions?.onChoisirVariante?.(estChoisie ? null : variante);
        });
        listeVariantes.appendChild(btnVar);
      });
    }

    // Options personnalisables (OPT-c : taille, parfum, lait, etc.)
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
        spanNom.className = "text-sm font-semibold text-content-primary";
        spanNom.textContent = opt.nom;

        let spanBadge = document.createElement("span");
        spanBadge.className = opt.obligatoire ? "text-xs text-default font-medium" : "text-xs text-content-muted";
        spanBadge.textContent = opt.obligatoire ? "Choix requis" : "Optionnel";

        labelEl.appendChild(spanNom);
        labelEl.appendChild(spanBadge);
        groupeEl.appendChild(labelEl);

        let conteneurValeurs = document.createElement("div");
        conteneurValeurs.className = "flex flex-wrap gap-2";

        let valeurs = Array.isArray(opt.valeurs) ? opt.valeurs : [];
        valeurs.forEach((valeur) => {
          let estChoisie = Number(optionsChoisies[opt.id]) === Number(valeur.id);

          let btnVal = document.createElement("button");
          btnVal.type = "button";
          btnVal.className = `flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition cursor-pointer ${
            estChoisie
              ? "bg-brand text-default border-border font-semibold shadow-2xs"
              : "border-border bg-input hover:bg-input-hover text-white"
          }`;

          let surcout = Number(valeur.surcout || 0);
          let labelSurcout = surcout > 0 ? ` (+${formaterPrix(surcout)})` : "";
          btnVal.textContent = `${valeur.nom}${labelSurcout}`;

          btnVal.addEventListener("click", () => {
            actions?.onChoisirOption?.(opt.id, valeur.id);
          });

          conteneurValeurs.appendChild(btnVal);
        });

        groupeEl.appendChild(conteneurValeurs);
        listeGroupes.appendChild(groupeEl);
      });
    }

    return fragment;
  },
};

export { FicheProduitView };

