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
   * Ajoute un produit (et son éventuelle variante) au panier.
   * Si l'article existe déjà (même produit + même variante), incrémente la quantité.
   *
   * @param {{
   *   produit: object,
   *   quantite?: number,
   *   variante?: object|null
   * }} params
   * @returns {Array<object>} Le nouveau panier
   */
  ajouterArticle({ produit, quantite = 1, variante = null }) {
    if (!produit?.id) return lireStockage();

    let articles = lireStockage();
    let cle = variante?.id ? `${produit.id}_${variante.id}` : `${produit.id}_base`;
    let existant = articles.find((item) => item.cle === cle);

    let prix = Number(variante?.prix ?? produit.prix ?? 0);
    let stock = Number(variante?.stock ?? produit.stock ?? 99);
    let qte = Math.max(1, Number(quantite || 1));

    if (existant) {
      existant.quantite = stock > 0 ? Math.min(existant.quantite + qte, stock) : existant.quantite + qte;
    } else {
      articles.push({
        cle,
        produitId: produit.id,
        varianteId: variante?.id ?? null,
        nom: produit.nom || "Produit",
        nomVariante: variante?.nom ? String(variante.nom) : null,
        prix,
        image: produit.image_url || produit.imageUrl || produit.image || produit.images?.[0]?.url || null,
        quantite: stock > 0 ? Math.min(qte, stock) : qte,
        stockMax: stock > 0 ? stock : 99,
        slug: produit.slug || String(produit.id),
      });
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
