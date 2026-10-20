import { AuthData } from "../../data/auth.js";
import { CartData } from "../../data/cart.js";
import { navigate } from "../../lib/router.js";
import { escapeHtml, htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Compte.
 * Ne touche jamais au DOM.
 */
let M = {
  utilisateur: null,
  message: null, // { type: "succes" | "erreur" | "info", texte: string } | null
};

let C = {};

/**
 * Charge les informations de session courante.
 */
C.charger = async function () {
  try {
    let etat = await AuthData.verifierSession();
    M.utilisateur = etat.connecte ? etat : null;
  } catch (erreur) {
    M.utilisateur = null;
    M.message = { type: "erreur", texte: erreur.message };
  }
};

/**
 * Traitement de la déconnexion.
 */
C.handler_deconnexion = async function () {
  try {
    await AuthData.logout();
    M.utilisateur = null;
    navigate("/");
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la déconnexion.",
    };
    V.rafraichir();
  }
};

/**
 * Initialisation de la page Compte.
 * Redirige vers /connexion si l'utilisateur n'est pas connecté.
 */
C.init = async function () {
  M.message = null;
  await C.charger();

  if (!M.utilisateur || !M.utilisateur.connecte) {
    navigate("/connexion");
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

  // Slot message
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Slot profil
  let slotProfil = pageFragment.querySelector('slot[name="profil"]');
  if (slotProfil && M.utilisateur && M.utilisateur.connecte) {
    let nbPanier = CartData.compterArticles();
    let isAdmin = M.utilisateur.role === "admin";
    let profilHtml = `
      <div class="rounded-2xl border border-feuillette-creme/60 bg-white p-6 shadow-sm sm:p-8">
        <div class="flex items-center gap-4">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-feuillette-charbon">Mon compte client</h2>
            <p class="text-sm text-feuillette-charbon/70 font-medium">${escapeHtml(M.utilisateur.utilisateur)}</p>
            <span class="mt-1 inline-flex items-center rounded-md bg-feuillette-creme/50 px-2 py-0.5 text-xs font-semibold text-feuillette-charbon">
              ${isAdmin ? "Administrateur" : "Client"}
            </span>
          </div>
        </div>

        <div class="mt-8 flex flex-col gap-3">
          <a
            href="/panier"
            data-link
            class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 11-1 9" />
              <path d="m19 11-4-7" />
              <path d="M2 11h20" />
              <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
              <path d="m4.5 15.5 15 0" />
              <path d="m5 11 4-7" />
              <path d="m9 11 1 9" />
            </svg>
            <span>Accéder à mon panier (${nbPanier} article${nbPanier > 1 ? "s" : ""})</span>
          </a>

          ${
            isAdmin
              ? `<a
                  href="/admin"
                  data-link
                  class="flex h-11 w-full items-center justify-center rounded-lg border border-brand bg-transparent px-6 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
                >
                  Panneau d'administration
                </a>`
              : ""
          }

          <a
            href="/"
            data-link
            class="flex h-11 w-full items-center justify-center rounded-lg border border-feuillette-creme bg-white px-6 text-sm font-medium text-feuillette-charbon transition-colors hover:bg-feuillette-blanc"
          >
            Parcourir le catalogue
          </a>

          <button
            type="button"
            data-action="se-deconnecter"
            class="mt-2 flex h-10 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50/50 text-sm font-medium text-red-700 transition-colors hover:bg-red-100/60 cursor-pointer"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    `;
    let fragmentProfil = htmlToFragment(profilHtml);
    let btnDeconnexion = fragmentProfil.querySelector('[data-action="se-deconnecter"]');
    if (btnDeconnexion) {
      btnDeconnexion.addEventListener("click", () => {
        C.handler_deconnexion();
      });
    }
    slotProfil.replaceWith(fragmentProfil);
  }

  return pageFragment;
};

export function ComptePage() {
  return C.init();
}
