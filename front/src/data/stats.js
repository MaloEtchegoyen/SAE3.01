import { getRequest } from "../lib/api-request.js";

let StatsData = {};

/**
 * Statistiques du catalogue : GET /api/admin/stats, réservé aux
 * administrateurs (401 sans connexion, 403 sans le rôle admin).
 *
 * @returns {Promise<{ totalProduits: number, totalCategories: number }>}
 */
StatsData.fetch = async function () {
  return getRequest("admin/stats");
};

export { StatsData };
