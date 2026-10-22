import { Router } from "./lib/router.js";
import { RootLayout } from "./layouts/root/layout.js";
import { AdminLayout } from "./layouts/admin/layout.js";
import { CataloguePage } from "./pages/catalogue/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { AdminProduitsPage } from "./pages/admin-produits/page.js";
import { AdminCategoriesPage } from "./pages/admin-categories/page.js";
import { AdminCommandesPage } from "./pages/admin-commandes/page.js";
import { ConnexionAdminPage } from "./pages/connexion-admin/page.js";
import { DetailProduitPage } from "./pages/detail-produit/page.js";
import { PanierPage } from "./pages/panier/page.js";
import { ValidationCommandePage } from "./pages/validation-commande/page.js";
import { ConfirmationCommandePage } from "./pages/confirmation-commande/page.js";
import { ComptePage } from "./pages/compte/page.js";
import { ConnexionPage } from "./pages/connexion/page.js";
import { The404Page } from "./pages/404/page.js";
import { AuthData } from "./data/auth.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
let router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);
router.addLayout("/admin", AdminLayout);

router.addRoute("/", CataloguePage);
router.addRoute("/categorie", CataloguePage);
router.addRoute("/categorie/:slug", CataloguePage);
router.addRoute("/produit/:slug", DetailProduitPage);
router.addRoute("/panier", PanierPage);
router.addRoute("/validation-commande", ValidationCommandePage);
router.addRoute("/confirmation-commande", ConfirmationCommandePage);
router.addRoute("/confirmation-commande/:numero", ConfirmationCommandePage);
router.addRoute("/compte", ComptePage);
router.addRoute("/commandes", ComptePage);
router.addRoute("/connexion", ConnexionPage);
router.addRoute("/connexion-admin", ConnexionAdminPage, { useLayout: false });
router.addRoute("/admin", AdminPage);
router.addRoute("/admin/produits", AdminProduitsPage);
router.addRoute("/admin/categories", AdminCategoriesPage);
router.addRoute("/admin/commandes", AdminCommandesPage);

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// Vérifier et synchroniser la session dès le démarrage de l'application
AuthData.verifierSession();

// Démarrer le routeur
router.start();
