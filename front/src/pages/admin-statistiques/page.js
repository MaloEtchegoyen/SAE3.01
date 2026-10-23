import { StatsData } from "../../data/stats.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableauBordStatsView } from "../../ui/tableau-bord-stats/index.js";
import template from "./template.html?raw";

/**
 * Page « Statistiques » - Tableau de bord statistiques (PIL-a).
 */

let M = {
  stats: null, // Données statistiques retournées par l'API
  message: null, // { type, texte }
  chargement: false,
};

let C = {};

/**
 * Charge les statistiques fraîches depuis l'API.
 */
C.chargerStats = async function () {
  M.chargement = true;
  try {
    M.stats = await StatsData.fetch();
  } catch (erreur) {
    M.stats = null;

    let texte = erreur.message;
    if (erreur.statut === 401) texte = "Vous n'êtes pas connecté.";
    if (erreur.statut === 403) texte = "Accès réservé aux administrateurs.";

    M.message = { type: "erreur", texte };
  } finally {
    M.chargement = false;
  }
};

/**
 * Rafraîchit les statistiques à la demande (Données à jour).
 */
C.rafraichirDonnees = async function () {
  await C.chargerStats();
  if (M.stats !== null) {
    M.message = { type: "succes", texte: "Statistiques actualisées en direct." };
  }
  V.rafraichir();
};

/**
 * Exporte l'ensemble des statistiques au format CSV (DoD PIL-a).
 */
C.exporterStats = function () {
  if (!M.stats) {
    M.message = { type: "erreur", texte: "Aucune statistique disponible pour l'export." };
    V.rafraichir();
    return;
  }

  let s = M.stats;
  let dateExport = new Date().toLocaleDateString("fr-FR");
  let heureExport = new Date().toLocaleTimeString("fr-FR");
  let lignes = [];

  // UTF-8 BOM pour ouverture correcte dans Excel
  lignes.push("Café Feuillette - Export des Statistiques");
  lignes.push(`Généré le;${dateExport} à ${heureExport}`);
  lignes.push("");

  // 1. Revenus des 7 derniers jours
  lignes.push("1. REVENUS");
  lignes.push("Indicateur;Valeur");
  let revenus = Number(s.revenus7Jours) || 0;
  lignes.push(`Revenus des 7 derniers jours;${revenus.toFixed(2).replace(".", ",")} €`);
  lignes.push("");

  // 2. Statuts des commandes
  let statuts = s.statutsCommandes || {};
  lignes.push("2. STATUTS DES COMMANDES");
  lignes.push("Statut;Nombre");
  lignes.push(`En cours;${statuts.en_cours ?? 0}`);
  lignes.push(`Disponible;${statuts.disponible ?? 0}`);
  lignes.push(`Retirée;${statuts.retiree ?? 0}`);
  lignes.push(`Annulée;${statuts.annulee ?? 0}`);
  lignes.push(`Total commandes;${s.totalCommandes ?? 0}`);
  lignes.push("");

  // 3. Top ventes 7 derniers jours
  lignes.push("3. TOP VENTES (7 derniers jours)");
  lignes.push("Produit;Unités vendues");
  let topVentes = Array.isArray(s.topVentes) ? s.topVentes : [];
  for (let i = 0; i < topVentes.length; i++) {
    let nom = String(topVentes[i].nom).replaceAll(";", ",");
    lignes.push(`${nom};${topVentes[i].quantite}`);
  }
  lignes.push("");

  // 4. Alertes de stock faible
  lignes.push("4. ALERTES DE STOCK FAIBLE");
  lignes.push("Produit / option;Stock disponible;Seuil d'alerte");
  let alertes = Array.isArray(s.alertesStock) ? s.alertesStock : [];
  for (let i = 0; i < alertes.length; i++) {
    let nom = String(alertes[i].nom).replaceAll(";", ",");
    lignes.push(`${nom};${alertes[i].stock};${alertes[i].seuil}`);
  }
  lignes.push("");

  // 5. Stocks par produit
  lignes.push("5. NIVEAU DES STOCKS PAR PRODUIT");
  lignes.push("Produit;Stock actuel");
  let stocks = Array.isArray(s.stocksParProduit) ? s.stocksParProduit : [];
  for (let i = 0; i < stocks.length; i++) {
    let nom = String(stocks[i].nom).replaceAll(";", ",");
    lignes.push(`${nom};${stocks[i].stock}`);
  }

  let contenuCsv = "\uFEFF" + lignes.join("\r\n");
  let blob = new Blob([contenuCsv], { type: "text/csv;charset=utf-8;" });
  let url = URL.createObjectURL(blob);
  let lien = document.createElement("a");
  let dateFichier = new Date().toISOString().slice(0, 10);
  lien.setAttribute("href", url);
  lien.setAttribute("download", `statistiques-feuillette-${dateFichier}.csv`);
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
};

C.init = async function () {
  M.message = null;
  await C.chargerStats();
  if (M.stats === null) {
    navigate("/connexion-admin");
    return document.createDocumentFragment();
  }
  return V.init();
};

let V = {};

V.racine = null; // Élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Message de statut ou d'erreur
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Zone des statistiques complètes PIL-a
  let slotStats = pageFragment.querySelector('slot[name="statistiques"]');
  if (slotStats) {
    if (M.stats === null) {
      slotStats.remove();
    } else {
      slotStats.replaceWith(TableauBordStatsView.dom(M.stats));
    }
  }

  // Branchement des actions de l'en-tête
  let btnRafraichir = pageFragment.querySelector('[data-action="rafraichir-stats"]');
  if (btnRafraichir) {
    btnRafraichir.addEventListener("click", () => {
      C.rafraichirDonnees();
    });
  }

  let btnExporter = pageFragment.querySelector('[data-action="exporter-stats"]');
  if (btnExporter) {
    btnExporter.addEventListener("click", () => {
      C.exporterStats();
    });
  }

  return pageFragment;
};

/**
 * Page d'administration - Statistiques complètes (PIL-a).
 *
 * @returns {Promise<DocumentFragment>}
 */
export function AdminStatistiquesPage() {
  return C.init();
}

