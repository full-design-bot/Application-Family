import { describe, expect, it } from "vitest";
import { categoryFromOsm, categoryFromSchemaTypes, guessCategory } from "./categories";
import { dedupeSuggestions, normalizeNominatim, normalizePhoton } from "./geo";
import { isForbiddenHostname, isPrivateAddress } from "./ip";
import { agendaUrl, appleMapsUrl, cleanInstagramHandle, parseTags, ratingsAgreement } from "./links";

describe("catégories", () => {
  it("devine depuis les mots-clés", () => {
    expect(guessCategory("Le Bar à Vins")).toBe("bar");
    expect(guessCategory("Pizzeria Da Mario")).toBe("resto");
    expect(guessCategory("Bistrot du coin", "menu enfants, terrasse")).toBe("resto");
    expect(guessCategory("Zoo de Pessac")).toBe("activite");
    expect(guessCategory("Dune du Pilat")).toBe("balade");
    expect(guessCategory("Gîte au Cap Ferret", "séjour en famille")).toBe("weekend");
    expect(guessCategory("Théâtre Fémina")).toBe("sortie");
    expect(guessCategory("Truc")).toBeNull();
  });

  it("types schema.org et OSM", () => {
    expect(categoryFromSchemaTypes(["BarOrPub"])).toBe("bar");
    expect(categoryFromSchemaTypes(["http://schema.org/Restaurant"])).toBe("resto");
    expect(categoryFromSchemaTypes(["WebPage"])).toBeNull();
    expect(categoryFromOsm("amenity", "restaurant")).toBe("resto");
    expect(categoryFromOsm("amenity", "pub")).toBe("bar");
    expect(categoryFromOsm("tourism", "zoo")).toBe("activite");
    expect(categoryFromOsm("leisure", "park")).toBe("balade");
    expect(categoryFromOsm("highway", "residential")).toBeNull();
  });
});

describe("normalisation OSM", () => {
  it("Nominatim", () => {
    const r = normalizeNominatim({
      lat: "44.8402405",
      lon: "-0.5712429",
      category: "amenity",
      type: "restaurant",
      name: "Le Petit Commerce",
      display_name: "Le Petit Commerce, 22, Rue du Parlement Saint-Pierre, Bordeaux, Gironde, France",
      address: { house_number: "22", road: "Rue du Parlement Saint-Pierre", city: "Bordeaux", postcode: "33000" },
    });
    expect(r).toEqual({
      name: "Le Petit Commerce",
      address: "22 Rue du Parlement Saint-Pierre, 33000 Bordeaux",
      city: "Bordeaux",
      lat: 44.8402405,
      lng: -0.5712429,
      category: "resto",
    });
    expect(normalizeNominatim({ name: "x" })).toBeNull();
  });

  it("Photon", () => {
    const r = normalizePhoton({
      type: "Feature",
      properties: { osm_key: "amenity", osm_value: "bar", name: "Le Café Pompier", housenumber: "7", street: "Place Renaudel", city: "Bordeaux", postcode: "33800" },
      geometry: { type: "Point", coordinates: [-0.5615, 44.8264] },
    });
    expect(r).toEqual({ name: "Le Café Pompier", address: "7 Place Renaudel, 33800 Bordeaux", city: "Bordeaux", lat: 44.8264, lng: -0.5615, category: "bar" });
  });

  it("dédoublonne", () => {
    const a = { name: "X", address: null, city: null, lat: 44.8, lng: -0.5, category: null };
    expect(dedupeSuggestions([a, { ...a, lat: 44.8001 }, { ...a, name: "Y" }])).toHaveLength(2);
  });
});

describe("anti-SSRF", () => {
  it("IPv4 privées et publiques", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "142.250.75.238", "172.32.0.1", "93.184.216.34"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("IPv6", () => {
    for (const ip of ["::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "[::1]", "64:ff9b::a9fe:a9fe", "ff02::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["2a00:1450:4007:80e::200e", "2606:4700::6810:84e5", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
    expect(isPrivateAddress("pas-une-ip")).toBe(true);
  });

  it("noms d'hôtes internes", () => {
    for (const h of ["localhost", "api.localhost", "printer.local", "db", "2130706433", "0x7f.1", "0177.0.0.1", "metadata.google.internal"]) {
      expect(isForbiddenHostname(h), h).toBe(true);
    }
    for (const h of ["www.chezjanou.fr", "maps.app.goo.gl", "8.8.8.8"]) {
      expect(isForbiddenHostname(h), h).toBe(false);
    }
  });
});

describe("liens et notes", () => {
  const place = { name: "Chez Janou", address: "12 rue X", city: "Bordeaux", lat: 44.84, lng: -0.57, category: "resto" as const, space: "couple" as const };

  it("Plans et agenda", () => {
    expect(appleMapsUrl(place)).toBe("https://maps.apple.com/?q=Chez+Janou%2C+12+rue+X%2C+Bordeaux&ll=44.84%2C-0.57");
    const u = new URL(agendaUrl(place), "https://app.test");
    expect(u.pathname).toBe("/agenda/nouveau");
    expect(Object.fromEntries(u.searchParams)).toEqual({ titre: "Chez Janou", lieu: "12 rue X, Bordeaux", emoji: "🍽️", space: "couple" });
  });

  it("accord des notes", () => {
    expect(ratingsAgreement({ a: 4, b: 5 }, ["a", "b"])).toBe("agree");
    expect(ratingsAgreement({ a: 1, b: 5 }, ["a", "b"])).toBe("disagree");
    expect(ratingsAgreement({ a: 4 }, ["a", "b"])).toBeNull();
  });

  it("tags et instagram", () => {
    expect(parseTags("Terrasse, enfants ok; terrasse #brunch")).toEqual(["terrasse", "enfants ok", "brunch"]);
    expect(cleanInstagramHandle("@Chez.Janou")).toBe("chez.janou");
    expect(cleanInstagramHandle("https://www.instagram.com/chezjanou/?hl=fr")).toBe("chezjanou");
    expect(cleanInstagramHandle("pas un compte !")).toBeNull();
  });
});
