import { getRequest, postRequest, putRequest, deleteRequest } from "../lib/api-request.js";

let ProductData = {};

/**
 * Récupère la liste de tous les produits pour le catalogue public :
 * GET /api/products.
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
  return getRequest("products");
};

/**
 * Récupère la liste de toutes les catégories pour le catalogue public :
 * GET /api/categories.
 *
 * @returns {Promise<Array<{ id: number, nom: string }>>}
 */
ProductData.fetchCategories = async function () {
  return getRequest("categories");
};

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
ProductData.fetchAllAdmin = async function () {
  return getRequest("admin/products");
};

/**
 * Récupère la liste de toutes les catégories pour l'administration :
 * GET /api/admin/categories (réservé aux administrateurs).
 *
 * @returns {Promise<Array<{ id: number, nom: string }>>}
 */
ProductData.fetchCategoriesAdmin = async function () {
  return getRequest("admin/categories");
};

/**
 * Crée un nouveau produit :
 * POST /api/admin/products.
 *
 * @param {{
 *   nom: string,
 *   prix: number,
 *   category_id?: number|null,
 *   stock?: number,
 *   seuil_alerte?: number,
 *   description?: string|null
 * }} donnees
 * @returns {Promise<{ succes: boolean, id: number, message: string }>}
 */
ProductData.create = async function (donnees) {
  return postRequest("admin/products", donnees);
};

/**
 * Met à jour les informations d'un produit existant :
 * PUT /api/admin/products?id=...
 *
 * @param {number} id
 * @param {{
 *   nom: string,
 *   prix: number,
 *   category_id?: number|null,
 *   stock?: number,
 *   seuil_alerte?: number,
 *   description?: string|null
 * }} donnees
 * @returns {Promise<{ succes: boolean, message: string }>}
 */
ProductData.update = async function (id, donnees) {
  return putRequest(`admin/products?id=${id}`, { id, ...donnees });
};

/**
 * Ajoute une image associée à un produit :
 * POST /api/admin/products/images.
 *
 * @param {{
 *   product_id: number,
 *   url: string,
 *   alt?: string|null,
 *   est_principale?: boolean,
 *   ordre?: number
 * }} donnees
 * @returns {Promise<{ succes: boolean, id: number, message: string }>}
 */
ProductData.addImage = async function (donnees) {
  return postRequest("admin/products/images", donnees);
};

/**
 * Supprime définitivement un produit de la base de données :
 * DELETE /api/admin/products.
 *
 * @param {number} id
 * @param {boolean} [definitif=true]
 * @returns {Promise<{ succes: boolean, message: string }>}
 */
ProductData.delete = async function (id, definitif = true) {
  let paramDefinitif = definitif ? "1" : "0";
  return deleteRequest(`admin/products?id=${id}&definitif=${paramDefinitif}`, { id, definitif });
};

export { ProductData };

