/**
 * Petites fonctions de mise en forme, sans dépendance.
 */

/**
 * 149 -> « 2 h 29 »
 */
export function formaterDuree(minutes) {
  let heures = Math.floor(minutes / 60);
  let restant = minutes % 60;

  if (heures === 0) {
    return `${restant} min`;
  }

  return `${heures} h ${String(restant).padStart(2, "0")}`;
}

/**
 * 8.6 -> « 8,6 » (la virgule décimale française)
 */
export function formaterNote(note) {
  return Number(note).toFixed(1).replace(".", ",");
}

/**
 * Calcule une teinte stable à partir d'une chaîne, pour donner à chaque film un
 * visuel qui lui est propre sans charger la moindre image.
 */
export function teinteDepuisTexte(texte) {
  let somme = 0;

  for (let caractere of texte) {
    somme += caractere.codePointAt(0);
  }

  return somme % 360;
}

/**
 * 12.5 -> « 12,50 € »
 *
 * @param {number|string} montant
 * @returns {string}
 */
export function formaterPrix(montant) {
  let nombre = Number(montant);
  return Number.isNaN(nombre) ? "0,00 €" : `${nombre.toFixed(2).replace(".", ",")} €`;
}

/**
 * Transforme un nom de catégorie en texte d'URL propre.
 * Exemple : « Pâtisseries » -> « patisseries »
 *
 * @param {string} texte
 * @returns {string}
 */
export function slugifier(texte) {
  if (!texte) return "";

  return String(texte)
    .toLowerCase()
    .trim()
    .replaceAll("é", "e")
    .replaceAll("è", "e")
    .replaceAll("ê", "e")
    .replaceAll("à", "a")
    .replaceAll("â", "a")
    .replaceAll("ç", "c")
    .replaceAll("ô", "o")
    .replaceAll("î", "i")
    .replaceAll("ï", "i")
    .replaceAll("ù", "u")
    .replaceAll("&", "et")
    .replaceAll(" ", "-")
    .replaceAll("'", "-");
}
