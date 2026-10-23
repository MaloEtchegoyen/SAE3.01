import { AuthData } from "../../data/auth.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { FormulaireConnexionAdminView } from "../../ui/formulaire-connexion-admin/index.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Page « Connexion Administrateur ».
 *
 * Gère l'affichage du formulaire de connexion admin ainsi que les messages
 * d'information ou d'erreur associés.
 */

let M = {
  login: "", // dernier identifiant saisi, pour pré-remplir le formulaire
  message: null, // { type, texte }, ou null
};

let C = {};

C.handler_connexion = async function (login, mdp) {
  M.login = login;

  try {
    let reponse = await AuthData.login(login, mdp);
    if (reponse.role !== "admin") {
      M.message = {
        type: "admin-erreur",
        texte: "Ce compte n'a pas les droits d'administration.",
      };
      V.rafraichir();
      return;
    }
    navigate("/admin");
  } catch (erreur) {
    M.message = {
      type: "admin-erreur",
      texte: "Identifiants administrateur incorrects. Réessayez.",
    };
    V.rafraichir();
  }
};

C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    M.message = { type: "succes", texte: "Déconnexion réussie." };
  } catch (erreur) {
    M.message = {
      type: "admin-erreur",
      texte: erreur.message || "Erreur lors de la déconnexion.",
    };
  }

  V.rafraichir();
};

C.init = async function () {
  M.message = null;
  return V.init();
};

let V = {};

V.racine = null; // élément racine de la page affichée

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  let formulaireNode = FormulaireConnexionAdminView.dom(
    { login: M.login },
    { surConnexion: C.handler_connexion, surDeconnexion: C.handler_deconnexion }
  );

  let slotMessage = formulaireNode.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  pageFragment.querySelector('slot[name="connexion"]').replaceWith(formulaireNode);

  return pageFragment;
};

/**
 * Page de connexion spécifique aux administrateurs.
 *
 * @returns {Promise<DocumentFragment>}
 */
export function ConnexionAdminPage() {
  return C.init();
}
