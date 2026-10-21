import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Vue formulaire pour la création ou l'édition d'une catégorie.
 */
let FormulaireCategorieView = {
  /**
   * @param {{
   *   categorieEnEdition?: { id: number, nom: string, description?: string }|null
   * }} data
   * @param {{
   *   onEnregistrer?: (donnees: { id?: number, nom: string, description: string }) => void,
   *   onAnnuler?: () => void
   * }} actions
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(template);
    let categorie = data.categorieEnEdition || null;

    let titreEl = fragment.querySelector('[data-ref="titre"]');
    let champNom = fragment.querySelector('input[name="nom"]');
    let champDescription = fragment.querySelector('textarea[name="description"]');
    let erreurNom = fragment.querySelector('[data-ref="erreur-nom"]');
    let formEl = fragment.querySelector("form");
    let btnAnnuler = fragment.querySelector('[data-action="annuler"]');
    let btnSoumettre = fragment.querySelector('[data-action="soumettre"]');

    if (categorie) {
      if (titreEl) titreEl.textContent = `Modifier la catégorie « ${categorie.nom} »`;
      if (btnSoumettre) btnSoumettre.textContent = "Mettre à jour la catégorie";
      if (champNom) champNom.value = categorie.nom || "";
      if (champDescription) champDescription.value = categorie.description || "";
    } else {
      if (titreEl) titreEl.textContent = "Nouvelle catégorie";
      if (btnSoumettre) btnSoumettre.textContent = "Créer la catégorie";
    }

    if (btnAnnuler && typeof actions.onAnnuler === "function") {
      btnAnnuler.addEventListener("click", () => actions.onAnnuler());
    }

    if (formEl && typeof actions.onEnregistrer === "function") {
      formEl.addEventListener("submit", (e) => {
        e.preventDefault();

        let nom = (champNom?.value || "").trim();
        let description = (champDescription?.value || "").trim();

        if (erreurNom) {
          erreurNom.classList.add("hidden");
          erreurNom.textContent = "";
        }

        if (nom === "") {
          if (erreurNom) {
            erreurNom.textContent = "Le nom de la catégorie est obligatoire.";
            erreurNom.classList.remove("hidden");
          }
          champNom?.focus();
          return;
        }

        if (nom.length < 2) {
          if (erreurNom) {
            erreurNom.textContent = "Le nom doit comporter au moins 2 caractères.";
            erreurNom.classList.remove("hidden");
          }
          champNom?.focus();
          return;
        }

        actions.onEnregistrer({
          id: categorie ? categorie.id : undefined,
          nom,
          description,
        });
      });
    }

    return fragment;
  },
};

export { FormulaireCategorieView };

