import { getRequest, putRequest } from "../lib/api-request.js";

/**
 * Module de données UserData.
 * Gère les requêtes vers l'API relatives au profil et au compte utilisateur.
 * Strictement découplé de la vue (aucun accès au DOM).
 */
let UserData = {
  /**
   * Récupère le profil complet de l'utilisateur connecté : GET /api/user/profile
   *
   * @returns {Promise<{
   *   id: number,
   *   login: string,
   *   nom: string,
   *   email: string,
   *   role: string
   * }>}
   */
  async obtenirProfil() {
    let reponse = await getRequest("user/profile");
    return reponse;
  },

  /**
   * Modifie les informations de profil (nom, email) : PUT /api/user/profile
   *
   * @param {{ nom: string, email: string }} donnees
   * @returns {Promise<{
   *   message: string,
   *   profil: { id: number, nom: string, email: string }
   * }>}
   */
  async modifierProfil(donnees) {
    let reponse = await putRequest("user/profile", {
      nom: donnees.nom,
      email: donnees.email,
    });
    return reponse;
  },

  /**
   * Modifie le mot de passe utilisateur en exigeant le mot de passe actuel (DoD) : PUT /api/user/password
   *
   * @param {{ ancienMotDePasse: string, nouveauMotDePasse: string }} donnees
   * @returns {Promise<{ message: string }>}
   */
  async modifierMotDePasse(donnees) {
    let reponse = await putRequest("user/password", {
      ancien_mot_de_passe: donnees.ancienMotDePasse,
      nouveau_mot_de_passe: donnees.nouveauMotDePasse,
    });
    return reponse;
  },
};

export { UserData };

