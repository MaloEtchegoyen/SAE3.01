import { OrderData } from "../../data/order.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { MessageView } from "../../ui/message/index.js";
import { TableCommandesView } from "../../ui/table-commandes/index.js";
import { PaginationView } from "../../ui/pagination/index.js";
import { DetailCommandeAdminView } from "../../ui/detail-commande-admin/index.js";
import { ModalConfirmationView } from "../../ui/modal-confirmation/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Gestion des commandes.
 * Strictement découplé du DOM.
 */
let M = {
  commandes: [],
  selection: new Set(),
  tri: "date_desc",
  statut: "",
  date: "",
  montant: "",
  page: 1,
  pagesTotal: 1,
  total: 0,
  parPage: 15,
  message: null,
  commandeEnDetail: null,
  confirmation: null,
};

let C = {};

/**
 * Charge les commandes depuis le serveur selon les critères du modèle M.
 */
C.charger = async function () {
  try {
    let reponse = await OrderData.fetchAllAdmin({
      tri: M.tri,
      statut: M.statut,
      date: M.date,
      montant: M.montant,
      page: M.page,
      parPage: M.parPage,
    });
    M.commandes = reponse.items || [];
    M.page = reponse.page || 1;
    M.pagesTotal = reponse.pagesTotal || 1;
    M.total = reponse.total || 0;
  } catch (erreur) {
    M.commandes = [];
    let texte = erreur.message;
    if (erreur.statut === 401) {
      navigate("/connexion-admin");
      return;
    }
    if (erreur.statut === 403) {
      texte = "Accès réservé aux administrateurs.";
    }
    M.message = { type: "erreur", texte };
  }
};

/**
 * Change le tri actif et recharge la première page.
 *
 * @param {string} nouveauTri
 */
C.handler_tri = async function (nouveauTri) {
  M.tri = nouveauTri;
  M.page = 1;
  await C.charger();
  V.rafraichir();
};

/**
 * Applique l'ensemble des filtres de recherche et recharge la première page.
 *
 * @param {{ statut?: string, date?: string, montant?: string }} filtres
 */
C.handler_filtrer = async function (filtres = {}) {
  M.statut = filtres.statut ?? "";
  M.date = filtres.date ?? "";
  M.montant = filtres.montant ?? "";
  M.page = 1;
  M.selection.clear();
  await C.charger();
  V.rafraichir();
};

/**
 * Navigue vers une autre page du catalogue.
 *
 * @param {number} nouvellePage
 */
C.handler_page = async function (nouvellePage) {
  if (nouvellePage < 1 || nouvellePage > M.pagesTotal) return;
  M.page = nouvellePage;
  await C.charger();
  V.rafraichir();
};

/**
 * Sélectionne ou désélectionne une commande pour les actions en lot.
 *
 * @param {number} id
 * @param {boolean} coche
 */
C.handler_selection = function (id, coche) {
  if (coche) {
    M.selection.add(Number(id));
  } else {
    M.selection.delete(Number(id));
  }
  V.rafraichir();
};

/**
 * Sélectionne ou désélectionne l'ensemble des commandes actuellement visibles.
 *
 * @param {boolean} coche
 */
C.handler_tout_selectionner = function (coche) {
  if (coche) {
    for (let i = 0; i < M.commandes.length; i++) {
      M.selection.add(M.commandes[i].id);
    }
  } else {
    M.selection.clear();
  }
  V.rafraichir();
};

/**
 * Fait passer une commande au statut indiqué (ex: « disponible » ou « retirée »).
 *
 * @param {number} id
 * @param {string} nouveauStatut
 */
C.handler_changer_statut = async function (id, nouveauStatut) {
  try {
    let res = await OrderData.modifierStatut(id, nouveauStatut);
    M.message = {
      type: "succes",
      texte: `Commande ${res.numero_commande || `#${id}`} passée au statut « ${nouveauStatut} ».`,
    };

    if (M.commandeEnDetail && M.commandeEnDetail.id === id) {
      M.commandeEnDetail = await OrderData.fetchDetailAdmin(id);
    }

    await C.charger();
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }
  V.rafraichir();
};

/**
 * Ouvre la modale de confirmation avant d'annuler une commande unitaire.
 *
 * @param {number} id
 */
C.handler_demander_annulation = function (id) {
  let cmd = M.commandes.find((c) => c.id === id) || (M.commandeEnDetail?.id === id ? M.commandeEnDetail : null);
  let numero = cmd?.numero_commande ? ` « ${cmd.numero_commande} »` : "";

  M.confirmation = {
    titre: "Confirmation d'annulation",
    message: `Êtes-vous sûr de vouloir annuler la commande${numero} ? Les produits commandés seront automatiquement recrédités en stock.`,
    boutonConfirmer: "Confirmer l'annulation",
    boutonAnnuler: "Conserver la commande",
    surConfirmer: async () => {
      M.confirmation = null;
      try {
        let res = await OrderData.modifierStatut(id, "annulée", "Annulation administrateur");
        M.message = {
          type: "succes",
          texte: `Commande ${res.numero_commande || `#${id}`} annulée avec succès et stock réintégré.`,
        };

        if (M.commandeEnDetail && M.commandeEnDetail.id === id) {
          M.commandeEnDetail = await OrderData.fetchDetailAdmin(id);
        }

        await C.charger();
      } catch (erreur) {
        M.message = { type: "erreur", texte: erreur.message };
      }
      V.rafraichir();
    },
  };
  V.rafraichir();
};

/**
 * Déclenche une action en lot sur toutes les commandes sélectionnées.
 *
 * @param {string} action
 */
C.handler_action_lot = function (action) {
  let nb = M.selection.size;
  if (nb === 0) return;

  let ids = Array.from(M.selection);

  if (action === "annulée") {
    M.confirmation = {
      titre: "Annuler les commandes sélectionnées",
      message: `Êtes-vous sûr de vouloir annuler les ${nb} commande(s) sélectionnée(s) ? Les produits de chaque commande seront recrédités en stock.`,
      boutonConfirmer: "Oui, annuler ces commandes",
      boutonAnnuler: "Abandonner",
      surConfirmer: async () => {
        M.confirmation = null;
        try {
          let res = await OrderData.modifierStatutLot(ids, "annulée");
          M.selection.clear();
          let txt = `${res.modifies} commande(s) annulée(s) et stocks réintégrés.`;
          if (res.ignores > 0) txt += ` (${res.ignores} ignorée(s) car déjà traitées)`;
          M.message = { type: "succes", texte: txt };
          await C.charger();
        } catch (erreur) {
          M.message = { type: "erreur", texte: erreur.message };
        }
        V.rafraichir();
      },
    };
    V.rafraichir();
    return;
  }

  // Pour les passages en lot à « disponible » ou « retirée »
  (async () => {
    try {
      let res = await OrderData.modifierStatutLot(ids, action);
      M.selection.clear();
      let txt = `${res.modifies} commande(s) passée(s) au statut « ${action} ».`;
      if (res.ignores > 0) txt += ` (${res.ignores} non modifiée(s))`;
      M.message = { type: "succes", texte: txt };
      await C.charger();
    } catch (erreur) {
      M.message = { type: "erreur", texte: erreur.message };
    }
    V.rafraichir();
  })();
};

/**
 * Ferme la modale de confirmation.
 */
C.handler_fermer_confirmation = function () {
  M.confirmation = null;
  V.rafraichir();
};

/**
 * Ouvre la vue détaillée complète d'une commande.
 *
 * @param {number} id
 */
C.handler_voir_detail = async function (id) {
  try {
    let detail = await OrderData.fetchDetailAdmin(id);
    M.commandeEnDetail = detail;
  } catch (erreur) {
    M.message = { type: "erreur", texte: erreur.message };
  }
  V.rafraichir();
};

/**
 * Ferme la vue détaillée d'une commande.
 */
C.handler_fermer_detail = function () {
  M.commandeEnDetail = null;
  V.rafraichir();
};

/**
 * Initialisation de la page.
 *
 * @returns {Promise<DocumentFragment>}
 */
C.init = async function () {
  M.message = null;
  M.commandeEnDetail = null;
  M.confirmation = null;
  M.selection.clear();
  M.page = 1;
  M.statut = "";
  M.date = "";
  M.montant = "";
  M.tri = "date_desc";

  await C.charger();
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
  V.racine.replaceWith(fragment);
  V.racine = nouvelleRacine;
};

V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Message système
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  // Affichage selon le mode : Liste des commandes ou Détail complet
  let vueListe = pageFragment.querySelector("[data-vue-liste]");
  let vueDetail = pageFragment.querySelector("[data-vue-detail]");
  let slotTable = pageFragment.querySelector('slot[name="table"]');
  let slotPagination = pageFragment.querySelector('slot[name="pagination"]');
  let slotDetail = pageFragment.querySelector('slot[name="detail"]');

  if (M.commandeEnDetail) {
    if (vueListe) vueListe.classList.add("hidden");
    if (vueDetail) vueDetail.classList.remove("hidden");
    if (slotTable) slotTable.remove();
    if (slotPagination) slotPagination.remove();

    if (slotDetail) {
      slotDetail.replaceWith(
        DetailCommandeAdminView.dom(M.commandeEnDetail, {
          surFermer: C.handler_fermer_detail,
          surChangerStatut: C.handler_changer_statut,
          surDemanderAnnulation: C.handler_demander_annulation,
        })
      );
    }
  } else {
    if (vueListe) vueListe.classList.remove("hidden");
    if (vueDetail) vueDetail.classList.add("hidden");
    if (slotDetail) slotDetail.remove();

    if (slotTable) {
      slotTable.replaceWith(
        TableCommandesView.dom(
          {
            commandes: M.commandes,
            tri: M.tri,
            statut: M.statut,
            date: M.date,
            montant: M.montant,
            selection: M.selection,
          },
          {
            surTri: C.handler_tri,
            surFiltrer: C.handler_filtrer,
            surChangerStatut: C.handler_changer_statut,
            surDemanderAnnulation: C.handler_demander_annulation,
            surVoirDetail: C.handler_voir_detail,
            surSelection: C.handler_selection,
            surToutSelectionner: C.handler_tout_selectionner,
            surActionLot: C.handler_action_lot,
          }
        )
      );
    }

    if (slotPagination) {
      if (M.pagesTotal > 1) {
        slotPagination.replaceWith(
          PaginationView.dom(
            { page: M.page, pagesTotal: M.pagesTotal },
            { surPage: C.handler_page }
          )
        );
      } else {
        slotPagination.remove();
      }
    }
  }

  // Modale de confirmation avant annulation
  let slotConfirmation = pageFragment.querySelector('slot[name="confirmation"]');
  if (slotConfirmation) {
    if (M.confirmation) {
      slotConfirmation.replaceWith(
        ModalConfirmationView.dom(M.confirmation, {
          surConfirmer: M.confirmation.surConfirmer,
          surAnnuler: C.handler_fermer_confirmation,
        })
      );
    } else {
      slotConfirmation.remove();
    }
  }

  return pageFragment;
};

/**
 * Fonction exportée pour le routeur.
 *
 * @returns {Promise<DocumentFragment>}
 */
export function AdminCommandesPage() {
  return C.init();
}

