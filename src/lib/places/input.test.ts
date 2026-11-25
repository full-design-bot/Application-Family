import { describe, expect, it } from "vitest";
import {
  classifyInput,
  extractFirstUrl,
  findGoogleMapsUrlInHtml,
  isGoogleMapsUrl,
  isGoogleShortUrl,
  nameFromUrl,
  parseAppleMapsUrl,
  parseGoogleMapsUrl,
  parseInstagramHandle,
  parseInstagramUrl,
  splitNameAddress,
} from "./input";

describe("classifyInput", () => {
  it("reconnaît un lien court Google Maps, même entouré de texte", () => {
    const c = classifyInput("Chez Janou\nhttps://maps.app.goo.gl/AbC123xyz");
    expect(c).toEqual({ kind: "gmaps", url: "https://maps.app.goo.gl/AbC123xyz", text: "Chez Janou" });
  });

  it("reconnaît un lien Google Maps long", () => {
    const c = classifyInput("https://www.google.com/maps/place/Le+Petit+Commerce/@44.84,-0.57,17z");
    expect(c.kind).toBe("gmaps");
  });

  it("reconnaît un lien Instagram de compte et de publication", () => {
    expect(classifyInput("https://www.instagram.com/chezjanou/")).toMatchObject({ kind: "instagram", account: "chezjanou", shortcode: null });
    expect(classifyInput("https://www.instagram.com/p/DgHdm3_F4Af/?igsh=abc")).toMatchObject({ kind: "instagram", account: null, shortcode: "DgHdm3_F4Af" });
    expect(classifyInput("instagram.com/chez.janou")).toMatchObject({ kind: "instagram", account: "chez.janou" });
  });

  it("reconnaît un @compte ou « compte insta »", () => {
    expect(classifyInput("@ChezJanou")).toMatchObject({ kind: "instagram", account: "chezjanou" });
    expect(classifyInput("chezjanou insta")).toMatchObject({ kind: "instagram", account: "chezjanou" });
    expect(classifyInput("insta : @le_petit_commerce")).toMatchObject({ kind: "instagram", account: "le_petit_commerce" });
  });

  it("autre lien", () => {
    expect(classifyInput("Regarde ça https://www.thefork.fr/restaurant/chez-janou-r12345 !")).toEqual({
      kind: "url",
      url: "https://www.thefork.fr/restaurant/chez-janou-r12345",
      text: "Regarde ça !",
    });
    expect(classifyInput("www.chezjanou.fr")).toMatchObject({ kind: "url", url: "https://www.chezjanou.fr/" });
  });

  it("texte libre = nom", () => {
    expect(classifyInput("  Le Petit   Commerce  ")).toEqual({ kind: "text", text: "Le Petit Commerce" });
    expect(classifyInput("Chez Janou")).toEqual({ kind: "text", text: "Chez Janou" });
    expect(classifyInput("")).toEqual({ kind: "empty" });
  });

  it("refuse les schémas autres que http(s)", () => {
    expect(classifyInput("javascript:alert(1)").kind).toBe("text");
    expect(classifyInput("file:///etc/passwd").kind).toBe("text");
  });
});

describe("extractFirstUrl", () => {
  it("enlève la ponctuation finale", () => {
    expect(extractFirstUrl("va voir (https://example.com/a).")).toBe("https://example.com/a");
  });
});

describe("Google Maps", () => {
  it("détecte les hôtes", () => {
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/x")).toBe(true);
    expect(isGoogleMapsUrl("https://goo.gl/maps/x")).toBe(true);
    expect(isGoogleMapsUrl("https://maps.google.fr/?q=Bordeaux")).toBe(true);
    expect(isGoogleMapsUrl("https://www.google.fr/maps/place/X")).toBe(true);
    expect(isGoogleMapsUrl("https://www.google.com/")).toBe(false);
    expect(isGoogleMapsUrl("https://notgoogle.com/maps/x")).toBe(false);
    expect(isGoogleShortUrl("https://maps.app.goo.gl/x")).toBe(true);
    expect(isGoogleShortUrl("https://www.google.com/maps/place/x")).toBe(false);
  });

  it("lit /place/<Nom>/ et les coordonnées exactes !3d!4d", () => {
    const info = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Le+Petit+Commerce/@44.8401,-0.5725,17z/data=!3m1!4b1!4m6!3m5!1s0xd5527d!8m2!3d44.8402405!4d-0.5712429!16s%2Fg%2F1tf",
    );
    expect(info).toEqual({ name: "Le Petit Commerce", address: null, lat: 44.8402405, lng: -0.5712429 });
  });

  it("utilise @lat,lng à défaut", () => {
    const info = parseGoogleMapsUrl("https://www.google.fr/maps/place/Caf%C3%A9+de+l'Op%C3%A9ra/@44.8425,-0.5745,15z");
    expect(info).toEqual({ name: "Café de l'Opéra", address: null, lat: 44.8425, lng: -0.5745 });
  });

  it("sépare nom et adresse", () => {
    const info = parseGoogleMapsUrl("https://www.google.com/maps/place/Chez+Janou,+12+Rue+X,+33000+Bordeaux/@44.1,-0.5,17z");
    expect(info.name).toBe("Chez Janou");
    expect(info.address).toBe("12 Rue X, 33000 Bordeaux");
    expect(splitNameAddress("12 Rue X, 33000 Bordeaux")).toEqual({ name: null, address: "12 Rue X, 33000 Bordeaux" });
  });

  it("lit ?q= et ?query=", () => {
    expect(parseGoogleMapsUrl("https://maps.google.com/?q=Chez+Janou,+Bordeaux&ftid=0x1")).toMatchObject({ name: "Chez Janou", address: "Bordeaux" });
    expect(parseGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=Darwin%20Bordeaux")).toMatchObject({ name: "Darwin Bordeaux" });
    expect(parseGoogleMapsUrl("https://maps.google.com/?q=44.84,-0.58")).toMatchObject({ lat: 44.84, lng: -0.58, name: null });
    expect(parseGoogleMapsUrl("https://www.google.com/search?q=Chez+Janou&kgmid=/g/11")).toMatchObject({ name: "Chez Janou" });
  });

  it("suit la page de consentement", () => {
    const u = "https://consent.google.com/m?continue=" + encodeURIComponent("https://www.google.com/maps/place/Darwin/@44.85,-0.56,17z");
    expect(parseGoogleMapsUrl(u)).toMatchObject({ name: "Darwin", lat: 44.85, lng: -0.56 });
  });

  it("trouve le lien long dans une page", () => {
    const html = `<html><head><meta property="og:url" content="x"></head><body><a href="https://www.google.com/maps/place/Darwin/@44.85,-0.56,17z?entry=ttu&amp;g_ep=1">ici</a></body></html>`;
    expect(findGoogleMapsUrlInHtml(html)).toBe("https://www.google.com/maps/place/Darwin/@44.85,-0.56,17z?entry=ttu&g_ep=1");
  });
});

describe("Instagram", () => {
  it("parse les URL", () => {
    expect(parseInstagramUrl("https://instagram.com/natgeo/p/DgHdm3_F4Af/")).toEqual({ account: "natgeo", shortcode: "DgHdm3_F4Af" });
    expect(parseInstagramUrl("https://www.instagram.com/reel/C1abc/")).toEqual({ account: null, shortcode: "C1abc" });
    expect(parseInstagramUrl("https://www.instagram.com/stories/chezjanou/123/")).toEqual({ account: "chezjanou", shortcode: null });
    expect(parseInstagramUrl("https://www.instagram.com/explore/tags/bordeaux/")).toEqual({ account: null, shortcode: null });
    expect(parseInstagramUrl("https://example.com/chezjanou")).toBeNull();
  });

  it("parse les @comptes", () => {
    expect(parseInstagramHandle("@chez.janou")).toBe("chez.janou");
    expect(parseInstagramHandle("instagram chezjanou")).toBe("chezjanou");
    expect(parseInstagramHandle("chezjanou sur instagram")).toBe("chezjanou");
    expect(parseInstagramHandle("Chez Janou")).toBeNull();
    expect(parseInstagramHandle("@p")).toBeNull();
  });
});

describe("nameFromUrl", () => {
  it("TheFork", () => {
    expect(nameFromUrl("https://www.thefork.fr/restaurant/chez-janou-r12345")).toMatchObject({ name: "Chez Janou", hint: "restaurant" });
    expect(nameFromUrl("https://www.thefork.fr/restaurant/le-bistrot-d-a-cote-r777")).toMatchObject({ name: "Le Bistrot d'a Cote" });
  });
  it("TripAdvisor", () => {
    expect(
      nameFromUrl("https://www.tripadvisor.fr/Restaurant_Review-g187079-d1234567-Reviews-Le_Petit_Commerce-Bordeaux_Gironde_Nouvelle_Aquitaine.html"),
    ).toEqual({ name: "Le Petit Commerce", city: "Bordeaux", hint: "restaurant" });
    expect(nameFromUrl("https://www.tripadvisor.fr/Attraction_Review-g187079-d123-Reviews-Darwin_Ecosysteme-Bordeaux_Gironde.html")).toMatchObject({
      name: "Darwin Ecosysteme",
      hint: "attraction",
    });
  });
  it("Booking", () => {
    expect(nameFromUrl("https://www.booking.com/hotel/fr/la-maison-du-bassin.fr.html")).toMatchObject({ name: "La Maison du Bassin", hint: "hotel" });
  });
  it("autre site : rien", () => {
    expect(nameFromUrl("https://www.chezjanou.fr/")).toEqual({ name: null, city: null, hint: null });
  });
});

describe("nameFromUrl (segment générique)", () => {
  it("dernier segment lisible", () => {
    expect(nameFromUrl("https://guide.michelin.com/fr/fr/nouvelle-aquitaine/bordeaux/restaurant/le-pavillon-des-boulevards")).toMatchObject({
      name: "Le Pavillon des Boulevards",
    });
    expect(nameFromUrl("https://example.com/articles/12345678")).toEqual({ name: null, city: null, hint: null });
  });
});

describe("Plans (Apple Maps)", () => {
  it("lit les paramètres", () => {
    expect(parseAppleMapsUrl("https://maps.apple.com/?q=Chez%20Janou&ll=44.8395,-0.5718&address=12%20rue%20X,%2033000%20Bordeaux")).toEqual({
      name: "Chez Janou",
      address: "12 rue X, 33000 Bordeaux",
      lat: 44.8395,
      lng: -0.5718,
    });
    expect(parseAppleMapsUrl("https://maps.apple.com/place?name=Darwin&coordinate=44.85,-0.56")).toMatchObject({ name: "Darwin", lat: 44.85, lng: -0.56 });
    expect(parseAppleMapsUrl("https://example.com/?q=x")).toEqual({ name: null, address: null, lat: null, lng: null });
  });
});
