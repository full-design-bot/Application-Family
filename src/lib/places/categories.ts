// Catégories de sorties et devinette de catégorie (logique pure, utilisable partout).
import type { PlaceCategory } from "../types";

export interface CategoryMeta {
  value: PlaceCategory;
  emoji: string;
  /** Libellé au pluriel pour les filtres */
  label: string;
  /** Libellé au singulier pour les formulaires */
  single: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { value: "resto", emoji: "🍽️", label: "Restos", single: "Resto" },
  { value: "bar", emoji: "🍸", label: "Bars", single: "Bar" },
  { value: "sortie", emoji: "🎭", label: "Sorties", single: "Sortie" },
  { value: "balade", emoji: "🏞️", label: "Balades", single: "Balade" },
  { value: "weekend", emoji: "✈️", label: "Week-ends", single: "Week-end" },
  { value: "activite", emoji: "🎡", label: "Activités enfants", single: "Activité enfants" },
  { value: "autre", emoji: "📍", label: "Autres", single: "Autre" },
];

const BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

export function categoryMeta(c: string | null | undefined): CategoryMeta {
  return BY_VALUE.get(c as PlaceCategory) ?? BY_VALUE.get("autre")!;
}

export function categoryEmoji(c: string | null | undefined): string {
  return categoryMeta(c).emoji;
}

export function isCategory(c: unknown): c is PlaceCategory {
  return typeof c === "string" && BY_VALUE.has(c as PlaceCategory);
}

/** Minuscules sans accents, pour comparer des mots-clés. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Mots-clés par catégorie (sans accents, minuscules). L'ordre sert à départager les égalités.
const KEYWORDS: [PlaceCategory, RegExp][] = [
  [
    "resto",
    /\b(restaurants?|resto|bistro|bistrot|brasserie|pizzeria|pizzas?|trattoria|creperie|burgers?|sushis?|ramen|cantine|gastronomi\w*|cuisine|menus?|chef|brunch|dejeuner|diner|food|traiteur|boulangerie|patisserie|salon de the|coffee|cafe|bouchon|grill|steakhouse|kebab|thai|indien|libanais|italien|japonais|vietnamien|oyster|huitres|fruits de mer|thefork|lafourchette|bon appetit)\b/g,
  ],
  [
    "bar",
    /\b(bars?|cocktails?|pub|bieres?|cave a vins?|bar a vins?|wine bar|rooftop|guinguette|night ?club|discotheque|speakeasy|apero|brewery|taproom|mixologie)\b/g,
  ],
  [
    "activite",
    /\b(zoo|aquarium|parc d'attractions?|parc aquatique|accrobranche|trampoline|ferme pedagogique|mini[- ]?golf|bowling|laser ?game|karting|escape ?game|ludotheque|manege|aire de jeux|jeux d'enfants|enfants?|kids?|piscine|patinoire|playground|theme park|parc animalier|cap sciences)\b/g,
  ],
  [
    "sortie",
    /\b(theatre|cinema|concerts?|musee|museum|expositions?|expo|spectacles?|festival|opera|salle de concert|comedie|stand-?up|galerie|ballet|cirque|show|soiree|billetterie)\b/g,
  ],
  [
    "balade",
    /\b(balades?|randonnee|rando|promenade|sentier|foret|parc|jardins?|plages?|lac|dune|pilat|riviere|bord de mer|piste cyclable|velo|nature|reserve naturelle|point de vue|belvedere|cascade|hiking|beach)\b/g,
  ],
  [
    "weekend",
    /\b(hotels?|gites?|chambres? d'hotes?|camping|glamping|airbnb|booking\.com|abritel|week-?ends?|sejours?|lodge|auberge|resort|thalasso|bed and breakfast|location de vacances)\b/g,
  ],
];

/**
 * Devine la catégorie à partir de textes (nom, description, type, site…).
 * Le premier texte (le nom en général) compte triple. Renvoie null si aucun indice.
 */
export function guessCategory(...texts: (string | null | undefined)[]): PlaceCategory | null {
  const parts = texts.map((t) => normalizeText(t ?? ""));
  let best: PlaceCategory | null = null;
  let bestScore = 0;
  for (const [cat, re] of KEYWORDS) {
    let score = 0;
    parts.forEach((p, i) => {
      if (!p) return;
      const n = p.match(re)?.length ?? 0;
      score += n * (i === 0 ? 3 : 1);
    });
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

// Types schema.org → catégorie
const SCHEMA_TYPES: [PlaceCategory, string[]][] = [
  ["bar", ["barorpub", "winery", "nightclub", "brewery", "distillery"]],
  ["resto", ["restaurant", "foodestablishment", "bakery", "cafeorcoffeeshop", "fastfoodrestaurant", "icecreamshop"]],
  ["weekend", ["lodgingbusiness", "hotel", "motel", "bedandbreakfast", "campground", "resort", "hostel", "vacationrental"]],
  ["activite", ["zoo", "aquarium", "amusementpark", "playground", "childcare", "sportsactivitylocation", "bowlingalley", "publicswimmingpool"]],
  ["balade", ["park", "beach", "naturalfeature", "landform", "mountain", "lakebodyofwater", "touristattraction", "hikingtrail"]],
  ["sortie", ["museum", "movietheater", "performingartstheater", "musicvenue", "eventvenue", "event", "theaterevent", "musicevent", "festival", "artgallery", "comedyevent"]],
];

export function categoryFromSchemaTypes(types: string[]): PlaceCategory | null {
  const norm = types.map((t) => t.toLowerCase().replace(/^.*[/#]/, ""));
  for (const [cat, list] of SCHEMA_TYPES) {
    if (norm.some((t) => list.includes(t))) return cat;
  }
  return null;
}

/** Tag OpenStreetMap (clé / valeur) → catégorie */
export function categoryFromOsm(key: string | null | undefined, value: string | null | undefined): PlaceCategory | null {
  const k = (key ?? "").toLowerCase();
  const v = (value ?? "").toLowerCase();
  if (k === "amenity") {
    if (["restaurant", "fast_food", "cafe", "food_court", "ice_cream", "biergarten"].includes(v)) return v === "biergarten" ? "bar" : "resto";
    if (["bar", "pub", "nightclub"].includes(v)) return "bar";
    if (["theatre", "cinema", "arts_centre", "events_venue", "concert_hall"].includes(v)) return "sortie";
  }
  if (k === "tourism") {
    if (["hotel", "guest_house", "camp_site", "chalet", "hostel", "motel", "apartment"].includes(v)) return "weekend";
    if (["zoo", "aquarium", "theme_park"].includes(v)) return "activite";
    if (["museum", "gallery"].includes(v)) return "sortie";
    if (["viewpoint", "picnic_site"].includes(v)) return "balade";
  }
  if (k === "leisure") {
    if (["park", "garden", "nature_reserve", "beach_resort"].includes(v)) return "balade";
    if (["playground", "water_park", "amusement_arcade", "trampoline_park", "miniature_golf", "bowling_alley", "ice_rink", "swimming_pool", "escape_game"].includes(v)) return "activite";
  }
  if (k === "natural" && ["beach", "wood", "water", "peak", "dune"].includes(v)) return "balade";
  if (k === "shop" && ["bakery", "pastry", "wine"].includes(v)) return v === "wine" ? "bar" : "resto";
  return null;
}
