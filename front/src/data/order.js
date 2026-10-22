import { getRequest, postRequest, putRequest } from "../lib/api-request.js";

/**
 * Module de données OrderData.
 * Gère les requêtes vers l'API de gestion des commandes (client et administration).
 * Strictement découplé de la vue (aucun accès au DOM).
 */
let OrderData = {
  /**
   * Envoie la création d'une commande au serveur.
   *
   * @param {Array<{produitId: number, varianteId?: number|null, quantite: number}>} articles
   * @returns {Promise<{
   *   id: number,
   *   numero_commande: string,
   *   utilisateur_id: number,
   *   statut: string,
   *   total: number,
   *   date_commande: string,
   *   lignes: Array<object>
   * }>}
   */
  async creerCommande(articles) {
    let reponse = await postRequest("orders", { articles });
    return reponse;
  },

  /**
   * Récupère le détail d'une commande par son numéro unique (côté client).
   *
   * @param {string} numeroCommande
   * @returns {Promise<{
   *   id: number,
   *   numero_commande: string,
   *   utilisateur_id: number,
   *   utilisateur_login: string,
   *   statut: string,
   *   total: number,
   *   date_commande: string,
   *   lignes: Array<object>
   * }>}
   */

  /**
   * Récupère les commandes récentes de l'utilisateur connecté : GET /api/orders
   *
   * @param {number} [limite=5]
   * @returns {Promise<Array<{
   *   id: number,
   *   numero_commande: string,
   *   statut: string,
   *   total: number,
   *   date_commande: string,
   *   nb_articles: number,
   *   articles_apercu: string
   * }>>}
   */
  async listerMesCommandes(options = {}) {
    let params = new URLSearchParams();
    if (typeof options === "number") {
      params.set("parPage", String(options));
    } else if (options && typeof options === "object") {
      if (options.statut) params.set("statut", options.statut);
      if (options.periode) params.set("periode", options.periode);
      if (options.page) params.set("page", String(options.page));
      if (options.parPage) params.set("parPage", String(options.parPage));
      if (options.tri) params.set("tri", options.tri);
    }
    let query = params.toString();
    let reponse = await getRequest(query ? `orders?${query}` : "orders");
    return reponse;
  },
  async obtenirCommande(numeroCommande) {
    let reponse = await getRequest(`orders/detail?numero=${encodeURIComponent(numeroCommande)}`);
    return reponse;
  },

  /**
   * Récupère toutes les commandes des clients pour l'administration (avec tri et filtres).
   *
   * @param {{
   *   tri?: string,
   *   statut?: string,
   *   page?: number,
   *   parPage?: number
   * }} options
   * @returns {Promise<{
   *   items: Array<object>,
   *   page: number,
   *   pagesTotal: number,
   *   total: number,
   *   tri: string,
   *   parPage: number
   * }>}
   */
  async fetchAllAdmin(options = {}) {
    let parametres = new URLSearchParams();
    if (options.tri) parametres.set("tri", options.tri);
    if (options.statut) parametres.set("statut", options.statut);
    if (options.date) parametres.set("date", options.date);
    if (options.montant !== undefined && options.montant !== null && options.montant !== "") {
      parametres.set("montant", String(options.montant));
    }
    if (options.page) parametres.set("page", String(options.page));
    if (options.parPage) parametres.set("parPage", String(options.parPage));

    let query = parametres.toString();
    let uri = query ? `admin/orders?${query}` : "admin/orders";
    let reponse = await getRequest(uri);
    return reponse;
  },

  /**
   * Récupère le détail complet d'une commande et son journal d'audit (côté administration).
   *
   * @param {number|string} idOuNumero
   * @returns {Promise<{
   *   id: number,
   *   numero_commande: string,
   *   utilisateur_id: number,
   *   utilisateur_login: string,
   *   statut: string,
   *   total: number,
   *   date_commande: string,
   *   lignes: Array<object>,
   *   journal: Array<object>
   * }>}
   */
  async fetchDetailAdmin(idOuNumero) {
    let uri =
      typeof idOuNumero === "number"
        ? `admin/orders/detail?id=${encodeURIComponent(idOuNumero)}`
        : `admin/orders/detail?numero=${encodeURIComponent(idOuNumero)}`;
    let reponse = await getRequest(uri);
    return reponse;
  },

  /**
   * Fait évoluer le statut d'une commande (ex: 'disponible', 'retirée', 'annulée').
   *
   * @param {number} id
   * @param {string} statut
   * @param {string} [commentaire=""]
   * @returns {Promise<{
   *   id: number,
   *   numero_commande: string,
   *   ancien_statut?: string,
   *   nouveau_statut?: string,
   *   modifie: boolean
   * }>}
   */
  async modifierStatut(id, statut, commentaire = "") {
    let reponse = await putRequest("admin/orders/statut", {
      id: Number(id),
      statut,
      commentaire,
    });
    return reponse;
  },

  /**
   * Fait évoluer le statut de plusieurs commandes en lot.
   *
   * @param {Array<number>} ids
   * @param {string} statut
   * @returns {Promise<{
   *   modifies: number,
   *   ignores: number,
   *   erreurs: Array<string>
   * }>}
   */
  async modifierStatutLot(ids, statut) {
    let reponse = await putRequest("admin/orders/lot", {
      ids,
      statut,
    });
    return reponse;
  },
};

export { OrderData };
