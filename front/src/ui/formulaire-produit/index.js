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
      let base = import.meta.env.BASE_URL || "/";
      let racine = base.endsWith("/") ? base : `${base}/`;

      let construireUrlImage = function (source) {
        if (!source) return "";
        if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:") || source.startsWith("blob:")) {
          return source;
        }
        let nomFichier = source.includes("/") ? source.split("/").pop() : source;
        return `${racine}api/products/image?nom=${encodeURIComponent(nomFichier)}`;
      };

      if (Array.isArray(data.produit.images) && data.produit.images.length > 0) {
        imagesSelectionnees = data.produit.images.slice(0, 4).map((img) => {
          let nom = img.url || "";
          return {
            url: construireUrlImage(nom),
            nom,
            id: img.id,
            existante: true,
          };
        });
      } else if (data.produit.image_url) {
        let nom = data.produit.image_url;
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
            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600/80 text-caption font-bold text-white hover:bg-red-600 cursor-pointer shadow-xs transition-colors";
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

    // Gestion des options personnalisables du produit (GOF-a / OPT-c)
    let conteneurOptions = form.querySelector('[data-ref="conteneur-options"]');
    let btnAjouterOption = form.querySelector('[data-action="ajouter-option"]');
    let messageOptionsVide = form.querySelector('[data-ref="message-options-vide"]');

    let optionsListe = Array.isArray(data.produit?.options)
      ? JSON.parse(JSON.stringify(data.produit.options))
      : [];

    let mettreAJourAffichageOptions = function () {
      if (!conteneurOptions) return;
      conteneurOptions.innerHTML = "";

      if (optionsListe.length === 0) {
        if (messageOptionsVide) messageOptionsVide.classList.remove("hidden");
        return;
      }

      if (messageOptionsVide) messageOptionsVide.classList.add("hidden");

      optionsListe.forEach((opt, optIndex) => {
        let carteOpt = document.createElement("div");
        carteOpt.className =
          "rounded-lg border border-white/20 bg-black/20 p-4 space-y-3 shadow-xs";

        // Ligne d'en-tête de l'option (Nom, Obligatoire, Supprimer)
        let headerOpt = document.createElement("div");
        headerOpt.className = "flex flex-wrap items-center justify-between gap-3";

        let champNomOpt = document.createElement("div");
        champNomOpt.className = "flex flex-1 min-w-[200px] flex-col gap-1";
        let labelNom = document.createElement("label");
        labelNom.className = "text-caption font-semibold text-white/90";
        labelNom.textContent = `Option n°${optIndex + 1} *`;
        let inputNom = document.createElement("input");
        inputNom.type = "text";
        inputNom.required = true;
        inputNom.placeholder = "ex. Taille, Parfum, Type de lait...";
        inputNom.value = opt.nom || "";
        inputNom.className =
          "h-9 rounded-lg border border-white/20 bg-white/10 px-3 text-caption text-white placeholder-white/40 focus:border-white focus:bg-white/20 focus:outline-none";
        inputNom.addEventListener("input", (e) => {
          opt.nom = e.target.value;
        });
        champNomOpt.appendChild(labelNom);
        champNomOpt.appendChild(inputNom);

        // Case à cocher obligatoire
        let champObligatoire = document.createElement("label");
        champObligatoire.className =
          "flex cursor-pointer items-center gap-2 text-caption font-medium text-white/90 select-none pt-4";
        let checkboxObligatoire = document.createElement("input");
        checkboxObligatoire.type = "checkbox";
        checkboxObligatoire.checked = opt.obligatoire !== false && opt.obligatoire !== 0;
        checkboxObligatoire.className = "h-4 w-4 rounded accent-brand";
        checkboxObligatoire.addEventListener("change", (e) => {
          opt.obligatoire = e.target.checked;
        });
        champObligatoire.appendChild(checkboxObligatoire);
        champObligatoire.appendChild(document.createTextNode("Choix obligatoire"));

        // Bouton supprimer option
        let btnSupprOpt = document.createElement("button");
        btnSupprOpt.type = "button";
        btnSupprOpt.className =
          "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-caption font-medium text-red-300 hover:bg-red-500/20 transition-colors mt-4";
        btnSupprOpt.textContent = "Supprimer l'option";
        btnSupprOpt.addEventListener("click", () => {
          optionsListe.splice(optIndex, 1);
          mettreAJourAffichageOptions();
        });

        headerOpt.appendChild(champNomOpt);
        headerOpt.appendChild(champObligatoire);
        headerOpt.appendChild(btnSupprOpt);
        carteOpt.appendChild(headerOpt);

        // Section valeurs possibles de l'option
        let sectionValeurs = document.createElement("div");
        sectionValeurs.className = "space-y-2 border-t border-white/10 pt-3";

        let labelVals = document.createElement("span");
        labelVals.className = "block text-caption font-medium text-white/80";
        labelVals.textContent = "Valeurs de l'option (avec surcoût éventuel) :";
        sectionValeurs.appendChild(labelVals);

        let conteneurLignesVals = document.createElement("div");
        conteneurLignesVals.className = "space-y-2";

        if (!Array.isArray(opt.valeurs)) {
          opt.valeurs = [];
        }

        opt.valeurs.forEach((val, valIndex) => {
          let ligneVal = document.createElement("div");
          ligneVal.className = "flex flex-wrap items-center gap-2";

          let inputNomVal = document.createElement("input");
          inputNomVal.type = "text";
          inputNomVal.placeholder = "Libellé (ex. Simple, Double, Vanille...)";
          inputNomVal.value = val.nom || "";
          inputNomVal.className =
            "h-8 flex-1 min-w-[150px] rounded-lg border border-white/20 bg-white/10 px-2.5 text-caption text-white placeholder-white/40 focus:border-white focus:bg-white/20 focus:outline-none";
          inputNomVal.addEventListener("input", (e) => {
            val.nom = e.target.value;
          });

          let conteneurSurcout = document.createElement("div");
          conteneurSurcout.className = "flex items-center gap-1";
          let labelSurcout = document.createElement("span");
          labelSurcout.className = "text-caption text-white/70";
          labelSurcout.textContent = "+";
          let inputSurcout = document.createElement("input");
          inputSurcout.type = "number";
          inputSurcout.step = "0.01";
          inputSurcout.min = "0";
          inputSurcout.placeholder = "0.00";
          inputSurcout.value = val.surcout !== undefined ? val.surcout : 0;
          inputSurcout.className =
            "h-8 w-20 rounded-lg border border-white/20 bg-white/10 px-2 text-caption text-white text-right placeholder-white/40 focus:border-white focus:bg-white/20 focus:outline-none";
          inputSurcout.addEventListener("input", (e) => {
            val.surcout = parseFloat(e.target.value) || 0;
          });
          let spanEuro = document.createElement("span");
          spanEuro.className = "text-caption text-white/70";
          spanEuro.textContent = "€";

          conteneurSurcout.appendChild(labelSurcout);
          conteneurSurcout.appendChild(inputSurcout);
          conteneurSurcout.appendChild(spanEuro);

          let btnSupprVal = document.createElement("button");
          btnSupprVal.type = "button";
          btnSupprVal.className =
            "flex h-7 w-7 items-center justify-center rounded-lg bg-red-600/60 text-caption font-bold text-white hover:bg-red-600 cursor-pointer transition-colors";
          btnSupprVal.title = "Supprimer cette valeur";
          btnSupprVal.innerHTML = "&times;";
          btnSupprVal.addEventListener("click", () => {
            opt.valeurs.splice(valIndex, 1);
            mettreAJourAffichageOptions();
          });

          ligneVal.appendChild(inputNomVal);
          ligneVal.appendChild(conteneurSurcout);
          ligneVal.appendChild(btnSupprVal);
          conteneurLignesVals.appendChild(ligneVal);
        });

        sectionValeurs.appendChild(conteneurLignesVals);

        let btnAjouterVal = document.createElement("button");
        btnAjouterVal.type = "button";
        btnAjouterVal.className =
          "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-caption font-medium text-white/90 hover:bg-white/10 transition-colors mt-1";
        btnAjouterVal.textContent = "+ Ajouter une valeur";
        btnAjouterVal.addEventListener("click", () => {
          opt.valeurs.push({ nom: "", surcout: 0 });
          mettreAJourAffichageOptions();
        });
        sectionValeurs.appendChild(btnAjouterVal);

        carteOpt.appendChild(sectionValeurs);
        conteneurOptions.appendChild(carteOpt);
      });
    };

    if (btnAjouterOption) {
      btnAjouterOption.addEventListener("click", () => {
        optionsListe.push({
          nom: "",
          type: "radio",
          obligatoire: true,
          valeurs: [
            { nom: "", surcout: 0 },
            { nom: "", surcout: 0 },
          ],
        });
        mettreAJourAffichageOptions();
      });
    }

    mettreAJourAffichageOptions();

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
        let premiere = imagesSelectionnees[0];
        if (premiere.existante && premiere.id) {
          imagePrincipaleId = premiere.id;
        } else if (premiere.file instanceof File) {
          imagePrincipaleIndex = fichiersImages.indexOf(premiere.file);
        }
      }

      // Nettoyage et formatage des options saisies
      let optionsNettoyees = [];
      optionsListe.forEach((opt) => {
        let nomOpt = (opt.nom || "").trim();
        if (nomOpt) {
          let vals = (opt.valeurs || [])
            .map((v) => ({
              id: v.id,
              nom: (v.nom || "").trim(),
              surcout: typeof v.surcout === "number" ? v.surcout : (parseFloat(v.surcout) || 0),
            }))
            .filter((v) => v.nom !== "");

          optionsNettoyees.push({
            id: opt.id,
            nom: nomOpt,
            type: opt.type || "radio",
            obligatoire: opt.obligatoire !== false && opt.obligatoire !== 0,
            valeurs: vals,
          });
        }
      });

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
          options: optionsNettoyees,
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

