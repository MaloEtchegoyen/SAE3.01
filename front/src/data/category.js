import { getRequest, postRequest, putRequest, deleteRequest } from "../lib/api-request.js";

let CategoryData = {};

/**
 * Récupère la liste de toutes les catégories pour le catalogue public :
 * GET /api/categories.
 *
 * @returns {Promise<Array<{ id: number, nom: string, description?: string, nombre_produits?: number }>>}
 */
CategoryData.fetchAll = async function () {
  return getRequest("categories");
};

/**
 * Récupère la liste des catégories pour l'administration :
 * GET /api/admin/categories.
 *
 * @returns {Promise<Array<{ id: number, nom: string, description: string, nombre_produits: number }>>}
 */
CategoryData.fetchAllAdmin = async function () {
  return getRequest("admin/categories");
};

/**
 * Crée une nouvelle catégorie :
 * POST /api/admin/categories.
 *
 * @param {{ nom: string, description?: string }} donnees
 * @returns {Promise<{ succes: boolean, id: number, message: string }>}
 */
CategoryData.create = async function (donnees) {
  return postRequest("admin/categories", {
    nom: (donnees.nom || "").trim(),
    description: (donnees.description || "").trim(),
  });
};

/**
 * Modifie une catégorie existante :
 * PUT /api/admin/categories?id=...
 *
 * @param {number} id
 * @param {{ nom: string, description?: string }} donnees
 * @returns {Promise<{ succes: boolean, message: string }>}
 */
CategoryData.update = async function (id, donnees) {
  return putRequest(`admin/categories?id=${id}`, {
    nom: (donnees.nom || "").trim(),
    description: (donnees.description || "").trim(),
  });
};

/**
 * Supprime une catégorie après confirmation et gestion des produits rattachés :
 * DELETE /api/admin/categories?id=...&action_produits=...&nouvelle_category_id=...
 *
 * @param {number} id Identifiant de la catégorie
 * @param {{ actionProduits?: 'bloquer'|'detach'|'reassign', nouvelleCategoryId?: number|null }} [options]
 * @returns {Promise<{ succes: boolean, message: string }>}
 */
CategoryData.delete = async function (id, options = {}) {
  let params = new URLSearchParams();
  params.set("id", String(id));
  if (options.actionProduits) {
    params.set("action_produits", options.actionProduits);
  }
  if (options.nouvelleCategoryId) {
    params.set("nouvelle_category_id", String(options.nouvelleCategoryId));
  }

  return deleteRequest(`admin/categories?${params.toString()}`);
};

export { CategoryData };

