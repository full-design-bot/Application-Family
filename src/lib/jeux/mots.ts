// Pendu et « Dessine, je devine » : normalisation des mots, comme le fait
// la fonction SQL word_guess (majuscules, accents retirés).

const ACCENTS_FROM = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿ";
const ACCENTS_TO = "aaaaaaceeeeiiiinooooouuuuyy";
const ALLOWED = /^[a-zàâäáãåçéèêëíìîïñóòôöõúùûüýÿ' -]+$/;

export const MAX_WRONG = 7;

/** Majuscules sans accents (« Éléphant » → « ELEPHANT »). */
export function normalizeWord(word: string): string {
  let out = "";
  for (const ch of word.toLowerCase()) {
    const i = ACCENTS_FROM.indexOf(ch);
    out += i >= 0 ? ACCENTS_TO[i] : ch;
  }
  return out.toUpperCase();
}

/** Mot prêt à être enregistré : espaces nettoyés, en majuscules. */
export function cleanWord(word: string): string {
  return word.trim().replace(/\s+/g, " ").replace(/’/g, "'").toUpperCase();
}

/** Message d'erreur si le mot ne convient pas, sinon null. */
export function validateWord(word: string): string | null {
  const w = cleanWord(word).toLowerCase();
  if (w.length < 3) return "Au moins 3 lettres 🙂";
  if (w.length > 24) return "Un peu trop long (24 caractères max).";
  if (!ALLOWED.test(w)) return "Uniquement des lettres (accents, espaces et tirets acceptés).";
  if ((w.match(/[a-zàâäáãåçéèêëíìîïñóòôöõúùûüýÿ]/g) ?? []).length < 3) return "Au moins 3 lettres 🙂";
  return null;
}

/** Proposition de mot entier (dessin ou pendu) : correspond au mot ? */
export function sameWord(a: string, b: string): boolean {
  return normalizeWord(a.trim()) === normalizeWord(b.trim());
}

export type LetterStatus = "hit" | "miss" | "untried";

/** État d'une touche du clavier à partir du mot partiellement révélé. */
export function letterStatus(letter: string, revealed: string, tried: string[]): LetterStatus {
  const L = letter.toUpperCase();
  if (!tried.includes(L)) return "untried";
  return normalizeWord(revealed).includes(L) ? "hit" : "miss";
}

export const AZERTY: readonly string[][] = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N"],
];

/** Masque d'un mot (lettres → « _ »), comme word_init. */
export function maskWord(word: string): string {
  return [...word].map((ch) => (/[a-zA-ZàâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ]/.test(ch) ? "_" : ch)).join("");
}
