/**
 * Module de données CartData.
 *
 * Gère la persistance locale du panier d'achat (localStorage), les calculs de totaux
 * et fournit un mécanisme d'abonnement (sans jamais toucher au DOM conformément au MVC).
 */

const CLE_STOCKAGE = "cafe_feuillette_panier";
let auditeurs = [];

/**
 * Lit les articles stockés dans le stockage local du navigateur.
 *
 * @returns {Array<object>}
 */
function lireStockage() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || [];
  } catch {
    return [];
  }
}

function roundPrix(valeur) {
  return Math.round(Number(valeur || 0) * 100) / 100;
}

/**
 * Écrit la liste des articles dans le stockage local du navigateur et notifie les auditeurs.
 *
 * @param {Array<object>} articles
 */
function ecrireStockage(articles) {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(articles));
  } catch {
    // Échec d'écriture localStorage (ex: quota ou navigation privée stricte)
  }
  auditeurs.forEach((callback) => {
    try {
      callback();
    } catch {}
  });
}

let CartData = {
  /**
   * S'abonne aux modifications du panier.
   *
   * @param {() => void} callback
   * @returns {() => void} Fonction de désabonnement
   */
  abonner(callback) {
    if (typeof callback === "function") {
      auditeurs.push(callback);
    }
    return () => {
      auditeurs = auditeurs.filter((cb) => cb !== callback);
    };
  },

  /**
   * Récupère la liste complète des articles du panier.
   *
   * @returns {Array<object>}
   */
  obtenirArticles() {
    return lireStockage();
  },

  /**
   * Ajoute un produit (et son éventuelle variante ou ses options choisies) au panier.
   * Si l'article existe déjà (même produit + même variante + mêmes options), incrémente la quantité.
   *
   * @param {{
   *   produit: object,
   *   quantite?: number,
   *   variante?: object|null,
   *   options?: Array<{ optionId: number, optionNom: string, valeurId: number, valeurNom: string, surcout: number }>
   * }} params
   * @returns {Array<object>} Le nouveau panier
   */
  ajouterArticle({ produit, quantite = 1, variante = null, options = [] }) {
    if (!produit?.id) return lireStockage();

    let articles = lireStockage();

    // Construction d'une clé d'unicité tenant compte des options ou de la variante
    let cle = `${produit.id}_base`;
    let surcoutOptions = 0;
    let nomOptions = null;

    if (variante?.id) {
      cle = `${produit.id}_var_${variante.id}`;
      nomOptions = variante.nom ? String(variante.nom) : null;
    } else if (Array.isArray(options) && options.length > 0) {
      let idsOptions = options
        .map((o) => `${o.optionId}:${o.valeurId}`)
        .sort()
        .join("_");
      cle = `${produit.id}_opt_${idsOptions}`;
      nomOptions = options.map((o) => o.valeurNom).join(", ");
      options.forEach((o) => {
        surcoutOptions += Number(o.surcout || 0);
      });
    }

    let existant = articles.find((item) => item.cle === cle);

    let prixFinal = Number(
      variante?.prix !== undefined
        ? Number(variante.prix)
        : roundPrix(Number(produit.prix ?? 0) + surcoutOptions)
    );
    let stock = Number(
      variante?.stock !== undefined ? Number(variante.stock) : Number(produit.stock ?? 99)
    );
    let qte = Math.max(1, Number(quantite || 1));

    let libelleVariante = nomOptions || (variante?.nom ? String(variante.nom) : null);

    if (existant) {
      existant.stockMax = stock > 0 ? stock : 0;
      existant.quantite = stock > 0 ? Math.min(existant.quantite + qte, stock) : existant.quantite + qte;
    } else {
      articles.push({
        cle,
        produitId: produit.id,
        varianteId: variante?.id ?? null,
        options: Array.isArray(options) ? options : [],
        nom: produit.nom || "Produit",
        nomVariante: libelleVariante,
        prix: prixFinal,
        image: produit.image_url || produit.imageUrl || produit.image || produit.images?.[0]?.url || null,
        quantite: stock > 0 ? Math.min(qte, stock) : qte,
        stockMax: stock > 0 ? stock : 0,
        slug: produit.slug || String(produit.id),
      });
    }

    ecrireStockage(articles);
    return articles;
  },

  /**
   * Modifie les options ou la variante d'un article existant dans le panier.
   * Si la nouvelle combinaison correspond à un autre article déjà présent, fusionne les lignes.
   *
   * @param {string} ancienneCle
   * @param {{
   *   produit: object,
   *   variante?: object|null,
   *   options?: Array<{ optionId: number, optionNom: string, valeurId: number, valeurNom: string, surcout: number }>
   * }} params
   * @returns {Array<object>} Le nouveau panier
   */
  modifierOptionsArticle(ancienneCle, { produit, variante = null, options = [] }) {
    if (!ancienneCle || !produit?.id) return lireStockage();

    let articles = lireStockage();
    let indexArticle = articles.findIndex((item) => item.cle === ancienneCle);
    if (indexArticle === -1) return articles;

    let articleCourant = articles[indexArticle];

    // Construction d'une clé d'unicité tenant compte des options ou de la variante
    let nouvelleCle = `${produit.id}_base`;
    let surcoutOptions = 0;
    let nomOptions = null;

    if (variante?.id) {
      nouvelleCle = `${produit.id}_var_${variante.id}`;
      nomOptions = variante.nom ? String(variante.nom) : null;
    } else if (Array.isArray(options) && options.length > 0) {
      let idsOptions = options
        .map((o) => `${o.optionId}:${o.valeurId}`)
        .sort()
        .join("_");
      nouvelleCle = `${produit.id}_opt_${idsOptions}`;
      nomOptions = options.map((o) => o.valeurNom).join(", ");
      options.forEach((o) => {
        surcoutOptions += Number(o.surcout || 0);
      });
    }

    let prixFinal = Number(
      variante?.prix !== undefined
        ? Number(variante.prix)
        : roundPrix(Number(produit.prix ?? 0) + surcoutOptions)
    );
    let stock = Number(
      variante?.stock !== undefined ? Number(variante.stock) : Number(produit.stock ?? 99)
    );
    let stockMax = stock > 0 ? stock : 0;
    let libelleVariante = nomOptions || (variante?.nom ? String(variante.nom) : null);

    if (nouvelleCle === ancienneCle) {
      // Même clé : simple mise à jour des métadonnées
      articleCourant.prix = prixFinal;
      articleCourant.stockMax = stockMax;
      articleCourant.quantite = stockMax > 0 ? Math.min(articleCourant.quantite, stockMax) : articleCourant.quantite;
      articleCourant.nomVariante = libelleVariante;
      articleCourant.options = Array.isArray(options) ? options : [];
      articleCourant.varianteId = variante?.id ?? null;
    } else {
      // Nouvelle clé différente
      let existantAutre = articles.find((item) => item.cle === nouvelleCle);
      if (existantAutre) {
        // Fusionner avec la ligne existante et retirer l'ancienne
        let qteCombinee = existantAutre.quantite + articleCourant.quantite;
        existantAutre.stockMax = stockMax;
        existantAutre.quantite = stockMax > 0 ? Math.min(qteCombinee, stockMax) : qteCombinee;
        articles.splice(indexArticle, 1);
      } else {
        // Remplacement de la ligne sur place
        articleCourant.cle = nouvelleCle;
        articleCourant.varianteId = variante?.id ?? null;
        articleCourant.options = Array.isArray(options) ? options : [];
        articleCourant.nomVariante = libelleVariante;
        articleCourant.prix = prixFinal;
        articleCourant.stockMax = stockMax;
        articleCourant.quantite = stockMax > 0 ? Math.min(articleCourant.quantite, stockMax) : articleCourant.quantite;
      }
    }

    ecrireStockage(articles);
    return articles;
  },

  /**
   * Modifie la quantité d'un article du panier repéré par sa clé unique.
   * Si la quantité demandée est <= 0, l'article est supprimé.
   *
   * @param {string} cle
   * @param {number} nouvelleQuantite
   * @returns {Array<object>} Le nouveau panier
   */
  modifierQuantite(cle, nouvelleQuantite) {
    let qte = Number(nouvelleQuantite);
    if (qte <= 0) return CartData.supprimerArticle(cle);

    let articles = lireStockage();
    let article = articles.find((item) => item.cle === cle);
    if (article) {
      let max = article.stockMax > 0 ? article.stockMax : 99;
      article.quantite = Math.min(Math.max(1, qte), max);
      ecrireStockage(articles);
    }
    return articles;
  },

  /**
   * Supprime un article du panier selon sa clé.
   *
   * @param {string} cle
   * @returns {Array<object>} Le nouveau panier
   */
  supprimerArticle(cle) {
    let articles = lireStockage().filter((item) => item.cle !== cle);
    ecrireStockage(articles);
    return articles;
  },

  /**
   * Vide intégralement le panier.
   */
  viderPanier() {
    ecrireStockage([]);
  },

  /**
   * Compte le nombre total d'articles (somme des quantités).
   *
   * @returns {number}
   */
  compterArticles() {
    return lireStockage().reduce((total, item) => total + Number(item.quantite || 0), 0);
  },

  /**
   * Calcule le montant total du panier en euros.
   *
   * @returns {number}
   */
  calculerTotal() {
    return lireStockage().reduce(
      (total, item) => total + Number(item.prix || 0) * Number(item.quantite || 0),
      0
    );
  },
};

export { CartData };
