import { AuthData } from "../../data/auth.js";
import { UserData } from "../../data/user.js";
import { OrderData } from "../../data/order.js";
import { CartData } from "../../data/cart.js";
import { navigate } from "../../lib/router.js";
import { htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import { MessageView } from "../../ui/message/index.js";
import { resoudreUrlImage } from "../../ui/carte-produit/index.js";
import template from "./template.html?raw";
import ligneTableauTemplate from "./ligne-tableau-commande.html?raw";
import ligneDetailArticleTemplate from "./ligne-detail-article.html?raw";

/**
 * Modèle local de la page Compte (Espace personnel client & Historique SUI-c).
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
  commandeSelectionneeId: null,
  tri: "date_desc",
  pagination: {
    page: 1,
    pagesTotal: 1,
    total: 0,
    parPage: 5,
  },
  filtres: {
    statut: "",
    periode: "",
  },
  chargementCommandes: false,
  chargement: true,
  ongletActif: "profil", // 'profil' | 'commandes'
  message: null, // { type: 'succes' | 'erreur' | 'info', texte: string } | null
  enCoursDeTraitement: false,
};

let C = {};

/**
 * Charge les commandes avec filtres, tri et pagination.
 */
C.chargerCommandes = async function () {
  M.chargementCommandes = true;
  try {
    let reponse = await OrderData.listerMesCommandes({
      statut: M.filtres.statut,
      periode: M.filtres.periode,
      page: M.pagination.page,
      parPage: M.pagination.parPage,
      tri: M.tri,
    });

    if (reponse && Array.isArray(reponse.items)) {
      M.commandes = reponse.items;
      M.pagination.page = reponse.page || 1;
      M.pagination.pagesTotal = reponse.pagesTotal || 1;
      M.pagination.total = reponse.total || 0;
      M.pagination.parPage = reponse.parPage || 5;
    } else if (Array.isArray(reponse)) {
      M.commandes = reponse;
      M.pagination.total = reponse.length;
      M.pagination.pagesTotal = 1;
      M.pagination.page = 1;
    } else {
      M.commandes = [];
      M.pagination.total = 0;
      M.pagination.pagesTotal = 1;
    }

    // Ne pas sélectionner par défaut pour n'afficher le détail qu'au clic
    let commandeExistante = M.commandes.find((c) => c.id === M.commandeSelectionneeId);
    if (!commandeExistante) {
      M.commandeSelectionneeId = null;
    }
  } catch (erreur) {
    M.commandes = [];
    M.commandeSelectionneeId = null;
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors du chargement des commandes.",
    };
  } finally {
    M.chargementCommandes = false;
  }
};

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

    // Charger les commandes initiales
    await C.chargerCommandes();
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
 * Changement du filtre de statut.
 *
 * @param {string} nouveauStatut
 */
C.changerFiltreStatut = async function (nouveauStatut) {
  M.filtres.statut = nouveauStatut;
  M.pagination.page = 1;
  await C.chargerCommandes();
  V.rafraichir();
};

/**
 * Changement du filtre de période.
 *
 * @param {string} nouvellePeriode
 */
C.changerFiltrePeriode = async function (nouvellePeriode) {
  M.filtres.periode = nouvellePeriode;
  M.pagination.page = 1;
  await C.chargerCommandes();
  V.rafraichir();
};

/**
 * Alterne le tri par date.
 */
C.basculerTriDate = async function () {
  M.tri = M.tri === "date_desc" ? "date_asc" : "date_desc";
  M.pagination.page = 1;
  await C.chargerCommandes();
  V.rafraichir();
};

/**
 * Changement de page de commandes.
 *
 * @param {number} nouvellePage
 */
C.changerPage = async function (nouvellePage) {
  if (nouvellePage < 1 || nouvellePage > M.pagination.pagesTotal) return;
  M.pagination.page = nouvellePage;
  await C.chargerCommandes();
  V.rafraichir();
};

/**
 * Sélectionne une commande pour afficher son détail en bas (ou la désélectionne si déjà active).
 *
 * @param {number} commandeId
 */
C.selectionnerCommande = function (commandeId) {
  if (M.commandeSelectionneeId === commandeId) {
    M.commandeSelectionneeId = null;
  } else {
    M.commandeSelectionneeId = commandeId;
  }
  V.rafraichir();

  if (M.commandeSelectionneeId !== null) {
    // Scroll doux vers l'encadré de détail
    let elDetail = document.querySelector('[data-ref="carte-detail-commande"]');
    if (elDetail) {
      elDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
};

/**
 * Remet les articles d'une commande dans le panier courant après vérification
 * en temps réel de leur disponibilité, stocks et prix via le backend.
 *
 * @param {object} commande
 */
C.commanderANouveau = async function (commande) {
  if (M.enCoursDeTraitement) return;
  if (!commande || (!commande.id && !commande.numero_commande)) {
    return;
  }

  M.enCoursDeTraitement = true;
  M.message = null;
  V.rafraichir();

  try {
    let identifiant = commande.id || commande.numero_commande;
    let resultat = await OrderData.preparerRecommande(identifiant);

    if (!resultat || !resultat.succes) {
      throw new Error("Impossible de vérifier la disponibilité de cette commande.");
    }

    let articlesAAjouter = Array.isArray(resultat.articles_a_ajouter) ? resultat.articles_a_ajouter : [];
    let indisponibles = Array.isArray(resultat.articles_indisponibles) ? resultat.articles_indisponibles : [];
    let ajustes = Array.isArray(resultat.articles_ajustes) ? resultat.articles_ajustes : [];
    let prixModifies = Array.isArray(resultat.articles_prix_modifies) ? resultat.articles_prix_modifies : [];

    // Ajout des articles disponibles au panier avec leurs données fraîches
    for (let i = 0, nb = articlesAAjouter.length; i < nb; i++) {
      let item = articlesAAjouter[i];
      CartData.ajouterArticle({
        produit: item.produit,
        quantite: item.quantite,
        variante: item.variante,
        options: item.options || [],
      });
    }

    // Construction du message d'information ou d'avertissement
    if (articlesAAjouter.length === 0) {
      let motif =
        indisponibles.length > 0
          ? indisponibles
              .map(
                (a) =>
                  `${a.nom_produit}${a.nom_variante ? ` (${a.nom_variante})` : ""} : ${a.motif}`
              )
              .join(" ; ")
          : "Tous les articles sont en rupture de stock ou retirés du catalogue.";
      M.message = {
        type: "erreur",
        texte: `Aucun article n'a pu être réajouté au panier. ${motif}`,
      };
    } else {
      let alertes = [];

      if (indisponibles.length > 0) {
        let nomsIndispo = indisponibles
          .map(
            (a) =>
              `${a.nom_produit}${a.nom_variante ? ` (${a.nom_variante})` : ""}`
          )
          .join(", ");
        alertes.push(`Articles indisponibles non ajoutés : ${nomsIndispo}.`);
      }

      if (ajustes.length > 0) {
        let detailsAjustes = ajustes
          .map((a) => `${a.nom} (quantité réduite à ${a.quantite_ajoutee})`)
          .join(", ");
        alertes.push(`Quantités réajustées selon le stock : ${detailsAjustes}.`);
      }

      if (prixModifies.length > 0) {
        let detailsPrix = prixModifies
          .map(
            (p) =>
              `${p.nom} (${formaterPrix(p.ancien_prix)} → ${formaterPrix(p.nouveau_prix)})`
          )
          .join(", ");
        alertes.push(`Tarifs réactualisés : ${detailsPrix}.`);
      }

      let texteFinal = `Les articles disponibles de la commande ${resultat.numero_commande || commande.numero_commande} ont été réajoutés à votre panier.`;
      if (alertes.length > 0) {
        texteFinal += ` Note : ${alertes.join(" ")}`;
      }

      M.message = {
        type: alertes.length > 0 ? "info" : "succes",
        texte: texteFinal,
      };
    }
  } catch (erreur) {
    M.message = {
      type: "erreur",
      texte: erreur.message || "Erreur lors de la préparation de la commande.",
    };
  } finally {
    M.enCoursDeTraitement = false;
    V.rafraichir();
  }
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
    let reponseProfil = await UserData.modifierProfil({ nom: email, email });
    M.profil.email = reponseProfil.profil?.email || email;

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
 * @param {object} [params={}]
 * @returns {Promise<DocumentFragment>}
 */
C.init = async function (params = {}) {
  M.message = null;

  let search = new URLSearchParams(window.location.search);
  let tabParam = search.get("tab");
  if (window.location.pathname.endsWith("/commandes") || tabParam === "commandes") {
    M.ongletActif = "commandes";
  }

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
 * Formate une date au format court JJ/MM/AAAA pour le tableau.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formaterDateTableau(dateStr) {
  if (!dateStr) return "";
  try {
    let d = new Date(dateStr.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return dateStr;
    let jour = String(d.getDate()).padStart(2, "0");
    let mois = String(d.getMonth() + 1).padStart(2, "0");
    let annee = d.getFullYear();
    return `${jour}/${mois}/${annee}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formate une date au format étendu (ex: 10 octobre 2026) pour l'encadré détail.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formaterDateDetail(dateStr) {
  if (!dateStr) return "";
  try {
    let d = new Date(dateStr.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Construit le fragment principal de la page en fonction de l'état M.
 *
 * @returns {DocumentFragment}
 */
V.createPageFragment = function () {
  let pageFragment = htmlToFragment(template);

  // Nom dynamique / email dans le titre d'accueil
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

  // Sections
  let sectionProfil = pageFragment.querySelector('[data-ref="section-profil"]');
  let sectionCommandes = pageFragment.querySelector('[data-ref="section-commandes"]');

  if (M.ongletActif === "profil") {
    sectionProfil?.classList.remove("hidden");
    sectionCommandes?.classList.add("hidden");

    let champEmail = pageFragment.querySelector('[data-ref="champ-email"]');
    if (champEmail) {
      champEmail.value = M.profil.email || "";
    }

    let btnSoumettre = pageFragment.querySelector('[data-ref="btn-soumettre"]');
    if (btnSoumettre) {
      btnSoumettre.disabled = M.enCoursDeTraitement;
      btnSoumettre.textContent = M.enCoursDeTraitement
        ? "Enregistrement..."
        : "Modifier";
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

    // Sélecteur de statut
    let selectStatut = pageFragment.querySelector('[data-ref="filtre-statut"]');
    if (selectStatut) {
      selectStatut.value = M.filtres.statut;
      selectStatut.addEventListener("change", (e) => {
        C.changerFiltreStatut(e.target.value);
      });
    }

    // Sélecteur de période
    let selectPeriode = pageFragment.querySelector('[data-ref="filtre-periode"]');
    if (selectPeriode) {
      selectPeriode.value = M.filtres.periode;
      selectPeriode.addEventListener("change", (e) => {
        C.changerFiltrePeriode(e.target.value);
      });
    }

    // Bouton de tri de la colonne Date
    let btnTriDate = pageFragment.querySelector('[data-action="tri-date"]');
    let indicateurTri = pageFragment.querySelector('[data-ref="indicateur-tri"]');
    if (btnTriDate) {
      if (indicateurTri) {
        indicateurTri.textContent = M.tri === "date_asc" ? "▲" : "▼";
      }
      btnTriDate.addEventListener("click", () => {
        C.basculerTriDate();
      });
    }

    // Chargement
    let blocChargement = pageFragment.querySelector('[data-ref="commandes-chargement"]');
    if (blocChargement) {
      if (M.chargementCommandes) {
        blocChargement.classList.remove("hidden");
      } else {
        blocChargement.classList.add("hidden");
      }
    }

    let blocVide = pageFragment.querySelector('[data-ref="commandes-vide"]');
    let blocTableau = pageFragment.querySelector('[data-ref="bloc-tableau-commandes"]');
    let corpsTableau = pageFragment.querySelector('[data-ref="corps-tableau-commandes"]');
    let carteDetail = pageFragment.querySelector('[data-ref="carte-detail-commande"]');

    if (!M.chargementCommandes && M.commandes.length === 0) {
      blocVide?.classList.remove("hidden");
      blocTableau?.classList.add("hidden");
      carteDetail?.classList.add("hidden");
    } else {
      blocVide?.classList.add("hidden");
      blocTableau?.classList.remove("hidden");

      // Remplissage des lignes du tableau
      if (corpsTableau) {
        corpsTableau.replaceChildren();

        for (let i = 0, nb = M.commandes.length; i < nb; i++) {
          let cmd = M.commandes[i];
          let ligneFrag = htmlToFragment(ligneTableauTemplate);
          let tr = ligneFrag.querySelector("tr");

          let estSelectionnee = cmd.id === M.commandeSelectionneeId;
          if (estSelectionnee && tr) {
            tr.classList.add("bg-white/20");
          }

          let colNumero = ligneFrag.querySelector('[data-ref="col-numero"]');
          if (colNumero) colNumero.textContent = cmd.numero_commande;

          let colDate = ligneFrag.querySelector('[data-ref="col-date"]');
          if (colDate) colDate.textContent = formaterDateTableau(cmd.date_commande);

          let colStatut = ligneFrag.querySelector('[data-ref="col-statut"]');
          if (colStatut) colStatut.textContent = cmd.statut;

          let colTotal = ligneFrag.querySelector('[data-ref="col-total"]');
          if (colTotal) colTotal.textContent = formaterPrix(cmd.total);

          let btnVoirDetail = ligneFrag.querySelector('[data-action="voir-detail"]');
          if (btnVoirDetail) {
            btnVoirDetail.addEventListener("click", () => {
              C.selectionnerCommande(cmd.id);
            });
          }

          corpsTableau.appendChild(ligneFrag);
        }
      }

      // Pagination
      let infoPagination = pageFragment.querySelector('[data-ref="info-pagination"]');
      if (infoPagination) {
        let debut = (M.pagination.page - 1) * M.pagination.parPage + 1;
        let fin = Math.min(M.pagination.page * M.pagination.parPage, M.pagination.total);
        infoPagination.textContent = `${debut}-${fin} sur ${M.pagination.total} commandes`;
      }

      let btnPrec = pageFragment.querySelector('[data-action="page-precedente"]');
      if (btnPrec) {
        btnPrec.disabled = M.pagination.page <= 1;
        btnPrec.addEventListener("click", () => {
          C.changerPage(M.pagination.page - 1);
        });
      }

      let btnSuiv = pageFragment.querySelector('[data-action="page-suivante"]');
      if (btnSuiv) {
        btnSuiv.disabled = M.pagination.page >= M.pagination.pagesTotal;
        btnSuiv.addEventListener("click", () => {
          C.changerPage(M.pagination.page + 1);
        });
      }

      let conteneurBoutonsPages = pageFragment.querySelector('[data-ref="pagination-boutons"]');
      if (conteneurBoutonsPages) {
        conteneurBoutonsPages.replaceChildren();
        for (let p = 1; p <= M.pagination.pagesTotal; p++) {
          let btnPage = document.createElement("button");
          btnPage.type = "button";
          btnPage.textContent = String(p);

          if (p === M.pagination.page) {
            btnPage.className =
              "rounded-xl bg-input px-3.5 py-1.5 text-body-sm font-bold text-white shadow-xs cursor-default";
          } else {
            btnPage.className =
              "rounded-xl bg-accent hover:bg-input px-3.5 py-1.5 text-body-sm font-medium text-white transition cursor-pointer";
            btnPage.addEventListener("click", () => {
              C.changerPage(p);
            });
          }

          conteneurBoutonsPages.appendChild(btnPage);
        }
      }

      // Remplissage de l'encadré Détail de la commande sélectionnée uniquement si une commande est choisie
      let cmdSelectionnee = M.commandeSelectionneeId !== null
        ? M.commandes.find((c) => c.id === M.commandeSelectionneeId)
        : null;

      if (cmdSelectionnee && carteDetail) {
        carteDetail.classList.remove("hidden");

        let detNumero = carteDetail.querySelector('[data-ref="detail-numero-commande"]');
        if (detNumero) detNumero.textContent = cmdSelectionnee.numero_commande;

        let detDate = carteDetail.querySelector('[data-ref="detail-date-commande"]');
        if (detDate) detDate.textContent = formaterDateDetail(cmdSelectionnee.date_commande);

        let detBadge = carteDetail.querySelector('[data-ref="detail-badge-statut"]');
        if (detBadge) detBadge.textContent = cmdSelectionnee.statut;

        let detTotal = carteDetail.querySelector('[data-ref="detail-total-commande"]');
        if (detTotal) detTotal.textContent = formaterPrix(cmdSelectionnee.total);

        let listeArticlesEl = carteDetail.querySelector('[data-ref="detail-liste-articles"]');
        if (listeArticlesEl) {
          listeArticlesEl.replaceChildren();

          if (Array.isArray(cmdSelectionnee.lignes) && cmdSelectionnee.lignes.length > 0) {
            for (let j = 0, nbL = cmdSelectionnee.lignes.length; j < nbL; j++) {
              let ligne = cmdSelectionnee.lignes[j];
              let ligneFrag = htmlToFragment(ligneDetailArticleTemplate);

              let imgEl = ligneFrag.querySelector('[data-ref="article-image"]');
              let placeholderEl = ligneFrag.querySelector('[data-ref="article-placeholder"]');
              let urlImage = resoudreUrlImage(ligne.image_url);
              if (imgEl && urlImage) {
                imgEl.src = urlImage;
                imgEl.alt = ligne.nom_produit || "Produit";
                imgEl.classList.remove("hidden");
                placeholderEl?.classList.add("hidden");
                imgEl.onerror = () => {
                  imgEl.classList.add("hidden");
                  placeholderEl?.classList.remove("hidden");
                };
              }

              let nomEl = ligneFrag.querySelector('[data-ref="article-nom"]');
              if (nomEl) nomEl.textContent = ligne.nom_produit;

              let optionEl = ligneFrag.querySelector('[data-ref="article-option"]');
              if (optionEl) {
                optionEl.textContent = ligne.nom_variante || "Sans option";
              }

              let prixUnitEl = ligneFrag.querySelector('[data-ref="article-prix-unitaire"]');
              if (prixUnitEl) {
                prixUnitEl.textContent = `${formaterPrix(ligne.prix_unitaire)} / unité`;
              }

              let qteEl = ligneFrag.querySelector('[data-ref="article-quantite"]');
              if (qteEl) {
                qteEl.textContent = `× ${ligne.quantite}`;
              }

              let totalLigneEl = ligneFrag.querySelector('[data-ref="article-total-ligne"]');
              if (totalLigneEl) {
                totalLigneEl.textContent = formaterPrix(ligne.total_ligne);
              }

              listeArticlesEl.appendChild(ligneFrag);
            }
          }
        }

        let btnCommanderANouveau = carteDetail.querySelector(
          '[data-action="commander-a-nouveau"]'
        );
        if (btnCommanderANouveau) {
          if (M.enCoursDeTraitement) {
            btnCommanderANouveau.disabled = true;
            btnCommanderANouveau.classList.add("opacity-50", "cursor-not-allowed");
            btnCommanderANouveau.textContent = "Vérification en cours...";
          }
          btnCommanderANouveau.addEventListener("click", () => {
            C.commanderANouveau(cmdSelectionnee);
          });
        }
      } else if (carteDetail) {
        carteDetail.classList.add("hidden");
      }
    }
  }

  return pageFragment;
};

/**
 * Fonction d'entrée pour la route /compte ou /commandes.
 *
 * @param {object} [params={}]
 * @returns {Promise<DocumentFragment>}
 */
export function ComptePage(params) {
  return C.init(params);
}
