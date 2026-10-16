import { Router } from "./lib/router.js";
import { RootLayout } from "./layouts/root/layout.js";
import { AdminLayout } from "./layouts/admin/layout.js";
import { CataloguePage } from "./pages/catalogue/page.js";
import { AdminPage } from "./pages/admin/page.js";
import { AdminProduitsPage } from "./pages/admin-produits/page.js";
import { ConnexionAdminPage } from "./pages/connexion-admin/page.js";
import { The404Page } from "./pages/404/page.js";

// base : chemin du projet sur le serveur (BASE dans vite.config.js).
const router = new Router("app", { base: import.meta.env.BASE_URL });

router.addLayout("/", RootLayout);
router.addLayout("/admin", AdminLayout);

router.addRoute("/", CataloguePage);
router.addRoute("/connexion-admin", ConnexionAdminPage, { useLayout: false });
router.addRoute("/admin", AdminPage);
router.addRoute("/admin/produits", AdminProduitsPage);

// En dernier : toute adresse qui ne correspond à aucune route.
router.addRoute("*", The404Page);

// Démarrer le routeur
router.start();
