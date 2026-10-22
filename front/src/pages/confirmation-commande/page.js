import { AuthData } from "../../data/auth.js";
import { OrderData } from "../../data/order.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment, escapeHtml } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { MessageView } from "../../ui/message/index.js";
import { resoudreUrlImage, placeholderImg } from "../../ui/carte-produit/index.js";
import template from "./template.html?raw";

/**
 * Formate une date ISO/SQL en date lisible en français.
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
 * Modèle local de la page Confirmation de Commande.
 */
let M = {
  commande: null,
  chargement: true,
  message: null,
};

let C = {};

/**
 * Charge les détails de la commande par son numéro unique.
 *
 * @param {string} numeroCommande
 */
C.charger = async function (numeroCommande) {
  M.chargement = true;
  M.message = null;

  try {
    let commande = await OrderData.obtenirCommande(numeroCommande);
    M.commande = commande;
  } catch (erreur) {
    M.commande = null;
    M.message = {
      type: "erreur",
      texte: erreur.message || "Impossible de charger la commande demandée.",
    };
  } finally {
    M.chargement = false;
  }
};

/**
 * Initialisation de la route /confirmation-commande.
 *
 * @param {object} params
 */
C.init = async function (params = {}) {
  let session = await AuthData.verifierSession();
  if (!session.connecte) {
    navigate("/connexion");
    return document.createDocumentFragment();
  }

  // Récupérer le numéro soit depuis les params d'URL, soit depuis query string
  let numero = params.numero;
  if (!numero) {
    let search = new URLSearchParams(window.location.search);
    numero = search.get("numero");
  }

  if (!numero) {
    navigate("/");
    return document.createDocumentFragment();
  }

  await C.charger(numero);
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
 * Génère le DOM à partir de l'état de M.
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Slot Message
  let slotMessage = pageFragment.querySelector('slot[name="message"]');
  if (slotMessage) {
    if (M.message) {
      slotMessage.replaceWith(MessageView.dom(M.message));
    } else {
      slotMessage.remove();
    }
  }

  let blocContenu = pageFragment.querySelector('[data-ref="contenu-confirmation"]');

  if (!M.commande) {
    if (blocContenu) {
      blocContenu.classList.add("hidden");
    }
    return pageFragment;
  }

  if (blocContenu) {
    blocContenu.classList.remove("hidden");
  }

  let cmd = M.commande;

  // Numéro et statut
  let refNumero = pageFragment.querySelector('[data-ref="numero-commande"]');
  if (refNumero) refNumero.textContent = cmd.numero_commande;

  let refStatut = pageFragment.querySelector('[data-ref="statut-badge"]');
  if (refStatut) refStatut.textContent = cmd.statut || "En cours";

  let refDate = pageFragment.querySelector('[data-ref="date-commande"]');
  if (refDate) {
    refDate.textContent = formaterDateLocale(cmd.date_commande);
  }

  let refClient = pageFragment.querySelector('[data-ref="client-login"]');
  if (refClient) refClient.textContent = cmd.utilisateur_login || "Client";

  let refTotal = pageFragment.querySelector('[data-ref="total-prix"]');
  if (refTotal) refTotal.textContent = formaterPrix(cmd.total);

  // Lignes de commande avec prix figés
  let refLignes = pageFragment.querySelector('[data-ref="lignes-commande"]');
  if (refLignes && Array.isArray(cmd.lignes)) {
    let fragmentLignes = document.createDocumentFragment();

    for (let i = 0; i < cmd.lignes.length; i++) {
      let ligne = cmd.lignes[i];
      let urlImage = resoudreUrlImage(ligne.image_url);
      let imgHtml = `
        <div class="h-14 w-14 rounded-xl bg-subtle border border-border flex items-center justify-center shrink-0 overflow-hidden">
          <img src="${escapeHtml(urlImage)}" alt="${escapeHtml(ligne.nom_produit)}" class="h-full w-full object-cover" onerror="this.src='${escapeHtml(placeholderImg)}'" />
        </div>
      `;

      let itemHtml = `
        <div class="flex items-center justify-between py-3.5 gap-4">
          <div class="flex items-center gap-3 min-w-0">
            ${imgHtml}
            <div class="min-w-0">
              <p class="font-semibold text-content-primary truncate">${escapeHtml(ligne.nom_produit)}</p>
              ${
                ligne.nom_variante
                  ? `<p class="text-caption text-content-secondary font-medium">Option : ${escapeHtml(ligne.nom_variante)}</p>`
                  : ""
              }
              <p class="text-caption text-content-muted">Quantité : <strong class="text-content-primary">${ligne.quantite}</strong> × ${formaterPrix(ligne.prix_unitaire)}</p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="font-bold text-content-primary text-body-sm sm:text-body">${formaterPrix(ligne.total_ligne)}</span>
          </div>
        </div>
      `;

      fragmentLignes.appendChild(htmlToFragment(itemHtml));
    }

    refLignes.replaceChildren(fragmentLignes);
  }

  return pageFragment;
};

/**
 * Page de confirmation d'une commande validée.
 *
 * @param {object} [params={}] Paramètres de route
 * @returns {Promise<DocumentFragment>}
 */
export function ConfirmationCommandePage(params) {
  return C.init(params);
}
