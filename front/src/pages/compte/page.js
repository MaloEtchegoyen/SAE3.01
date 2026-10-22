import { AuthData } from "../../data/auth.js";
import { UserData } from "../../data/user.js";
import { OrderData } from "../../data/order.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { MessageView } from "../../ui/message/index.js";
import template from "./template.html?raw";
import carteCommandeTemplate from "./carte-commande.html?raw";

/**
 * Modèle local de la page Compte (Espace personnel client).
 * Strictement découplé du DOM (MVC).
 */
let M = {
  utilisateur: null,
  profil: {
    id: 0,
    login: "",
    email: "",
    role: "user",
  },
  commandes: [],
  chargement: true,
  ongletActif: "profil", // 'profil' | 'commandes'
  message: null, // { type: 'succes' | 'erreur' | 'info', texte: string } | null
  enCoursDeTraitement: false,
};

let C = {};

/**
 * Charge les données initiales du profil et des commandes.
 */
C.charger = async function () {
  M.chargement = true;
  try {
    let session = await AuthData.verifierSession();
    if (!session.connecte) {
      M.utilisateur = null;
      return;
    }
    M.utilisateur = session;

    // Charger le profil
    try {
      let profil = await UserData.obtenirProfil();
      M.profil = {
        id: profil.id,
        login: profil.login || session.utilisateur,
        email: profil.email || profil.login || session.utilisateur,
        role: profil.role || session.role || "user",
      };
    } catch {
      M.profil = {
        id: 0,
        login: session.utilisateur,
        email: session.utilisateur,
        role: session.role || "user",
      };
    }

    // Charger les commandes récentes
    try {
      let commandes = await OrderData.listerMesCommandes(10);
      M.commandes = Array.isArray(commandes) ? commandes : [];
    } catch {
      M.commandes = [];
    }
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors du chargement de l'espace personnel.",
    };
  } finally {
    M.chargement = false;
  }
};

/**
 * Changement de l'onglet actif.
 *
 * @param {string} onglet
 */
C.changerOnglet = function (onglet) {
  M.ongletActif = onglet;
  M.message = null;
  V.rafraichir();
};

/**
 * Traite la soumission du formulaire de modification d'email et mot de passe.
 *
 * @param {{ email: string, ancienMotDePasse?: string, nouveauMotDePasse?: string }} donnees
 */
C.enregistrerModifications = async function (donnees) {
  if (M.enCoursDeTraitement) return;

  let email = donnees.email.trim();
  let ancienMdp = donnees.ancienMotDePasse || "";
  let nouveauMdp = donnees.nouveauMotDePasse || "";

  if (!email) {
    M.message = {
      type: "erreur",
      texte: "L'adresse email est obligatoire.",
    };
    V.rafraichir();
    return;
  }

  // Si l'utilisateur tente de changer de mot de passe (DoD spécifique)
  if (nouveauMdp) {
    if (!ancienMdp) {
      M.message = {
        type: "erreur",
        texte: "Pour modifier votre mot de passe, vous devez obligatoirement renseigner votre mot de passe actuel.",
      };
      V.rafraichir();
      return;
    }
    if (nouveauMdp.length < 6) {
      M.message = {
        type: "erreur",
        texte: "Le nouveau mot de passe doit comporter au moins 6 caractères.",
      };
      V.rafraichir();
      return;
    }
  }

  M.enCoursDeTraitement = true;
  M.message = null;
  V.rafraichir();

  try {
    // 1. Mettre à jour l'email (nom transmis identique à l'email ou login pour compatibilité API)
    let reponseProfil = await UserData.modifierProfil({ nom: email, email });
    M.profil.email = reponseProfil.profil?.email || email;

    // 2. Si un nouveau mot de passe a été fourni, le mettre à jour
    if (nouveauMdp) {
      await UserData.modifierMotDePasse({
        ancienMotDePasse: ancienMdp,
        nouveauMotDePasse: nouveauMdp,
      });
    }

    M.message = {
      type: "succes",
      texte: nouveauMdp
        ? "Vos informations personnelles et votre mot de passe ont été mis à jour avec succès."
        : "Vos informations personnelles ont été mises à jour avec succès.",
    };
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de l'enregistrement des modifications.",
    };
  } finally {
    M.enCoursDeTraitement = false;
    V.rafraichir();
  }
};

/**
 * Déconnexion de l'utilisateur.
 */
C.deconnexion = async function () {
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
 *
 * @returns {Promise<DocumentFragment>}
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
 * Formate une date au format français lisible.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formaterDateLocale(dateStr) {
  if (!dateStr) return "";
  try {
    let d = new Date(dateStr.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Retourne le style et libellé d'un badge de statut de commande.
 *
 * @param {string} statut
 * @returns {{ classes: string, libelle: string }}
 */
function obtenirBadgeStatut(statut) {
  let s = (statut || "").toLowerCase();
  if (s === "en cours") {
    return {
      classes: "bg-amber-50 text-amber-800 border-amber-200",
      libelle: "En cours",
    };
  }
  if (s === "disponible") {
    return {
      classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
      libelle: "Disponible",
    };
  }
  if (s === "retirée" || s === "retiree") {
    return {
      classes: "bg-slate-100 text-slate-700 border-slate-200",
      libelle: "Retirée",
    };
  }
  if (s === "annulée" || s === "annulee") {
    return {
      classes: "bg-red-50 text-red-700 border-red-200",
      libelle: "Annulée",
    };
  }
  return {
    classes: "bg-stone-100 text-stone-700 border-stone-200",
    libelle: statut || "Inconnu",
  };
}

/**
 * Construit le fragment principal de la page en fonction de l'état M.
 *
 * @returns {DocumentFragment}
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Nom dynamique / identifiant dans le titre d'accueil
  let nomEl = pageFragment.querySelector('[data-ref="nom-client"]');
  if (nomEl) {
    nomEl.textContent = M.profil.email || M.profil.login || "";
  }

  // Déconnexion
  let btnDeconnexion = pageFragment.querySelector('[data-action="deconnexion"]');
  if (btnDeconnexion) {
    btnDeconnexion.addEventListener("click", () => {
      C.deconnexion();
    });
  }

  // Gestion des onglets de navigation latérale
  let tabButtons = pageFragment.querySelectorAll("[data-tab]");
  for (let i = 0, nb = tabButtons.length; i < nb; i++) {
    let btn = tabButtons[i];
    let nomTab = btn.getAttribute("data-tab");
    let estActif = nomTab === M.ongletActif;

    if (estActif) {
      btn.className =
        "flex w-full items-center rounded-xl bg-input px-4 py-3 text-left text-body-sm font-semibold text-white shadow-xs cursor-pointer";
      btn.setAttribute("aria-selected", "true");
    } else {
      btn.className =
        "flex w-full items-center rounded-xl px-4 py-3 text-left text-body-sm font-medium text-white/90 hover:text-white transition cursor-pointer";
      btn.setAttribute("aria-selected", "false");
    }

    btn.addEventListener("click", () => {
      C.changerOnglet(nomTab);
    });
  }

  // Slot message
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Récupération des sections de contenu
  let sectionProfil = pageFragment.querySelector('[data-ref="section-profil"]');
  let sectionCommandes = pageFragment.querySelector('[data-ref="section-commandes"]');

  if (M.ongletActif === "profil") {
    sectionProfil?.classList.remove("hidden");
    sectionCommandes?.classList.add("hidden");

    // Affichage de l'email
    let infoEmail = pageFragment.querySelector('[data-ref="info-email"]');
    if (infoEmail) {
      infoEmail.textContent = M.profil.email || M.profil.login || "";
    }

    // Remplissage du champ email
    let champEmail = pageFragment.querySelector('[data-ref="champ-email"]');
    if (champEmail) {
      champEmail.value = M.profil.email || "";
    }

    let btnSoumettre = pageFragment.querySelector('[data-ref="btn-soumettre"]');
    if (btnSoumettre) {
      btnSoumettre.disabled = M.enCoursDeTraitement;
      btnSoumettre.textContent = M.enCoursDeTraitement
        ? "Enregistrement..."
        : "Enregistrer les modifications";
    }

    let form = pageFragment.querySelector('[data-form="modifier-profil"]');
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        let formData = new FormData(form);
        C.enregistrerModifications({
          email: formData.get("email") || "",
          ancienMotDePasse: formData.get("ancienMotDePasse") || "",
          nouveauMotDePasse: formData.get("nouveauMotDePasse") || "",
        });
      });
    }
  } else if (M.ongletActif === "commandes") {
    sectionProfil?.classList.add("hidden");
    sectionCommandes?.classList.remove("hidden");

    let blocVide = pageFragment.querySelector('[data-ref="commandes-vide"]');
    let listeCommandes = pageFragment.querySelector('[data-ref="liste-commandes"]');

    if (M.commandes.length === 0) {
      blocVide?.classList.remove("hidden");
      listeCommandes?.classList.add("hidden");
    } else {
      blocVide?.classList.add("hidden");
      listeCommandes?.classList.remove("hidden");

      for (let i = 0, nb = M.commandes.length; i < nb; i++) {
        let cmd = M.commandes[i];
        let carteFrag = htmlToFragment(carteCommandeTemplate);

        let numEl = carteFrag.querySelector('[data-ref="numero-commande"]');
        if (numEl) numEl.textContent = cmd.numero_commande;

        let badgeEl = carteFrag.querySelector('[data-ref="badge-statut"]');
        if (badgeEl) {
          let badgeInfo = obtenirBadgeStatut(cmd.statut);
          badgeEl.className = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-semibold ${badgeInfo.classes}`;
          badgeEl.textContent = badgeInfo.libelle;
        }

        let dateEl = carteFrag.querySelector('[data-ref="date-commande"]');
        if (dateEl) dateEl.textContent = formaterDateLocale(cmd.date_commande);

        let apercuEl = carteFrag.querySelector('[data-ref="articles-apercu"]');
        if (apercuEl) {
          if (cmd.articles_apercu) {
            apercuEl.textContent = cmd.articles_apercu;
          } else {
            apercuEl.remove();
          }
        }

        let totalEl = carteFrag.querySelector('[data-ref="total-commande"]');
        if (totalEl) totalEl.textContent = formaterPrix(cmd.total);

        let lienEl = carteFrag.querySelector('[data-ref="lien-detail"]');
        if (lienEl) {
          lienEl.setAttribute("href", `/confirmation-commande/${cmd.numero_commande}`);
        }

        listeCommandes.appendChild(carteFrag);
      }
    }
  }

  return pageFragment;
};

/**
 * Fonction d'entrée pour la route /compte.
 *
 * @returns {Promise<DocumentFragment>}
 */
export function ComptePage() {
  return C.init();
}
