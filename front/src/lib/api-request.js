/**
 * Appels à l'API.
 *
 * L'API est servie avec le front, sous le même chemin :
 * /~login/Base/api/... (import.meta.env.BASE_URL vaut /~login/Base/).
 *
 * Front et API ayant la même origine, le navigateur joint automatiquement les
 * cookies du site à chaque requête : aucune option n'est nécessaire ici.
 */
const API_URL = import.meta.env.BASE_URL + "api/";

/**
 * Erreur renvoyée par l'API, avec son code de statut HTTP.
 *
 * Une page a parfois besoin de distinguer un 401 d'un 403 pour afficher le bon
 * message : le message seul ne le permettrait pas.
 */
class ErreurApi extends Error {
  constructor(message, statut) {
    super(message);
    this.name = "ErreurApi";
    this.statut = statut;
  }
}

/**
 * Envoie une requête et renvoie la réponse JSON, convertie en objet.
 * Lève une ErreurApi si le serveur répond par une erreur.
 */
let request = async function (uri, options) {
  let response = await fetch(API_URL + uri, options);

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    throw new ErreurApi("Réponse illisible du serveur.", response.status);
  }

  if (!response.ok) {
    // L'API décrit ses erreurs dans un champ « erreur ».
    throw new ErreurApi(data?.erreur ?? `Erreur ${response.status}`, response.status);
  }

  return data;
};

/**
 * Lecture d'une ressource. Par exemple : await getRequest("products?page=2")
 */
let getRequest = function (uri) {
  return request(uri, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
};

/**
 * Envoi de données au format JSON ou multipart/form-data. Par exemple :
 * await postRequest("login", { login: "alice", mdp: "azerty" })
 * ou await postRequest("admin/products", formData)
 */
let postRequest = function (uri, data = {}) {
  let options = {
    method: "POST",
    headers: { Accept: "application/json" },
  };

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    options.body = data;
  } else {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  return request(uri, options);
};

/**
 * Mise à jour d'une ressource au format JSON ou multipart/form-data. Par exemple :
 * await putRequest("admin/products?id=42", { nom: "Nouveau nom" })
 */
let putRequest = function (uri, data = {}) {
  let options = {
    method: "PUT",
    headers: { Accept: "application/json" },
  };

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    options.body = data;
  } else {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  return request(uri, options);
};

/**
 * Suppression d'une ressource au format JSON. Par exemple :
 * await deleteRequest("admin/products", { id: 42 })
 */
let deleteRequest = function (uri, data = {}) {
  let options = {
    method: "DELETE",
    headers: { Accept: "application/json" },
  };

  if (data && Object.keys(data).length > 0) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  return request(uri, options);
};

export { getRequest, postRequest, putRequest, deleteRequest, ErreurApi };
