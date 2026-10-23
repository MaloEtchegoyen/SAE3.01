import { genericRenderer, htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// Les classes sont écrites en entier, et non assemblées (« text-" + couleur ») :
// Tailwind ne génère que les classes qu'il trouve telles quelles dans le code.
const COULEURS = {
  erreur: "border-red-700 text-red-700 dark:border-red-400 dark:text-red-400",
  succes: "border-green-700 text-green-700 dark:border-green-400 dark:text-green-400",
  avertissement: "border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400",
  info: "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400",
  "admin-erreur": "!mb-0 bg-brand text-white border-white/20 rounded-lg shadow-xs",
};

// Message d'information ou d'erreur. data vaut { type: "erreur" | "succes",
// texte }, ou null pour n'afficher aucun message.
let MessageView = {
  html: function (data) {
    if (data === null) {
      return "";
    }
    return genericRenderer(template, { texte: data.texte, couleurs: COULEURS[data.type] || COULEURS.info });
  },

  dom: function (data) {
    return htmlToFragment(MessageView.html(data));
  },
};

export { MessageView };
