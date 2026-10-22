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
