import { htmlToFragment } from "../../lib/utils.js";
import template from "./template.html?raw";

/**
 * Vue composant pour le formulaire d'ajout d'un produit.
 */
let FormulaireProduitView = {
  /**
   * Construit le DOM du formulaire d'ajout de produit.
   *
   * @param {{
   *   categories?: Array<{ id: number, nom: string }>,
   *   produit?: {
   *     id?: number,
   *     nom?: string,
   *     prix?: number,
   *     category_id?: number|null,
   *     stock?: number,
   *     seuil_alerte?: number,
   *     description?: string|null
   *   }|null
   * }} data Données injectées dans le formulaire.
   * @param {{
   *   surSoumission: (donnees: {
   *     id?: number,
   *     nom: string,
   *     prix: number,
   *     category_id: number|null,
   *     stock: number,
   *     seuil_alerte: number,
   *     description: string|null,
   *     images?: string[],
   *     image?: string|null
   *   }) => void,
   *   surAnnulation: () => void
   * }} actions Callbacks d'interaction.
   * @returns {DocumentFragment}
   */
  dom: function (data = {}, actions = {}) {
    let fragment = htmlToFragment(template);
    let form = fragment.querySelector("form");
    let selectCategorie = fragment.querySelector('select[name="category_id"]');

    if (selectCategorie && Array.isArray(data.categories)) {
      data.categories.forEach((cat) => {
        let option = document.createElement("option");
        option.value = String(cat.id);
        option.textContent = cat.nom;
        selectCategorie.appendChild(option);
      });
    }

    let titre = fragment.querySelector('[data-ref="titre"]');
    let boutonSoumettre = fragment.querySelector('[data-ref="bouton-soumettre"]');

    if (data.produit) {
      if (titre) titre.textContent = "Modifier le produit";
      if (boutonSoumettre) boutonSoumettre.textContent = "Modifier le produit";

      if (form.nom) form.nom.value = data.produit.nom ?? "";
      if (form.prix) form.prix.value = data.produit.prix !== null && data.produit.prix !== undefined ? data.produit.prix : "";
      if (form.stock) form.stock.value = data.produit.stock !== null && data.produit.stock !== undefined ? data.produit.stock : 0;
      if (form.seuil_alerte) form.seuil_alerte.value = data.produit.seuil_alerte !== null && data.produit.seuil_alerte !== undefined ? data.produit.seuil_alerte : 5;
      if (form.description) form.description.value = data.produit.description ?? "";
      if (selectCategorie && data.produit.category_id !== null && data.produit.category_id !== undefined) {
        selectCategorie.value = String(data.produit.category_id);
      }
    }

    // Gestion du téléversement et de la prévisualisation de jusqu'à 4 images
    let inputImages = form.querySelector('input[name="images"]');
    let zoneDepot = form.querySelector('[data-ref="zone-depot"]');
    let texteDepot = form.querySelector('[data-ref="texte-depot"]');
    let compteurImages = form.querySelector('[data-ref="compteur-images"]');
    let messageVide = form.querySelector('[data-ref="message-vide"]');
    let grilleImages = form.querySelector('[data-ref="grille-images"]');

    let imagesSelectionnees = []; // Array<{ url: string, nom: string, file?: File, existante?: boolean, id?: number }>

    if (data.produit) {
      const base = import.meta.env.BASE_URL || "/";
      const racine = base.endsWith("/") ? base : `${base}/`;

      const construireUrlImage = function (source) {
        if (!source) return "";
        if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:") || source.startsWith("blob:")) {
          return source;
        }
        const nomFichier = source.includes("/") ? source.split("/").pop() : source;
        return `${racine}api/products/image?nom=${encodeURIComponent(nomFichier)}`;
      };

      if (Array.isArray(data.produit.images) && data.produit.images.length > 0) {
        imagesSelectionnees = data.produit.images.slice(0, 4).map((img) => {
          const nom = img.url || "";
          return {
            url: construireUrlImage(nom),
            nom,
            id: img.id,
            existante: true,
          };
        });
      } else if (data.produit.image_url) {
        const nom = data.produit.image_url;
        imagesSelectionnees = [
          {
            url: construireUrlImage(nom),
            nom,
            existante: true,
          },
        ];
      }
    }

    let mettreAJourAffichage = function () {
      let nb = imagesSelectionnees.length;
      if (compteurImages) {
        compteurImages.textContent = `${nb} / 4 image(s)`;
      }

      if (texteDepot) {
        if (nb >= 4) {
          texteDepot.textContent = "Limite de 4 images atteinte";
        } else {
          texteDepot.textContent = "Cliquez ou glissez jusqu'à 4 images";
        }
      }

      if (zoneDepot) {
        if (nb >= 4) {
          zoneDepot.classList.add("opacity-50", "pointer-events-none");
        } else {
          zoneDepot.classList.remove("opacity-50", "pointer-events-none");
        }
      }

      if (nb === 0) {
        if (messageVide) messageVide.classList.remove("hidden");
        if (grilleImages) {
          grilleImages.classList.add("hidden");
          grilleImages.classList.remove("grid");
          grilleImages.innerHTML = "";
        }
        return;
      }

      if (messageVide) messageVide.classList.add("hidden");
      if (grilleImages) {
        grilleImages.classList.remove("hidden");
        grilleImages.classList.add("grid");
        grilleImages.innerHTML = "";

        imagesSelectionnees.forEach((img, index) => {
          let vignette = document.createElement("div");
          vignette.className =
            "relative flex flex-col items-center rounded-lg border border-white/20 bg-black/25 p-1.5 shadow-xs";

          let imageEl = document.createElement("img");
          imageEl.src = img.url;
          imageEl.alt = img.nom;
          imageEl.className = "h-20 w-full rounded object-cover";
          vignette.appendChild(imageEl);

          // Badge ou bouton principale
          if (index === 0) {
            let badge = document.createElement("span");
            badge.className =
              "absolute top-2.5 left-2.5 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-xs";
            badge.textContent = "Principale";
            vignette.appendChild(badge);
          } else {
            let btnDefinirPrinc = document.createElement("button");
            btnDefinirPrinc.type = "button";
            btnDefinirPrinc.className =
              "absolute top-2.5 left-2.5 cursor-pointer rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 hover:bg-black/90 transition-colors";
            btnDefinirPrinc.title = "Définir comme image principale";
            btnDefinirPrinc.textContent = "Principale";
            btnDefinirPrinc.addEventListener("click", () => {
              let element = imagesSelectionnees.splice(index, 1)[0];
              imagesSelectionnees.unshift(element);
              mettreAJourAffichage();
            });
            vignette.appendChild(btnDefinirPrinc);
          }

          // Bouton supprimer l'image
          let btnSuppr = document.createElement("button");
          btnSuppr.type = "button";
          btnSuppr.className =
            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600/80 text-xs font-bold text-white hover:bg-red-600 cursor-pointer shadow-xs transition-colors";
          btnSuppr.title = "Retirer cette image";
          btnSuppr.innerHTML = "&times;";
          btnSuppr.addEventListener("click", () => {
            imagesSelectionnees.splice(index, 1);
            if (inputImages) inputImages.value = "";
            mettreAJourAffichage();
          });
          vignette.appendChild(btnSuppr);

          // Nom de fichier
          let labelNom = document.createElement("span");
          labelNom.className = "mt-1 w-full truncate px-1 text-center text-[10px] text-white/80";
          labelNom.title = img.nom;
          labelNom.textContent = img.nom;
          vignette.appendChild(labelNom);

          grilleImages.appendChild(vignette);
        });
      }
    };

    // Affichage initial des images pré-existantes éventuelles
    mettreAJourAffichage();

    let traiterFichiers = function (fichiers) {
      if (!fichiers || fichiers.length === 0) return;

      let restants = 4 - imagesSelectionnees.length;
      if (restants <= 0) return;

      let fichiersACharger = Array.from(fichiers)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, restants);

      let promesses = fichiersACharger.map((file) => {
        return new Promise((resolve) => {
          let reader = new FileReader();
          reader.onload = function (e) {
            resolve({
              url: e.target.result,
              nom: file.name,
              file: file,
            });
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promesses).then((nouvellesImages) => {
        imagesSelectionnees = imagesSelectionnees.concat(nouvellesImages).slice(0, 4);
        mettreAJourAffichage();
      });
    };

    let reinitialiserImages = function () {
      imagesSelectionnees = [];
      if (inputImages) inputImages.value = "";
      mettreAJourAffichage();
    };

    if (inputImages) {
      inputImages.addEventListener("change", (ev) => {
        traiterFichiers(ev.target.files);
      });
    }

    if (zoneDepot) {
      zoneDepot.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        if (imagesSelectionnees.length < 4) {
          zoneDepot.classList.add("border-white", "bg-white/15");
        }
      });
      zoneDepot.addEventListener("dragleave", () => {
        zoneDepot.classList.remove("border-white", "bg-white/15");
      });
      zoneDepot.addEventListener("drop", (ev) => {
        ev.preventDefault();
        zoneDepot.classList.remove("border-white", "bg-white/15");
        if (ev.dataTransfer?.files) {
          traiterFichiers(ev.dataTransfer.files);
        }
      });
    }

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();

      let nom = form.nom.value.trim();
      let prix = parseFloat(form.prix.value);
      let categoryId = form.category_id.value ? parseInt(form.category_id.value, 10) : null;
      let stock = form.stock.value !== "" ? parseInt(form.stock.value, 10) : 0;
      let seuilAlerte = form.seuil_alerte.value !== "" ? parseInt(form.seuil_alerte.value, 10) : 5;
      let description = form.description.value.trim() || null;

      if (!nom) {
        form.nom.focus();
        return;
      }

      if (isNaN(prix) || prix < 0) {
        form.prix.focus();
        return;
      }

      let urlsImages = imagesSelectionnees.map((img) => img.url);
      let fichiersImages = imagesSelectionnees
        .map((img) => img.file)
        .filter((f) => f instanceof File);

      let imagesConserveesIds = imagesSelectionnees
        .filter((img) => img.existante && img.id)
        .map((img) => img.id);

      let imagePrincipaleId = null;
      let imagePrincipaleIndex = -1;

      if (imagesSelectionnees.length > 0) {
        const premiere = imagesSelectionnees[0];
        if (premiere.existante && premiere.id) {
          imagePrincipaleId = premiere.id;
        } else if (premiere.file instanceof File) {
          imagePrincipaleIndex = fichiersImages.indexOf(premiere.file);
        }
      }

      if (typeof actions.surSoumission === "function") {
        actions.surSoumission({
          id: data.produit?.id,
          nom,
          prix,
          category_id: categoryId,
          stock,
          seuil_alerte: seuilAlerte,
          description,
          images: urlsImages,
          image: urlsImages.length > 0 ? urlsImages[0] : null,
          fichiers: fichiersImages,
          images_conservees_ids: imagesConserveesIds,
          image_principale_id: imagePrincipaleId,
          image_principale_index: imagePrincipaleIndex,
        });
      }
    });

    let btnAnnuler = fragment.querySelector('[data-action="annuler"]');
    if (btnAnnuler && typeof actions.surAnnulation === "function") {
      btnAnnuler.addEventListener("click", () => {
        reinitialiserImages();
        actions.surAnnulation();
      });
    }

    return fragment;
  },
};

export { FormulaireProduitView };

