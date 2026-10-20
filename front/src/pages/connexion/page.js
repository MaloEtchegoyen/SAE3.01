import { AuthData } from "../../data/auth.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { FormulaireConnexionView } from "../../ui/formulaire-connexion/index.js";
import { FormulaireInscriptionView } from "../../ui/formulaire-inscription/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Connexion.
 * Ne touche jamais au DOM.
 */
let M = {
  mode: "connexion", // "connexion" | "inscription"
  login: "",
  email: "",
  message: null, // { type: "succes" | "erreur" | "info", texte: string } | null
};

let C = {};

/**
 * Bascule d'onglet entre connexion et création de compte.
 *
 * @param {"connexion" | "inscription"} nouveauMode
 */
C.handler_onglet = function (nouveauMode) {
  M.mode = nouveauMode;
  M.message = null;
  V.rafraichir();
};

/**
 * Traitement de la connexion utilisateur.
 *
 * @param {string} login
 * @param {string} mdp
 */
C.handler_connexion = async function (login, mdp) {
  M.login = login;

  if (!login || !mdp) {
    M.message = {
      type: "erreur",
      texte: "Veuillez renseigner votre identifiant et votre mot de passe.",
    };
    V.rafraichir();
    return;
  }

  try {
    await AuthData.login(login, mdp);
    navigate("/compte");
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Identifiants invalides.",
    };
    V.rafraichir();
  }
};

/**
 * Traitement de l'inscription utilisateur.
 *
 * @param {string} email
 * @param {string} mdp
 * @param {string} confirmation
 */
C.handler_inscription = async function (email, mdp, confirmation) {
  M.email = email;

  if (!email || !mdp) {
    M.message = {
      type: "erreur",
      texte: "Veuillez renseigner une adresse email et un mot de passe.",
    };
    V.rafraichir();
    return;
  }

  let regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regexEmail.test(email)) {
    M.message = {
      type: "erreur",
      texte: "L'adresse email saisie n'a pas un format valide.",
    };
    V.rafraichir();
    return;
  }

  if (mdp.length < 6) {
    M.message = {
      type: "erreur",
      texte: "Le mot de passe doit comporter au moins 6 caractères.",
    };
    V.rafraichir();
    return;
  }

  if (mdp !== confirmation) {
    M.message = {
      type: "erreur",
      texte: "Les deux mots de passe saisis ne correspondent pas.",
    };
    V.rafraichir();
    return;
  }

  try {
    await AuthData.register(email, mdp);
    navigate("/compte");
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la création du compte.",
    };
    V.rafraichir();
  }
};

/**
 * Initialisation de la page Connexion.
 * Si l'utilisateur est déjà connecté, redirection vers la page Compte.
 */
C.init = async function () {
  M.message = null;
  let session = await AuthData.verifierSession();
  if (session.connecte) {
    navigate("/compte");
    return document.createDocumentFragment();
  }
  return V.init();
};

let V = {};

V.racine = null;

V.init = function () {
  let fragment = V.createPageFragment();
  V.racine = fragment.firstElementChild;
  return fragment;
};

V.rafraichir = function () {
  let fragment = V.createPageFragment();
  let nouvelleRacine = fragment.firstElementChild;
  if (V.racine && V.racine.parentNode) {
    V.racine.replaceWith(fragment);
    V.racine = nouvelleRacine;
  }
};

/**
 * Déduit l'interface HTML à partir de l'état M.
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  let conteneurOnglets = pageFragment.querySelector('[data-ref="onglets-auth"]');
  if (conteneurOnglets) {
    let btnConnexion = conteneurOnglets.querySelector('[data-action="onglet-connexion"]');
    let btnInscription = conteneurOnglets.querySelector('[data-action="onglet-inscription"]');

    if (M.mode === "connexion") {
      btnConnexion?.classList.add("bg-white", "text-feuillette-charbon", "shadow-xs");
      btnInscription?.classList.add("text-feuillette-charbon/60", "hover:text-feuillette-charbon");
    } else {
      btnInscription?.classList.add("bg-white", "text-feuillette-charbon", "shadow-xs");
      btnConnexion?.classList.add("text-feuillette-charbon/60", "hover:text-feuillette-charbon");
    }

    btnConnexion?.addEventListener("click", () => C.handler_onglet("connexion"));
    btnInscription?.addEventListener("click", () => C.handler_onglet("inscription"));
  }

  let slotFormulaire = pageFragment.querySelector('slot[name="formulaire"]');
  if (slotFormulaire) {
    if (M.mode === "connexion") {
      slotFormulaire.replaceWith(
        FormulaireConnexionView.dom(
          { login: M.login },
          {
            surConnexion: C.handler_connexion,
            surBasculeInscription: () => C.handler_onglet("inscription"),
          }
        )
      );
    } else {
      slotFormulaire.replaceWith(
        FormulaireInscriptionView.dom(
          { email: M.email },
          {
            surInscription: C.handler_inscription,
            surBasculeConnexion: () => C.handler_onglet("connexion"),
          }
        )
      );
    }
  }

  return pageFragment;
};

export function ConnexionPage() {
  return C.init();
}

