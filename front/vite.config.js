import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Chemin du projet sur le serveur, avec la barre finale. Il doit être
// identique à « chemin » dans back/config/config.php.
const BASE = "/~etchegoyen3/Base/";

// Serveur qui héberge l'API.
const SERVEUR = "https://mmi.unilim.fr";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pluginUploadsLocal() {
  return {
    name: "serveur-uploads-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const marqueurUpload = BASE + "uploads/produits/";
        const marqueurApiImage = BASE + "api/products/image";

        let nomFichier = null;

        if (url.startsWith(marqueurUpload)) {
          nomFichier = decodeURIComponent(url.slice(marqueurUpload.length).split("?")[0]);
        } else if (url.startsWith(marqueurApiImage)) {
          const parsed = new URL(url, "http://localhost");
          nomFichier = parsed.searchParams.get("nom");
        }

        if (nomFichier) {
          nomFichier = path.basename(nomFichier);
          const cheminsPossibles = [
            path.resolve(__dirname, "../uploads/produits", nomFichier),
            path.resolve(__dirname, "assets/produits", nomFichier),
            path.resolve(__dirname, "../uploads", nomFichier),
          ];

          for (let i = 0; i < cheminsPossibles.length; i++) {
            const candidat = cheminsPossibles[i];
            if (fs.existsSync(candidat) && fs.statSync(candidat).isFile()) {
              const ext = path.extname(candidat).toLowerCase();
              const mimes = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
              };
              res.setHeader("Content-Type", mimes[ext] || "application/octet-stream");
              res.setHeader("Cache-Control", "no-cache");
              fs.createReadStream(candidat).pipe(res);
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // Toutes les adresses de l'application commencent par BASE : celles des
  // fichiers produits par le build, et celles que gère le routeur
  // (import.meta.env.BASE_URL, voir src/main.js).
  base: BASE,

  plugins: [tailwindcss(), pluginUploadsLocal()],

  // En développement (npm run dev), le front est servi par Vite sur
  // http://localhost:5173/~votre_login/Base/ et les requêtes vers
  // /~votre_login/Base/api/... sont relayées vers le serveur. Pour le
  // navigateur, front et API ont donc la même origine et le même chemin
  // qu'en production : les cookies de l'API (préférences, session) sont
  // acceptés et renvoyés comme sur le serveur.
  server: {
    proxy: {
      [BASE + "api"]: { target: SERVEUR, changeOrigin: true },
      [BASE + "uploads"]: { target: SERVEUR, changeOrigin: true },
    },
  },

  build: {
    target: "esnext",
  },
});
