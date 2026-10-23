import { formaterPrix } from "../../lib/format.js";
import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

let TableauBordStatsView = {
  /**
   * Construit le DOM complet du tableau de bord statistique (PIL-a).
   *
   * @param {import("../../data/stats.js").StatsDashboard} stats
   * @param {Object} [actions]
   * @returns {DocumentFragment}
   */
  dom: function (stats, actions = {}) {
    let statuts = stats?.statutsCommandes || {
      en_cours: 0,
      disponible: 0,
      retiree: 0,
      annulee: 0,
    };

    let fragment = htmlToFragment(
      genericRenderer(template, {
        revenus7JoursFormate: formaterPrix(stats?.revenus7Jours ?? 0),
        statutEnCours: statuts.en_cours ?? 0,
        statutDisponible: statuts.disponible ?? 0,
        statutRetiree: statuts.retiree ?? 0,
        statutAnnulee: statuts.annulee ?? 0,
      })
    );

    // 1. Remplissage de l'histogramme des stocks par produit
    let conteneurHistogramme = fragment.querySelector('[data-ref="histogramme"]');
    if (conteneurHistogramme) {
      let produits = Array.isArray(stats?.stocksParProduit) ? stats.stocksParProduit : [];

      if (produits.length === 0) {
        let vide = document.createElement("p");
        vide.className = "text-white/70 text-body-sm italic py-8 text-center w-full";
        vide.textContent = "Aucun produit disponible dans le catalogue.";
        conteneurHistogramme.appendChild(vide);
      } else {
        let maxStock = Math.max(...produits.map((p) => Number(p.stock) || 0), 1);

        for (let i = 0; i < produits.length; i++) {
          let p = produits[i];
          let stock = Number(p.stock) || 0;
          let hauteurPourcent = stock > 0 ? Math.max(6, Math.round((stock / maxStock) * 100)) : 2;

          let col = document.createElement("div");
          col.className =
            "flex flex-col items-center flex-1 min-w-[3.5rem] max-w-[4.5rem] h-full justify-end group";

          // Nombre au-dessus de la barre
          let valeur = document.createElement("span");
          valeur.className =
            "text-caption font-semibold text-white/90 mb-1 transition-transform group-hover:scale-110";
          valeur.textContent = String(stock);

          // Zone de barre
          let zoneBarre = document.createElement("div");
          zoneBarre.className =
            "w-full flex items-end justify-center h-full max-h-[8rem] sm:max-h-[10rem]";

          let barre = document.createElement("div");
          barre.className =
            "w-5 sm:w-6 bg-sand-500 rounded-t-sm transition-all duration-300 group-hover:bg-sand-400";
          barre.style.height = `${hauteurPourcent}%`;

          zoneBarre.appendChild(barre);

          // Nom du produit en dessous
          let etiquette = document.createElement("span");
          etiquette.className =
            "text-[11px] sm:text-caption font-medium text-white/80 mt-2 text-center truncate w-full cursor-default";
          etiquette.title = p.nom;
          etiquette.textContent = p.nom;

          col.appendChild(valeur);
          col.appendChild(zoneBarre);
          col.appendChild(etiquette);

          conteneurHistogramme.appendChild(col);
        }
      }
    }

    // 2. Remplissage du tableau des Top ventes (7 derniers jours)
    let tbodyTopVentes = fragment.querySelector('[data-ref="top-ventes-body"]');
    if (tbodyTopVentes) {
      let ventes = Array.isArray(stats?.topVentes) ? stats.topVentes : [];

      if (ventes.length === 0) {
        let tr = document.createElement("tr");
        tr.innerHTML =
          '<td colspan="2" class="py-4 px-4 text-center text-white/70 italic text-caption sm:text-body-sm">Aucune vente enregistrée sur les 7 derniers jours.</td>';
        tbodyTopVentes.appendChild(tr);
      } else {
        for (let i = 0; i < ventes.length; i++) {
          let item = ventes[i];
          let tr = document.createElement("tr");
          tr.className = "border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors";

          let tdNom = document.createElement("td");
          tdNom.className = "py-2.5 px-4 text-white font-medium";
          tdNom.textContent = item.nom;

          let tdQte = document.createElement("td");
          tdQte.className = "py-2.5 px-4 text-right text-white/90 font-semibold";
          tdQte.textContent = String(item.quantite);

          tr.appendChild(tdNom);
          tr.appendChild(tdQte);
          tbodyTopVentes.appendChild(tr);
        }
      }
    }

    // 3. Remplissage du tableau des Alertes de stock faible
    let tbodyAlertes = fragment.querySelector('[data-ref="alertes-stock-body"]');
    if (tbodyAlertes) {
      let alertes = Array.isArray(stats?.alertesStock) ? stats.alertesStock : [];

      if (alertes.length === 0) {
        let tr = document.createElement("tr");
        tr.innerHTML =
          '<td colspan="3" class="py-4 px-4 text-center text-white/70 italic text-caption sm:text-body-sm">Aucun produit en rupture ou en alerte de stock.</td>';
        tbodyAlertes.appendChild(tr);
      } else {
        for (let i = 0; i < alertes.length; i++) {
          let alerte = alertes[i];
          let stock = Number(alerte.stock) || 0;
          let seuil = Number(alerte.seuil) || 0;

          let tr = document.createElement("tr");
          tr.className = "border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors";

          let tdNom = document.createElement("td");
          tdNom.className = "py-2.5 px-4 text-white font-medium";
          tdNom.textContent = alerte.nom;

          let tdStock = document.createElement("td");
          tdStock.className = "py-2.5 px-4 text-center font-bold";
          if (stock === 0) {
            tdStock.className += " text-red-200";
            tdStock.textContent = "0 (épuisé)";
          } else {
            tdStock.className += " text-sand-300";
            tdStock.textContent = String(stock);
          }

          let tdSeuil = document.createElement("td");
          tdSeuil.className = "py-2.5 px-4 text-right text-white/75";
          tdSeuil.textContent = String(seuil);

          tr.appendChild(tdNom);
          tr.appendChild(tdStock);
          tr.appendChild(tdSeuil);
          tbodyAlertes.appendChild(tr);
        }
      }
    }

    return fragment;
  },
};

export { TableauBordStatsView };

