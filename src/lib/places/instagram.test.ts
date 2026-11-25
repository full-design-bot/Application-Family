import { describe, expect, it } from "vitest";
import { nameFromHandle, parseInstagramEmbed, parseInstagramPage, parseInstagramTitle, unescapeJsonLayers } from "./instagram";

// Extraits réels (simplifiés) de pages Instagram publiques.
const POST_PAGE = `<html><head>
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Instagram" />
<meta property="og:url" content="https://www.instagram.com/chezjanou.bdx/p/DgHdm3_F4Af/" />
<meta name="twitter:title" content="Chez Janou (&#064;chezjanou.bdx) &#x2022; Instagram photo" />
<meta property="og:description" content="152 likes, 12 comments - chezjanou.bdx on November 2, 2026: &quot;Nouveau menu d&#039;automne au bistrot 🍂&quot;." />
</head></html>`;

const PROFILE_EMBED = `<html><head><title>Instagram</title></head><body>
<script>requireLazy(["x"],function(){ s.handle({"contextJSON":"{\\"context\\":{\\"username\\":\\"cafe.du.port\\",\\"full_name\\":\\"Caf\\\\u00e9 du Port\\",\\"profile_pic_url\\":\\"https:\\\\\\/\\\\\\/x.jpg\\"}}"}) });</script>
</body></html>`;

const POST_EMBED = `<div class="Header"><a class="Username" href="#"><span class="UsernameText">le_petit_commerce</span></a></div>
<img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;le_petit_commerce" src="https://scontent.cdninstagram.com/x.jpg">
<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/le_petit_commerce/">le_petit_commerce</a><br /><br />Huîtres du bassin et poissons du jour 🐟<div class="CaptionComments"></div></div>`;

describe("Instagram", () => {
  it("titre de page", () => {
    expect(parseInstagramTitle("Chez Janou (@chezjanou.bdx) • Instagram photos and videos")).toEqual({ fullName: "Chez Janou", account: "chezjanou.bdx" });
    expect(parseInstagramTitle("chezjanou on Instagram: \"Menu\"")).toEqual({ fullName: null, account: "chezjanou" });
    expect(parseInstagramTitle("Instagram")).toEqual({ fullName: null, account: null });
  });

  it("page d'une publication", () => {
    expect(parseInstagramPage(POST_PAGE)).toEqual({
      account: "chezjanou.bdx",
      fullName: "Chez Janou",
      caption: "Nouveau menu d'automne au bistrot 🍂",
    });
  });

  it("embed d'un compte (JSON échappé)", () => {
    expect(parseInstagramEmbed(PROFILE_EMBED)).toEqual({ account: "cafe.du.port", fullName: "Café du Port", caption: null });
  });

  it("embed d'une publication", () => {
    expect(parseInstagramEmbed(POST_EMBED)).toEqual({
      account: "le_petit_commerce",
      fullName: null,
      caption: "Huîtres du bassin et poissons du jour 🐟",
    });
  });

  it("utilitaires", () => {
    expect(unescapeJsonLayers("Caf\\\\u00e9")).toBe("Café");
    expect(unescapeJsonLayers("Simple")).toBe("Simple");
    expect(nameFromHandle("chez_janou.bdx")).toBe("Chez Janou Bdx");
  });
});
