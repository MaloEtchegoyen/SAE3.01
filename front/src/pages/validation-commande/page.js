import { CartData } from "../../data/cart.js";
import { AuthData } from "../../data/auth.js";
import { OrderData } from "../../data/order.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment, escapeHtml } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { MessageView } from "../../ui/message/index.js";
import { resoudreUrlImage, placeholderImg } from "../../ui/carte-produit/index.js";
import template from "./template.html?raw";

/**
 * Modèle local de la page Validation de Commande.
 * Stocke l'état nécessaire au récapitulatif sans jamais toucher au DOM.
 */
let M = {
  articles: [],
  total: 0,
  nbArticles: 0,
  utilisateur: null,
  enCours: false,
  message: null,
};

let C = {};

/**
 * Charge l'état du panier et de la session utilisateur.
 */
C.charger = function () {
  M.articles = CartData.obtenirArticles();
  M.total = CartData.calculerTotal();
  M.nbArticles = CartData.compterArticles();
  M.utilisateur = AuthData.obtenirUtilisateur();
};

/**
 * Action de validation explicite de la commande.
 */
C.handler_confirmer_commande = async function () {
  if (M.enCours) return;

  if (M.nbArticles === 0) {
    M.message = {
      type: "erreur",
      texte: "Votre panier est vide.",
    };
    V.rafraichir();
    return;
  }

  if (!AuthData.estConnecte()) {
    navigate("/connexion");
    return;
  }

  M.enCours = true;
  M.message = null;
  V.rafraichir();

  // Préparation du payload pour le backend
  let articlesPayload = M.articles.map((item) => ({
    produitId: item.produitId,
    varianteId: item.varianteId || null,
    options: item.options || [],
    nomVariante: item.nomVariante || null,
    quantite: item.quantite,
  }));

  try {
    let reponse = await OrderData.creerCommande(articlesPayload);

    // Vider le panier immédiatement après validation réussie
    CartData.viderPanier();

    // Rediriger vers la page de confirmation avec le numéro unique
    navigate(`/confirmation-commande?numero=${encodeURIComponent(reponse.numero_commande)}`);
  } catch (erreur) {
    M.enCours = false;
    M.message = {
      type: "erreur",
      texte: erreur.message || "Une erreur est survenue lors de l'enregistrement de votre commande.",
    };
    V.rafraichir();
  }
};

/**
 * Initialisation de la page.
 * Vérifie l'authentification et la présence d'articles.
 */
C.init = async function () {
  M.message = null;
  M.enCours = false;

  let session = await AuthData.verifierSession();
  if (!session.connecte) {
    navigate("/connexion");
    return document.createDocumentFragment();
  }

  C.charger();

  if (M.nbArticles === 0) {
    navigate("/panier");
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
 * Génère le fragment DOM à partir de l'état de M.
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

  // Informations utilisateur
  let refUtilisateur = pageFragment.querySelector('[data-ref="utilisateur-login"]');
  if (refUtilisateur && M.utilisateur) {
    refUtilisateur.textContent = M.utilisateur.utilisateur || "Client";
  }

  // Nombre d'articles et total
  let refNbArticles = pageFragment.querySelector('[data-ref="nb-articles"]');
  if (refNbArticles) {
    refNbArticles.textContent =
      M.nbArticles > 1 ? `${M.nbArticles} produits` : `${M.nbArticles} produit`;
  }

  let refTotal = pageFragment.querySelector('[data-ref="total-commande"]');
  if (refTotal) {
    refTotal.textContent = formaterPrix(M.total);
  }

  // Liste des articles
  let refListe = pageFragment.querySelector('[data-ref="liste-articles"]');
  if (refListe) {
    let fragmentArticles = document.createDocumentFragment();

    for (let i = 0; i < M.articles.length; i++) {
      let article = M.articles[i];
      let totalLigne = Number(article.prix || 0) * Number(article.quantite || 1);
      let urlImage = resoudreUrlImage(article.image);
      let imgHtml = `
        <div class="h-16 w-16 rounded-xl bg-feuillette-creme/20 border border-feuillette-creme/40 flex items-center justify-center shrink-0 overflow-hidden">
          <img src="${escapeHtml(urlImage)}" alt="${escapeHtml(article.nom)}" class="h-full w-full object-cover" onerror="this.src='${escapeHtml(placeholderImg)}'" />
        </div>
      `;

      let ligneHtml = `
        <div class="flex items-center justify-between py-4 gap-4">
          <div class="flex items-center gap-3 min-w-0">
            ${imgHtml}
            <div class="min-w-0">
              <p class="font-semibold text-feuillette-charbon truncate">${escapeHtml(article.nom)}</p>
              ${
                article.nomVariante
                  ? `<p class="text-caption text-feuillette-charbon/70 font-medium">Option : ${escapeHtml(article.nomVariante)}</p>`
                  : ""
              }
              <p class="text-caption text-feuillette-charbon/60 mt-0.5">Quantité : <span class="font-medium text-feuillette-charbon">${article.quantite}</span> × ${formaterPrix(article.prix)}</p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="font-bold text-feuillette-charbon text-body">${formaterPrix(totalLigne)}</span>
          </div>
        </div>
      `;

      fragmentArticles.appendChild(htmlToFragment(ligneHtml));
    }

    refListe.replaceChildren(fragmentArticles);
  }

  // Bouton de confirmation
  let btnConfirmer = pageFragment.querySelector('[data-action="confirmer-commande"]');
  let texteBouton = pageFragment.querySelector('[data-ref="texte-bouton"]');

  if (btnConfirmer) {
    if (M.enCours) {
      btnConfirmer.disabled = true;
      if (texteBouton) texteBouton.textContent = "Validation en cours...";
    } else {
      btnConfirmer.disabled = false;
      if (texteBouton) texteBouton.textContent = `Confirmer ma commande (${formaterPrix(M.total)})`;
      btnConfirmer.addEventListener("click", () => {
        C.handler_confirmer_commande();
      });
    }
  }

  return pageFragment;
};

/**
 * Page de récapitulatif et validation de commande.
 *
 * @returns {Promise<DocumentFragment>}
 */
export function ValidationCommandePage() {
  return C.init();
}

