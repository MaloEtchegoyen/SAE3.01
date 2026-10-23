import { getRequest } from "../lib/api-request.js";

let StatsData = {};

/**
 * @typedef {Object} StatutsCommandes
 * @property {number} en_cours
 * @property {number} disponible
 * @property {number} retiree
 * @property {number} annulee
 */

/**
 * @typedef {Object} ProduitStock
 * @property {number} id
 * @property {string} nom
 * @property {number} stock
 */

/**
 * @typedef {Object} TopVente
 * @property {string} nom
 * @property {number} quantite
 */

/**
 * @typedef {Object} AlerteStock
 * @property {string} nom
 * @property {number} stock
 * @property {number} seuil
 */

/**
 * @typedef {Object} StatsDashboard
 * @property {number} revenus7Jours
 * @property {number} totalCommandes
 * @property {StatutsCommandes} statutsCommandes
 * @property {ProduitStock[]} stocksParProduit
 * @property {TopVente[]} topVentes
 * @property {AlerteStock[]} alertesStock
 * @property {number} [totalProduits]
 * @property {number} [totalCategories]
 */

/**
 * Récupère les statistiques d'administration en temps réel (PIL-a) :
 * GET /api/admin/stats (réservé aux administrateurs).
 *
 * @returns {Promise<StatsDashboard>}
 */
StatsData.fetch = async function () {
  return getRequest(`admin/stats?_t=${Date.now()}`);
};

export { StatsData };
