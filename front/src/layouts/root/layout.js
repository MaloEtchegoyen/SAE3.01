import { htmlToFragment } from "../../lib/utils.js";
import { HeaderView } from "../../ui/header/index.js";
import { CartData } from "../../data/cart.js";
import { AuthData } from "../../data/auth.js";
import { navigate } from "../../lib/router.js";
import template from "./template.html?raw";

// Variables pour mémoriser les désabonnements et éviter les fuites
let desabonnementPanier = null;
let desabonnementAuth = null;

function rafraichirHeader() {
  let headerActuel = document.querySelector("header");
  if (!headerActuel) return;

  let utilisateur = AuthData.obtenirUtilisateur();
  let nouveauHeader = HeaderView.dom(
    {
      nbArticles: CartData.compterArticles(),
      connecte: utilisateur.connecte,
      utilisateur: utilisateur.utilisateur,
    },
    {
      onLogout: async () => {
        await AuthData.logout();
        navigate("/");
      },
    }
  );

  headerActuel.replaceWith(nouveauHeader);
}

/**
 * Layout principal : l'en-tête, puis la page affichée.
 *
 * Le slot nommé « header » est remplacé ici. Le slot sans nom est laissé au
 * routeur, qui y place la page.
 *
 * @returns {DocumentFragment}
 */
export function RootLayout() {
  let layout = htmlToFragment(template);
  let utilisateur = AuthData.obtenirUtilisateur();

  layout.querySelector('slot[name="header"]').replaceWith(
    HeaderView.dom(
      {
        nbArticles: CartData.compterArticles(),
        connecte: utilisateur.connecte,
        utilisateur: utilisateur.utilisateur,
      },
      {
        onLogout: async () => {
          await AuthData.logout();
          navigate("/");
        },
      }
    )
  );

  if (typeof desabonnementPanier === "function") {
    desabonnementPanier();
  }
  desabonnementPanier = CartData.abonner(() => {
    rafraichirHeader();
  });

  if (typeof desabonnementAuth === "function") {
    desabonnementAuth();
  }
  desabonnementAuth = AuthData.abonner(() => {
    rafraichirHeader();
  });

  return layout;
}
