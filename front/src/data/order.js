import { getRequest, postRequest } from "../lib/api-request.js";

/**
 * Module de données OrderData.
 * Gère les requêtes vers l'API de gestion des commandes.
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
   * Récupère le détail d'une commande par son numéro unique.
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
  async obtenirCommande(numeroCommande) {
    let reponse = await getRequest(`orders/detail?numero=${encodeURIComponent(numeroCommande)}`);
    return reponse;
  },
};

export { OrderData };

