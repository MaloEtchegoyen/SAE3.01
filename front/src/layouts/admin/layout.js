import { htmlToFragment } from "../../lib/utils.js";
import { HeaderView as HeaderAdminView } from "../../ui/header-admin/index.js";
import template from "./template.html?raw";

/**
 * Layout d'administration : en-tête administrateur, puis la page affichée.
 *
 * @returns {DocumentFragment}
 */
export function AdminLayout() {
  let layout = htmlToFragment(template);
  layout.querySelector('slot[name="header"]').replaceWith(HeaderAdminView.dom());
  return layout;
}

