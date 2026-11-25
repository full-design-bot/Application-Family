import { describe, expect, it } from "vitest";
import {
  cityFromAddress,
  decodeEntities,
  draftFromHtml,
  extractJsonLd,
  extractMeta,
  findBusiness,
  findInstagramAccount,
  nameFromTitle,
  parsePriceLevel,
} from "./html";

const RESTO_SITE = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>Accueil - Chez Janou | Bistrot à Bordeaux</title>
<meta name="description" content="Bistrot de quartier, cuisine du march&eacute; et vins nature.">
<meta property="og:site_name" content="Chez Janou">
<meta property="og:title" content="Accueil - Chez Janou">
<meta property='og:image' content='/img/salle.jpg'>
<meta property="og:url" content="https://www.chezjanou.fr/">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Chez Janou", "url": "https://www.chezjanou.fr" },
    {
      "@type": "Restaurant",
      "name": "Chez Janou",
      "servesCuisine": ["Française", "Bistrot"],
      "priceRange": "€€",
      "image": ["https://www.chezjanou.fr/img/facade.jpg"],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "12 rue du Pas-Saint-Georges",
        "postalCode": "33000",
        "addressLocality": "Bordeaux"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": "44.8395", "longitude": -0.5718 },
      "sameAs": ["https://www.facebook.com/chezjanou", "https://www.instagram.com/chezjanou.bdx/"]
    }
  ]
}
</script>
</head><body><h1>Chez Janou</h1></body></html>`;

const THEFORK = `<html><head>
<title>Le Petit Commerce à Bordeaux - Menu, avis, prix et réservation - TheFork</title>
<meta property="og:site_name" content="TheFork" />
<meta property="og:title" content="Le Petit Commerce à Bordeaux - Menu, avis, prix et réservation - TheFork" />
<meta property="og:description" content="Réservez au restaurant Le Petit Commerce à Bordeaux. Prix moyen 35 €." />
<meta property="og:image" content="https://res.cloudinary.com/tf-lab/image/upload/restaurant/abc.jpg" />
</head><body></body></html>`;

const MINIMAL = `<html><head><title>Darwin Écosystème &#8211; Lieu alternatif</title>
<meta name="description" content="Skatepark, restaurant bio, expositions, concerts">
</head><body><footer><a href="https://www.instagram.com/darwinecosysteme/">Insta</a></footer></body></html>`;

const HOTEL = `<html><head><meta property="og:title" content="La Co(o)rniche — Hôtel à Pyla-sur-Mer">
<script type="application/ld+json">[{"@type":["Hotel","LocalBusiness"],"name":"La Co(o)rniche","address":"46 avenue Louis Gaume, 33115 Pyla-sur-Mer, France","priceRange":"250 € - 600 €"}]</script>
</head></html>`;

describe("helpers", () => {
  it("décode les entités", () => {
    expect(decodeEntities("Caf&eacute; &amp; th&#233; &#x2022; ok")).toBe("Café & thé • ok");
  });

  it("lit les balises meta (guillemets simples, doubles, ordre libre)", () => {
    const meta = extractMeta(RESTO_SITE);
    expect(meta["og:site_name"]).toBe("Chez Janou");
    expect(meta["og:image"]).toBe("/img/salle.jpg");
    expect(meta["description"]).toBe("Bistrot de quartier, cuisine du marché et vins nature.");
    expect(extractMeta(`<meta content="X" property="og:title">`)["og:title"]).toBe("X");
  });

  it("niveau de prix", () => {
    expect(parsePriceLevel("€€")).toBe(2);
    expect(parsePriceLevel("$$$$")).toBe(4);
    expect(parsePriceLevel("€-€€")).toBe(2);
    expect(parsePriceLevel("10-14 €")).toBe(1);
    expect(parsePriceLevel("Prix moyen 35 €")).toBe(3);
    expect(parsePriceLevel("250 € - 600 €")).toBe(4);
    expect(parsePriceLevel("")).toBeNull();
    expect(parsePriceLevel("Abordable")).toBeNull();
  });

  it("ville depuis l'adresse", () => {
    expect(cityFromAddress("12 rue X, 33000 Bordeaux")).toBe("Bordeaux");
    expect(cityFromAddress("46 avenue Louis Gaume, 33115 Pyla-sur-Mer, France")).toBe("Pyla-sur-Mer");
    expect(cityFromAddress("Quelque part")).toBeNull();
  });

  it("nom depuis le titre", () => {
    expect(nameFromTitle("Accueil - Chez Janou | Bistrot à Bordeaux", "Chez Janou")).toBe("Chez Janou");
    expect(nameFromTitle("Bistrot à Bordeaux | Menu", null)).toBe("Bistrot à Bordeaux");
    expect(nameFromTitle("Accueil - Chez Janou", null)).toBe("Chez Janou");
    expect(nameFromTitle("Le Petit Commerce à Bordeaux - Menu, avis, prix et réservation - TheFork", "TheFork")).toBe("Le Petit Commerce");
    expect(nameFromTitle("Accueil", "Le Bouchon")).toBe("Le Bouchon");
  });

  it("compte Instagram dans la page", () => {
    expect(findInstagramAccount(MINIMAL)).toBe("darwinecosysteme");
    expect(findInstagramAccount("", ["https://instagram.com/chezjanou/"])).toBe("chezjanou");
    expect(findInstagramAccount(`<a href="https://www.instagram.com/p/abc/">post</a>`)).toBeNull();
  });
});

describe("JSON-LD", () => {
  it("trouve le restaurant dans un @graph", () => {
    const b = findBusiness(extractJsonLd(RESTO_SITE))!;
    expect(b.name).toBe("Chez Janou");
    expect(b.types).toEqual(["Restaurant"]);
    expect(b.address).toBe("12 rue du Pas-Saint-Georges, 33000 Bordeaux");
    expect(b.city).toBe("Bordeaux");
    expect(b.lat).toBe(44.8395);
    expect(b.lng).toBe(-0.5718);
    expect(b.cuisine).toBe("Française, Bistrot");
    expect(b.priceRange).toBe("€€");
  });

  it("ignore le JSON invalide", () => {
    expect(extractJsonLd(`<script type="application/ld+json">{oops</script>`)).toEqual([]);
  });
});

describe("draftFromHtml", () => {
  it("site de resto avec JSON-LD complet", () => {
    const d = draftFromHtml(RESTO_SITE, "https://www.chezjanou.fr/accueil?utm_source=ig&fbclid=x#menu");
    expect(d).toEqual({
      name: "Chez Janou",
      category: "resto",
      url: "https://www.chezjanou.fr/accueil",
      instagram: "chezjanou.bdx",
      address: "12 rue du Pas-Saint-Georges, 33000 Bordeaux",
      city: "Bordeaux",
      lat: 44.8395,
      lng: -0.5718,
      image_url: "https://www.chezjanou.fr/img/facade.jpg",
      description: "Bistrot de quartier, cuisine du marché et vins nature.",
      price_level: 2,
    });
  });

  it("TheFork (balises og seulement)", () => {
    const d = draftFromHtml(THEFORK, "https://www.thefork.fr/restaurant/le-petit-commerce-r9876");
    expect(d.name).toBe("Le Petit Commerce");
    expect(d.category).toBe("resto");
    expect(d.image_url).toBe("https://res.cloudinary.com/tf-lab/image/upload/restaurant/abc.jpg");
    expect(d.url).toBe("https://www.thefork.fr/restaurant/le-petit-commerce-r9876");
    expect(d.price_level).toBeNull();
  });

  it("page minimale : titre + description", () => {
    const d = draftFromHtml(MINIMAL, "https://darwin.camp/");
    expect(d.name).toBe("Darwin Écosystème");
    expect(d.instagram).toBe("darwinecosysteme");
    expect(d.description).toBe("Skatepark, restaurant bio, expositions, concerts");
  });

  it("hôtel → week-end", () => {
    const d = draftFromHtml(HOTEL, "https://www.lacoorniche-pyla.com/");
    expect(d.category).toBe("weekend");
    expect(d.city).toBe("Pyla-sur-Mer");
    expect(d.price_level).toBe(4);
  });

  it("guide : n'attribue pas le compte Instagram de la plateforme", () => {
    const html = `<title>Le Pavillon – Guide MICHELIN</title><a href="https://www.instagram.com/michelinguide/">insta</a>`;
    expect(draftFromHtml(html, "https://guide.michelin.com/fr/fr/restaurant/le-pavillon").instagram).toBeNull();
  });

  it("ignore les images Instagram qui expirent", () => {
    const html = `<meta property="og:title" content="X"><meta property="og:image" content="https://scontent-cdg4-1.cdninstagram.com/v/t51/abc.jpg?oe=6B0C">`;
    expect(draftFromHtml(html, "https://example.com/").image_url).toBeNull();
  });
});
