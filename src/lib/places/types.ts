import type { PlaceCategory } from "../types";

/** Brouillon de lieu renvoyé par l'analyse d'un lien / d'un nom. */
export interface PlaceDraft {
  name: string | null;
  category: PlaceCategory;
  url: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  description: string | null;
  price_level: number | null;
}

/** Résultat de recherche par nom (OpenStreetMap). */
export interface PlaceSuggestion {
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  category: PlaceCategory | null;
}

export type InputKind = "gmaps" | "instagram" | "url" | "text" | "empty";

export interface PreviewResponse {
  kind: InputKind;
  draft: PlaceDraft;
  /** Lieux trouvés par nom quand l'adresse manque (à proposer à l'utilisateur) */
  suggestions: PlaceSuggestion[];
  /** Message à afficher si l'analyse a été partielle */
  warning: string | null;
}

export function emptyDraft(): PlaceDraft {
  return {
    name: null,
    category: "resto",
    url: null,
    instagram: null,
    address: null,
    city: null,
    lat: null,
    lng: null,
    image_url: null,
    description: null,
    price_level: null,
  };
}
