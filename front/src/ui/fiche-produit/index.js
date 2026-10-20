import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";

/**
 * Vue FicheProduitView.
 * Composant de présentation affichant les détails du produit, son prix, ses variantes,
 * le sélecteur de quantité et le bouton d'ajout au panier.
 */
let FicheProduitView = {
  /**
   * Construit le DocumentFragment de la fiche produit.
   *
   * @param {{
   *   produit: object,
   *   varianteActive?: object|null,
   *   quantite?: number
   * }} donnees
   * @param {{
   *   onAjouterPanier?: (produit: object, quantite: number, variante: object|null) => void,
   *   onChangerQuantite?: (nouvelleQuantite: number) => void,
   *   onChoisirVariante?: (variante: object|null) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (donnees = {}, actions = {}) {
    let produit = donnees.produit || {};
    let varianteActive = donnees.varianteActive || null;
    let quantite = Math.max(0, Number(donnees.quantite ?? 0));

    // Détermination du prix et du stock selon variante ou produit de base
    let prixActif = varianteActive?.prix !== undefined ? varianteActive.prix : produit.prix;
    let stockDisponible = Number(
      varianteActive?.stock !== undefined ? varianteActive.stock : (produit.stock ?? 0)
    );
    let estEpuise = stockDisponible <= 0;

    let htmlString = genericRenderer(template, {
      nom: produit.nom || "Produit sans nom",
      categorie: produit.categorie || "Café Feuillette",
      prix: formaterPrix(prixActif),
      description:
        produit.description ||
        "Ce produits ne possède pas encore de description.",
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

    // Gestion du bouton d'ajout au panier
    if (btnAjouter) {
      if (estEpuise) {
        btnAjouter.disabled = true;
        if (txtBouton) txtBouton.textContent = "Produit épuisé";
      } else {
        btnAjouter.disabled = false;
        btnAjouter.addEventListener("click", () => {
          actions?.onAjouterPanier?.(produit, quantite, varianteActive);
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
            ? "border-brand bg-brand/10 text-brand font-semibold"
            : "border-border text-content-secondary hover:border-brand/40"
        }`;
        btnVar.textContent = `${variante.nom} (${formaterPrix(variante.prix)})`;
        btnVar.addEventListener("click", () => {
          actions?.onChoisirVariante?.(estChoisie ? null : variante);
        });
        listeVariantes.appendChild(btnVar);
      });
    }

    return fragment;
  },
};

export { FicheProduitView };

