import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

// HeaderView est un composant sans données : il n'a que son template statique.
let HeaderView = {
  html: function () {
    return template;
  },

  dom: function () {
    return htmlToFragment(template);
  },
};

export { HeaderView };
