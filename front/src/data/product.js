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
 * Récupère le détail d'un produit (avec images et variantes) pour le catalogue public :
 * GET /api/products/detail?id=...
 *
 * @param {number} id
 * @returns {Promise<object>}
 */
ProductData.fetchDetail = async function (id) {
  return getRequest(`products/detail?id=${id}`);
};

/**
 * Récupère le détail complet d'un produit à partir de son slug ou de son id.
 * Résout le produit depuis la liste globale pour extraire son identifiant technique et ses catégories,
 * puis charge ses informations complètes (images, variantes).
 *
 * @param {string|number} slugOuId
 * @returns {Promise<object|null>}
 */
ProductData.fetchBySlugOrId = async function (slugOuId) {
  if (!slugOuId) return null;

  const produits = await ProductData.fetchAll();
  if (!Array.isArray(produits) || produits.length === 0) {
    return null;
  }

  const strCible = String(slugOuId).trim().toLowerCase();
  const idCible = Number(slugOuId);

  // Recherche par ID direct ou par comparaison du nom / slug
  let produitTrouve = produits.find((p) => {
    if (!Number.isNaN(idCible) && Number(p.id) === idCible) {
      return true;
    }
    const slugProduit = (p.nom || "")
      .toLowerCase()
      .trim()
      .replaceAll("é", "e")
      .replaceAll("è", "e")
      .replaceAll("ê", "e")
      .replaceAll("à", "a")
      .replaceAll("â", "a")
      .replaceAll("ç", "c")
      .replaceAll("ô", "o")
      .replaceAll("î", "i")
      .replaceAll("ï", "i")
      .replaceAll("ù", "u")
      .replaceAll("&", "et")
      .replaceAll(" ", "-")
      .replaceAll("'", "-");

    return slugProduit === strCible || String(p.id) === strCible;
  });

  if (!produitTrouve) {
    return null;
  }

  try {
    const detail = await ProductData.fetchDetail(produitTrouve.id);
    return {
      ...produitTrouve,
      ...detail,
      images: Array.isArray(detail?.images) ? detail.images : [],
      variantes: Array.isArray(detail?.variantes) ? detail.variantes : [],
    };
  } catch {
    // Si l'endpoint de détail échoue ou n'est pas disponible, renvoyer au moins les infos du catalogue
    return {
      ...produitTrouve,
      images: produitTrouve.image_url ? [{ url: produitTrouve.image_url, est_principale: true }] : [],
      variantes: [],
    };
  }
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
 * Récupère le détail complet d'un produit (avec images et variantes) pour l'administration :
 * GET /api/admin/products/detail?id=... (réservé aux administrateurs).
 *
 * @param {number} id
 * @returns {Promise<object>}
 */
ProductData.fetchDetailAdmin = async function (id) {
  return getRequest(`admin/products/detail?id=${id}`);
};

/**
 * Crée un nouveau produit (avec éventuel téléversement d'images) :
 * POST /api/admin/products.
 *
 * @param {{
 *   nom: string,
 *   prix: number,
 *   category_id?: number|null,
 *   stock?: number,
 *   seuil_alerte?: number,
 *   description?: string|null,
 *   fichiers?: File[]
 * }|FormData} donnees
 * @returns {Promise<{ succes: boolean, id: number, message: string }>}
 */
ProductData.create = async function (donnees) {
  if (typeof FormData !== "undefined" && donnees instanceof FormData) {
    return postRequest("admin/products", donnees);
  }

  if (Array.isArray(donnees?.fichiers) && donnees.fichiers.length > 0) {
    const formData = new FormData();
    formData.append("nom", donnees.nom ?? "");
    formData.append("prix", String(donnees.prix ?? 0));
    if (donnees.category_id !== null && donnees.category_id !== undefined && donnees.category_id !== "") {
      formData.append("category_id", String(donnees.category_id));
    }
    formData.append("stock", String(donnees.stock ?? 0));
    formData.append("seuil_alerte", String(donnees.seuil_alerte ?? 5));
    if (donnees.description) {
      formData.append("description", donnees.description);
    }
    if (donnees.image_principale_index !== undefined && donnees.image_principale_index !== null) {
      formData.append("image_principale_index", String(donnees.image_principale_index));
    }
    donnees.fichiers.forEach((fichier) => {
      formData.append("images[]", fichier);
    });
    return postRequest("admin/products", formData);
  }

  return postRequest("admin/products", donnees);
};

/**
 * Met à jour les informations d'un produit existant :
 * PUT /api/admin/products?id=... ou POST /api/admin/products/modifier?id=... (multipart)
 *
 * @param {number} id
 * @param {{
 *   nom: string,
 *   prix: number,
 *   category_id?: number|null,
 *   stock?: number,
 *   seuil_alerte?: number,
 *   description?: string|null,
 *   fichiers?: File[],
 *   images_conservees_ids?: number[],
 *   image_principale_id?: number|null,
 *   image_principale_index?: number
 * }|FormData} donnees
 * @returns {Promise<{ succes: boolean, message: string }>}
 */
ProductData.update = async function (id, donnees) {
  if (typeof FormData !== "undefined" && donnees instanceof FormData) {
    if (!donnees.has("_method")) {
      donnees.append("_method", "PUT");
    }
    return postRequest(`admin/products/modifier?id=${id}`, donnees);
  }

  if (Array.isArray(donnees?.fichiers) && donnees.fichiers.length > 0) {
    const formData = new FormData();
    formData.append("_method", "PUT");
    formData.append("id", String(id));
    formData.append("nom", donnees.nom ?? "");
    formData.append("prix", String(donnees.prix ?? 0));
    if (donnees.category_id !== null && donnees.category_id !== undefined && donnees.category_id !== "") {
      formData.append("category_id", String(donnees.category_id));
    }
    formData.append("stock", String(donnees.stock ?? 0));
    formData.append("seuil_alerte", String(donnees.seuil_alerte ?? 5));
    if (donnees.description) {
      formData.append("description", donnees.description);
    }
    if (Array.isArray(donnees.images_conservees_ids)) {
      donnees.images_conservees_ids.forEach((idImg) => {
        formData.append("images_conservees_ids[]", String(idImg));
      });
    }
    if (donnees.image_principale_id !== null && donnees.image_principale_id !== undefined) {
      formData.append("image_principale_id", String(donnees.image_principale_id));
    }
    if (donnees.image_principale_index !== null && donnees.image_principale_index !== undefined) {
      formData.append("image_principale_index", String(donnees.image_principale_index));
    }
    donnees.fichiers.forEach((fichier) => {
      formData.append("images[]", fichier);
    });
    return postRequest(`admin/products/modifier?id=${id}`, formData);
  }

  return putRequest(`admin/products?id=${id}`, { id, ...donnees });
};

/**
 * Ajoute une image associée à un produit :
 * POST /api/admin/products/images.
 *
 * @param {{
 *   product_id: number,
 *   url?: string,
 *   fichier?: File,
 *   alt?: string|null,
 *   est_principale?: boolean,
 *   ordre?: number
 * }|FormData} donnees
 * @returns {Promise<{ succes: boolean, id: number, message: string }>}
 */
ProductData.addImage = async function (donnees) {
  if (typeof FormData !== "undefined" && donnees instanceof FormData) {
    return postRequest("admin/products/images", donnees);
  }

  if (donnees && typeof File !== "undefined" && donnees.fichier instanceof File) {
    const formData = new FormData();
    formData.append("product_id", String(donnees.product_id));
    formData.append("image", donnees.fichier);
    if (donnees.alt) formData.append("alt", donnees.alt);
    if (donnees.est_principale) formData.append("est_principale", "1");
    if (donnees.ordre !== undefined) formData.append("ordre", String(donnees.ordre));
    return postRequest("admin/products/images", formData);
  }

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

