import { getRequest } from "../lib/api-request.js";

let ProductData = {};

/**
 * Récupère la liste de tous les produits pour l'administration :
 * GET /api/admin/products (réservé aux administrateurs).
 *
 * @returns {Promise<Array<{
 *   id: number,
 *   nom: string,
 *   category_id: number|null,
 *   categorie: string,
 *   prix: number,
 *   stock: number,
 *   seuil_alerte: number,
 *   description: string|null
 * }>>}
 */
ProductData.fetchAll = async function () {
  return getRequest("admin/products");
};

export { ProductData };

