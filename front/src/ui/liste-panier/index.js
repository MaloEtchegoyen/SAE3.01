import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { resoudreUrlImage } from "../carte-produit/index.js";
import template from "./template.html?raw";
import ligneTemplate from "./ligne-panier.html?raw";
import videTemplate from "./vide.html?raw";

/**
 * Composant UI ListePanierView.
 * Affiche les lignes d'articles du panier, l'édition in situ des options (OPT-a, OPT-b, OPT-c)
 * et branche les événements de modification/suppression.
 */
let ListePanierView = {
  /**
   * Construit le DOM de la liste des articles.
   *
   * @param {Array<object>} articles
   * @param {{
   *   cleEdition?: string|null,
   *   optionsChoisiesEdition?: Record<string|number, number>,
   *   varianteActiveEdition?: object|null,
   *   produitsDetails?: Record<string|number, object>
   * }} etatEdition
   * @param {{
   *   onModifierQuantite?: (cle: string, nouvelleQuantite: number) => void,
   *   onSupprimer?: (cle: string) => void,
   *   onOuvrirEdition?: (cle: string) => void,
   *   onFermerEdition?: () => void,
   *   onChoisirOptionEdition?: (optionId: number, valeurId: number) => void,
   *   onValiderEdition?: (cle: string) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (articles = [], etatEdition = {}, actions = {}) {
    if (!articles || articles.length === 0) {
      return htmlToFragment(videTemplate);
    }

    let fragment = htmlToFragment(template);
    let conteneurLignes = fragment.querySelector('[data-ref="liste-lignes"]');

    articles.forEach((article) => {
      let qte = Number(article.quantite || 1);
      let prixUnitaire = Number(article.prix || 0);
      let totalLigne = qte * prixUnitaire;
      let imageUrl = resoudreUrlImage(article.image);
      let optionNom = article.nomVariante ? String(article.nomVariante) : "";

      let produitDetail = etatEdition?.produitsDetails?.[article.produitId] || null;
      let optionsProduit = Array.isArray(produitDetail?.options) ? produitDetail.options : [];
      let variantesProduit = Array.isArray(produitDetail?.variantes) ? produitDetail.variantes : [];
      let peutPersonnaliser =
        optionsProduit.length > 0 ||
        variantesProduit.length > 0 ||
        Boolean(article.nomVariante) ||
        (Array.isArray(article.options) && article.options.length > 0);

      let estEnEdition = etatEdition?.cleEdition === article.cle;

      let ligneHtml = genericRenderer(ligneTemplate, {
        cle: article.cle,
        nom: article.nom,
        option: optionNom,
        classe_option: optionNom ? "" : "hidden",
        classe_btn_modifier: peutPersonnaliser ? "" : "hidden",
        classe_panneau_edition: estEnEdition ? "" : "hidden",
        prix_unitaire: formaterPrix(prixUnitaire),
        quantite: String(qte),
        total_ligne: formaterPrix(totalLigne),
        image_url: imageUrl,
      });

      let ligneFragment = htmlToFragment(ligneHtml);
      let articleEl = ligneFragment.firstElementChild;

      let btnDiminuer = articleEl.querySelector('[data-action="diminuer"]');
      let btnAugmenter = articleEl.querySelector('[data-action="augmenter"]');
      let btnSupprimer = articleEl.querySelector('[data-action="supprimer"]');
      let btnModifierOptions = articleEl.querySelector('[data-action="modifier-options"]');

      if (btnDiminuer) {
        btnDiminuer.disabled = qte <= 1;
        btnDiminuer.addEventListener("click", () => {
          if (qte > 1) {
            actions?.onModifierQuantite?.(article.cle, qte - 1);
          }
        });
      }

      if (btnAugmenter) {
        let stockMax = Number(article.stockMax || 99);
        btnAugmenter.disabled = qte >= stockMax;
        btnAugmenter.addEventListener("click", () => {
          if (qte < stockMax) {
            actions?.onModifierQuantite?.(article.cle, qte + 1);
          }
        });
      }

      if (btnSupprimer) {
        btnSupprimer.addEventListener("click", () => {
          actions?.onSupprimer?.(article.cle);
        });
      }

      if (btnModifierOptions) {
        btnModifierOptions.addEventListener("click", () => {
          if (estEnEdition) {
            actions?.onFermerEdition?.();
          } else {
            actions?.onOuvrirEdition?.(article.cle);
          }
        });
      }

      // Si cet article est actuellement en mode édition in situ
      if (estEnEdition) {
        let optionsChoisies = etatEdition.optionsChoisiesEdition || {};
        let varianteActive = etatEdition.varianteActiveEdition || null;

        // Évaluation de la disponibilité et du stock pour cette combinaison
        let variantesAvecValeurs = variantesProduit.filter(
          (v) => Array.isArray(v.valeur_ids) && v.valeur_ids.length > 0
        );

        let stockDisponible = 0;
        let combinaisonInexistante = false;

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
          stockDisponible = Number(produitDetail?.stock ?? article.stockMax ?? 99);
        }

        let estEpuise = stockDisponible <= 0;

        // Calcul du prix unitaire en édition
        let prixEdition = 0;
        if (varianteActive?.prix !== undefined) {
          prixEdition = Number(varianteActive.prix);
        } else {
          let surcout = 0;
          optionsProduit.forEach((opt) => {
            let valIdChoisi = optionsChoisies[opt.id];
            if (valIdChoisi && Array.isArray(opt.valeurs)) {
              let valTrouvee = opt.valeurs.find((v) => Number(v.id) === Number(valIdChoisi));
              if (valTrouvee) {
                surcout += Number(valTrouvee.surcout || 0);
              }
            }
          });
          let basePrix = Number(produitDetail?.prix ?? article.prix ?? 0);
          prixEdition = Math.round((basePrix + surcout) * 100) / 100;
        }

        let refStatutStock = articleEl.querySelector('[data-ref="statut-stock-edition"]');
        let refNouveauPrix = articleEl.querySelector('[data-ref="nouveau-prix-edition"]');
        let btnValider = articleEl.querySelector('[data-action="valider-edition"]');
        let btnAnnuler = articleEl.querySelector('[data-action="annuler-edition"]');
        let conteneurGroupes = articleEl.querySelector('[data-ref="groupes-options-edition"]');

        if (refNouveauPrix) {
          refNouveauPrix.textContent = `${formaterPrix(prixEdition)} / unité`;
        }

        if (refStatutStock) {
          if (combinaisonInexistante) {
            refStatutStock.textContent = "Combinaison indisponible";
            refStatutStock.className = "text-caption font-semibold text-red-500";
          } else if (estEpuise) {
            refStatutStock.textContent = "Victime de son succès";
            refStatutStock.className = "text-caption font-semibold text-red-500";
          } else {
            refStatutStock.textContent = `En stock (${stockDisponible} dispo)`;
            refStatutStock.className = "text-caption font-semibold text-emerald-600";
          }
        }

        if (btnValider) {
          btnValider.disabled = combinaisonInexistante || estEpuise;
          btnValider.addEventListener("click", () => {
            actions?.onValiderEdition?.(article.cle);
          });
        }

        if (btnAnnuler) {
          btnAnnuler.addEventListener("click", () => {
            actions?.onFermerEdition?.();
          });
        }

        // Rendu des options
        if (conteneurGroupes && optionsProduit.length > 0) {
          optionsProduit.forEach((opt) => {
            let groupeEl = document.createElement("div");
            groupeEl.className = "flex flex-col gap-1.5";

            let labelEl = document.createElement("div");
            labelEl.className = "flex items-center justify-between";

            let spanNom = document.createElement("span");
            spanNom.className = "text-body-sm font-semibold text-content-primary";
            spanNom.textContent = opt.nom;

            let spanBadge = document.createElement("span");
            spanBadge.className = opt.obligatoire
              ? "text-caption text-brand font-medium"
              : "text-caption text-content-muted";
            spanBadge.textContent = opt.obligatoire ? "Requis" : "Optionnel";

            labelEl.appendChild(spanNom);
            labelEl.appendChild(spanBadge);
            groupeEl.appendChild(labelEl);

            let valeursConteneur = document.createElement("div");
            valeursConteneur.className = "flex flex-wrap gap-2";

            let valeurs = Array.isArray(opt.valeurs) ? opt.valeurs : [];
            valeurs.forEach((val) => {
              let estSelectionne = Number(optionsChoisies[opt.id]) === Number(val.id);
              let btnValeur = document.createElement("button");
              btnValeur.type = "button";

              let surcoutText = "";
              let sc = Number(val.surcout || 0);
              if (sc > 0) {
                surcoutText = ` (+${formaterPrix(sc)})`;
              }

              btnValeur.textContent = `${val.nom}${surcoutText}`;

              if (estSelectionne) {
                btnValeur.className =
                  "rounded-lg border border-brand bg-brand-subtle px-3 py-1.5 text-caption font-semibold text-brand transition shadow-2xs cursor-pointer";
              } else {
                btnValeur.className =
                  "rounded-lg border border-border bg-white px-3 py-1.5 text-caption font-medium text-content-secondary hover:border-neutral-400 hover:text-content-primary transition cursor-pointer";
              }

              btnValeur.addEventListener("click", () => {
                actions?.onChoisirOptionEdition?.(Number(opt.id), Number(val.id));
              });

              valeursConteneur.appendChild(btnValeur);
            });

            groupeEl.appendChild(valeursConteneur);
            conteneurGroupes.appendChild(groupeEl);
          });
        }
      }

      conteneurLignes.appendChild(ligneFragment);
    });

    return fragment;
  },
};

export { ListePanierView };
