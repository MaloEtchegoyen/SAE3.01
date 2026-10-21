import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import template from "./template.html?raw";
import templateLigne from "./ligne-commande.html?raw";
import templateVide from "./vide.html?raw";

/**
 * Met en forme une chaîne de date ISO ou MySQL au format JJ/MM/AAAA.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formaterDate(dateStr) {
  if (!dateStr) return "-";
  try {
    let date = new Date(dateStr.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Vue interactive pour le tableau d'administration des commandes.
 */
let TableCommandesView = {
  /**
   * Construit le DOM du tableau des commandes et branche les interactions.
   *
   * @param {{
   *   commandes: Array<{
   *     id: number,
   *     numero_commande: string,
   *     utilisateur_id: number,
   *     utilisateur_login: string,
   *     statut: string,
   *     total: number,
   *     date_commande: string,
   *     nb_articles: number
   *   }>,
   *   tri: string,
   *   statut: string,
   *   date?: string,
   *   montant?: string|number,
   *   selection?: Set<number>
   * }} data
   * @param {{
   *   surTri?: (tri: string) => void,
   *   surFiltrer?: (criteres: { statut: string, date: string, montant: string }) => void,
   *   surChangerStatut?: (id: number, nouveauStatut: string) => void,
   *   surDemanderAnnulation?: (id: number) => void,
   *   surVoirDetail?: (id: number) => void,
   *   surSelection?: (id: number, coche: boolean) => void,
   *   surToutSelectionner?: (coche: boolean) => void,
   *   surActionLot?: (action: string) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(template);

    let commandes = data.commandes || [];
    let triActuel = data.tri || "date_desc";
    let statutFiltre = data.statut || "";
    let dateFiltre = data.date || "";
    let montantFiltre = data.montant !== undefined && data.montant !== null ? String(data.montant) : "";
    let selection = data.selection || new Set();

    // 1. Initialiser les champs de filtres
    let selectStatut = fragment.querySelector('[data-action="filtre-statut"]');
    if (selectStatut) {
      selectStatut.value = statutFiltre;
    }

    let inputDate = fragment.querySelector('[data-action="filtre-date"]');
    if (inputDate) {
      inputDate.value = dateFiltre;
    }

    let inputMontant = fragment.querySelector('[data-action="filtre-montant"]');
    if (inputMontant) {
      inputMontant.value = montantFiltre;
    }

    // 1b. Soumission de la recherche via le formulaire / bouton « Valider la recherche »
    let formFiltres = fragment.querySelector('[data-action="form-filtres"]');
    if (formFiltres && typeof actions.surFiltrer === "function") {
      formFiltres.addEventListener("submit", (e) => {
        e.preventDefault();
        actions.surFiltrer({
          statut: selectStatut ? selectStatut.value : "",
          date: inputDate ? inputDate.value.trim() : "",
          montant: inputMontant ? inputMontant.value.trim() : "",
        });
      });
    }

    // 2. Gestion des tris (Date, Statut, Montant)
    let btnTriDate = fragment.querySelector('[data-action="trier-date"]');
    let iconeTriDate = fragment.querySelector("[data-icone-tri-date]");
    if (iconeTriDate) {
      iconeTriDate.innerHTML = triActuel === "date_asc" ? "&uarr;" : triActuel === "date_desc" ? "&darr;" : "&udarr;";
    }
    if (btnTriDate && typeof actions.surTri === "function") {
      btnTriDate.addEventListener("click", () => {
        let nouveauTri = triActuel === "date_desc" ? "date_asc" : "date_desc";
        actions.surTri(nouveauTri);
      });
    }

    let btnTriStatut = fragment.querySelector('[data-action="trier-statut"]');
    let iconeTriStatut = fragment.querySelector("[data-icone-tri-statut]");
    if (iconeTriStatut) {
      iconeTriStatut.innerHTML = triActuel === "statut_asc" ? "&uarr;" : triActuel === "statut_desc" ? "&darr;" : "&udarr;";
    }
    if (btnTriStatut && typeof actions.surTri === "function") {
      btnTriStatut.addEventListener("click", () => {
        let nouveauTri = triActuel === "statut_asc" ? "statut_desc" : "statut_asc";
        actions.surTri(nouveauTri);
      });
    }

    let btnTriMontant = fragment.querySelector('[data-action="trier-montant"]');
    let iconeTriMontant = fragment.querySelector("[data-icone-tri-montant]");
    if (iconeTriMontant) {
      iconeTriMontant.innerHTML = triActuel === "montant_desc" ? "&darr;" : triActuel === "montant_asc" ? "&uarr;" : "&udarr;";
    }
    if (btnTriMontant && typeof actions.surTri === "function") {
      btnTriMontant.addEventListener("click", () => {
        let nouveauTri = triActuel === "montant_desc" ? "montant_asc" : "montant_desc";
        actions.surTri(nouveauTri);
      });
    }

    // 3. Actions en lot et case "Tout sélectionner"
    let zoneLot = fragment.querySelector("[data-zone-lot]");
    let pCompteurSelection = fragment.querySelector("[data-compteur-selection]");
    let nbSelection = selection.size;

    if (zoneLot) {
      if (nbSelection > 0) {
        zoneLot.classList.remove("hidden");
        zoneLot.classList.add("flex");
        if (pCompteurSelection) {
          pCompteurSelection.textContent = String(nbSelection);
        }
      } else {
        zoneLot.classList.add("hidden");
        zoneLot.classList.remove("flex");
      }
    }

    let boutonsLot = fragment.querySelectorAll("[data-action-lot]");
    for (let b = 0; b < boutonsLot.length; b++) {
      let btnLot = boutonsLot[b];
      let actionCible = btnLot.getAttribute("data-action-lot");
      btnLot.addEventListener("click", () => {
        if (typeof actions.surActionLot === "function") {
          actions.surActionLot(actionCible);
        }
      });
    }

    let checkTout = fragment.querySelector('[data-action="tout-selectionner"]');
    if (checkTout) {
      let nbTotal = commandes.length;
      let tousCoches = nbTotal > 0 && commandes.every((c) => selection.has(c.id));
      let auMoinsUnCoche = commandes.some((c) => selection.has(c.id));

      checkTout.checked = tousCoches;
      checkTout.indeterminate = !tousCoches && auMoinsUnCoche;

      checkTout.addEventListener("change", (e) => {
        if (typeof actions.surToutSelectionner === "function") {
          actions.surToutSelectionner(e.target.checked);
        }
      });
    }

    // 4. Compteur de commandes affichées
    let pCompteur = fragment.querySelector("[data-compteur-commandes]");
    if (pCompteur) {
      let nb = commandes.length;
      pCompteur.textContent = `${nb} commande${nb > 1 ? "s" : ""} affichée${nb > 1 ? "s" : ""}`;
    }

    // 5. Corps de table ou état vide
    let corpsTable = fragment.querySelector("[data-corps-table]");

    if (commandes.length === 0) {
      let trVide = document.createElement("tr");
      let tdVide = document.createElement("td");
      tdVide.colSpan = 7;
      tdVide.className = "p-0";
      tdVide.appendChild(htmlToFragment(templateVide));
      trVide.appendChild(tdVide);
      corpsTable.appendChild(trVide);
      return fragment;
    }

    let nbCmd = commandes.length;
    for (let i = 0; i < nbCmd; i++) {
      let cmd = commandes[i];
      let ligneFrag = htmlToFragment(
        genericRenderer(templateLigne, {
          id: cmd.id,
          numero_commande: cmd.numero_commande,
          utilisateur_login: cmd.utilisateur_login || "Client",
          date_formatee: formaterDate(cmd.date_commande),
          total_formate: formaterPrix(cmd.total),
        })
      );

      // Case à cocher de la ligne
      let checkLigne = ligneFrag.querySelector('[data-action="selectionner-ligne"]');
      if (checkLigne) {
        checkLigne.checked = selection.has(cmd.id);
        checkLigne.addEventListener("change", (e) => {
          if (typeof actions.surSelection === "function") {
            actions.surSelection(cmd.id, e.target.checked);
          }
        });
      }

      // Sélecteur de statut individuel dans la cellule
      let selectLigne = ligneFrag.querySelector('[data-action="changer-statut"]');
      if (selectLigne) {
        selectLigne.value = cmd.statut;
        selectLigne.addEventListener("change", (e) => {
          let nouveauStatut = e.target.value;
          if (nouveauStatut === "annulée") {
            if (typeof actions.surDemanderAnnulation === "function") {
              actions.surDemanderAnnulation(cmd.id);
            }
          } else if (typeof actions.surChangerStatut === "function") {
            actions.surChangerStatut(cmd.id, nouveauStatut);
          }
        });
      }

      // Bouton Détails
      let btnDetail = ligneFrag.querySelector('[data-action="detail"]');
      if (btnDetail && typeof actions.surVoirDetail === "function") {
        btnDetail.addEventListener("click", () => actions.surVoirDetail(cmd.id));
      }

      corpsTable.appendChild(ligneFrag);
    }

    return fragment;
  },
};

export { TableCommandesView };
