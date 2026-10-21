import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import { formaterPrix } from "../../lib/format.js";
import placeholderImg from "../../../assets/landscape-placeholder.svg";
import template from "./template.html?raw";
import templateArticle from "./ligne-article.html?raw";
import templateJournal from "./ligne-journal.html?raw";

/**
 * Met en forme une chaîne de date ISO ou MySQL en français lisible avec heures et secondes.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function formaterDateComplete(dateStr) {
  if (!dateStr) return "-";
  try {
    let date = new Date(dateStr.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Résout l'URL d'affichage pour une image de produit.
 *
 * @param {string|null|undefined} sourceImage
 * @returns {string}
 */
function resoudreUrlImage(sourceImage) {
  if (!sourceImage || typeof sourceImage !== "string") return placeholderImg;

  let nettoyee = sourceImage.trim();
  if (!nettoyee) return placeholderImg;

  if (
    nettoyee.startsWith("http://") ||
    nettoyee.startsWith("https://") ||
    nettoyee.startsWith("data:") ||
    nettoyee.startsWith("blob:")
  ) {
    return nettoyee;
  }

  if (nettoyee.startsWith("/assets/") || nettoyee.includes("assets/")) {
    return nettoyee;
  }

  let nomFichier = nettoyee.includes("/") ? nettoyee.split("/").pop() : nettoyee;
  let base = import.meta.env.BASE_URL || "/";
  let racine = base.endsWith("/") ? base : `${base}/`;
  return `${racine}api/products/image?nom=${encodeURIComponent(nomFichier)}`;
}

/**
 * Vue interactive pour l'affichage détaillé d'une commande administrateur.
 */
let DetailCommandeAdminView = {
  /**
   * Construit le fragment DOM du détail de la commande.
   *
   * @param {{
   *   id: number,
   *   numero_commande: string,
   *   utilisateur_id: number,
   *   utilisateur_login: string,
   *   utilisateur_email?: string,
   *   statut: string,
   *   total: number,
   *   date_commande: string,
   *   lignes: Array<{
   *     id: number,
   *     nom_produit: string,
   *     nom_variante?: string|null,
   *     quantite: number,
   *     prix_unitaire: number,
   *     total_ligne: number,
   *     image_url?: string|null
   *   }>,
   *   journal: Array<{
   *     id: number,
   *     admin_login: string,
   *     ancien_statut: string,
   *     nouveau_statut: string,
   *     action: string,
   *     commentaire?: string|null,
   *     date_action: string
   *   }>
   * }} commande
   * @param {{
   *   surFermer?: () => void,
   *   surChangerStatut?: (id: number, statut: string) => void,
   *   surDemanderAnnulation?: (id: number) => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (commande, actions = {}) {
    if (!commande) {
      return document.createDocumentFragment();
    }

    let lignes = commande.lignes || [];
    let totalArticles = 0;
    for (let k = 0; k < lignes.length; k++) {
      totalArticles += Number(lignes[k].quantite) || 1;
    }

    let loginClient = commande.utilisateur_login || "Client";
    let emailClient =
      commande.utilisateur_email ||
      (commande.utilisateur_login ? `${commande.utilisateur_login}@cafefeuillette.fr` : "client@cafefeuillette.fr");

    let fragment = htmlToFragment(
      genericRenderer(template, {
        id: commande.id,
        numero_commande: commande.numero_commande,
        utilisateur_login: loginClient,
        utilisateur_email: emailClient,
        statut: commande.statut,
        total_formate: formaterPrix(commande.total),
        nb_articles_total: String(totalArticles),
      })
    );

    // 1. Bouton Retour aux commandes
    let btnRetour = fragment.querySelector('[data-action="retour-commandes"]');
    if (btnRetour && typeof actions.surFermer === "function") {
      btnRetour.addEventListener("click", () => actions.surFermer());
    }

    // 2. Sélecteur de statut & bouton enregistrer
    let selectStatut = fragment.querySelector("[data-select-statut]");
    if (selectStatut) {
      selectStatut.value = commande.statut;
    }

    let btnEnregistrer = fragment.querySelector('[data-action="enregistrer-statut"]');
    if (btnEnregistrer) {
      btnEnregistrer.addEventListener("click", () => {
        let nouveauStatut = selectStatut ? selectStatut.value : commande.statut;
        if (nouveauStatut === "annulée") {
          if (typeof actions.surDemanderAnnulation === "function") {
            actions.surDemanderAnnulation(commande.id);
          }
        } else if (typeof actions.surChangerStatut === "function") {
          actions.surChangerStatut(commande.id, nouveauStatut);
        }
      });
    }

    // 3. Remplissage des articles
    let conteneurArticles = fragment.querySelector("[data-liste-articles]");
    let nbArticles = lignes.length;

    for (let i = 0; i < nbArticles; i++) {
      let l = lignes[i];
      let fragArt = htmlToFragment(
        genericRenderer(templateArticle, {
          nom_produit: l.nom_produit,
          nom_variante: l.nom_variante || "",
          quantite: l.quantite,
          prix_unitaire: formaterPrix(l.prix_unitaire),
          total_ligne: formaterPrix(l.total_ligne),
          image_url: resoudreUrlImage(l.image_url),
        })
      );

      if (l.nom_variante) {
        let zoneVar = fragArt.querySelector("[data-zone-variante]");
        if (zoneVar) zoneVar.classList.remove("hidden");
      }

      conteneurArticles.appendChild(fragArt);
    }

    // 4. Remplissage du journal des modifications
    let journal = commande.journal || [];
    let nbJournal = journal.length;
    let corpsJournal = fragment.querySelector("[data-corps-journal]");
    let conteneurJournal = fragment.querySelector("[data-conteneur-journal]");
    let messageJournalVide = fragment.querySelector("[data-journal-vide]");
    let compteurJournal = fragment.querySelector("[data-journal-compteur]");

    if (compteurJournal) {
      compteurJournal.textContent = `${nbJournal} modification(s)`;
    }

    if (nbJournal === 0) {
      if (conteneurJournal) conteneurJournal.classList.add("hidden");
      if (messageJournalVide) messageJournalVide.classList.remove("hidden");
    } else {
      for (let j = 0; j < nbJournal; j++) {
        let entry = journal[j];
        let fragJ = htmlToFragment(
          genericRenderer(templateJournal, {
            date_formatee: formaterDateComplete(entry.date_action),
            admin_login: entry.admin_login || "Admin",
            ancien_statut: entry.ancien_statut || "-",
            nouveau_statut: entry.nouveau_statut || "-",
            commentaire: entry.commentaire || entry.action || "Mise à jour du statut",
          })
        );
        corpsJournal.appendChild(fragJ);
      }
    }

    return fragment;
  },
};

export { DetailCommandeAdminView };
