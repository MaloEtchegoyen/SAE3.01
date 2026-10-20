import { getRequest, postRequest } from "../lib/api-request.js";

let auditeurs = [];

let etatUtilisateur = {
  charge: false,
  connecte: false,
  utilisateur: null,
  role: null,
};

function notifier() {
  auditeurs.forEach((callback) => {
    try {
      callback(etatUtilisateur);
    } catch {}
  });
}

/**
 * Module de données AuthData.
 * Gère les appels API d'authentification et l'état de session côté client.
 * Ne touche jamais au DOM (conformité MVC stricte).
 */
let AuthData = {
  /**
   * S'abonne aux changements d'état d'authentification.
   *
   * @param {(etat: typeof etatUtilisateur) => void} callback
   * @returns {() => void} Fonction de désabonnement
   */
  abonner(callback) {
    if (typeof callback === "function") {
      auditeurs.push(callback);
    }
    return () => {
      auditeurs = auditeurs.filter((cb) => cb !== callback);
    };
  },

  /**
   * Vérifie la session active auprès du serveur : GET /api/me
   *
   * @returns {Promise<{charge: boolean, connecte: boolean, utilisateur: string|null, role: string|null}>}
   */
  async verifierSession() {
    try {
      let reponse = await getRequest("me");
      etatUtilisateur = {
        charge: true,
        connecte: Boolean(reponse.connecte),
        utilisateur: reponse.utilisateur || null,
        role: reponse.role || null,
      };
    } catch {
      etatUtilisateur = {
        charge: true,
        connecte: false,
        utilisateur: null,
        role: null,
      };
    }
    notifier();
    return { ...etatUtilisateur };
  },

  /**
   * Inscription d'un nouvel utilisateur : POST /api/register
   *
   * @param {string} email
   * @param {string} mdp
   * @returns {Promise<object>}
   */
  async register(email, mdp) {
    let reponse = await postRequest("register", { email, mdp });
    etatUtilisateur = {
      charge: true,
      connecte: true,
      utilisateur: reponse.utilisateur || email,
      role: reponse.role || "user",
    };
    notifier();
    return reponse;
  },

  /**
   * Connexion : POST /api/login
   *
   * @param {string} login
   * @param {string} mdp
   * @returns {Promise<object>}
   */
  async login(login, mdp) {
    let reponse = await postRequest("login", { login, mdp });
    etatUtilisateur = {
      charge: true,
      connecte: true,
      utilisateur: reponse.utilisateur || login,
      role: reponse.role || "user",
    };
    notifier();
    return reponse;
  },

  /**
   * Déconnexion : POST /api/logout
   *
   * @returns {Promise<object>}
   */
  async logout() {
    try {
      await postRequest("logout");
    } finally {
      etatUtilisateur = {
        charge: true,
        connecte: false,
        utilisateur: null,
        role: null,
      };
      notifier();
    }
    return { connecte: false };
  },

  /**
   * Renvoie une copie de l'état utilisateur en mémoire.
   *
   * @returns {typeof etatUtilisateur}
   */
  obtenirUtilisateur() {
    return { ...etatUtilisateur };
  },

  /**
   * Indique si l'utilisateur est connecté.
   *
   * @returns {boolean}
   */
  estConnecte() {
    return Boolean(etatUtilisateur.connecte);
  },
};

export { AuthData };
