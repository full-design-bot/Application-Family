// Génère les icônes PNG de l'app à partir de scripts/icon.svg (node scripts/generate-icons.cjs)
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const icon = readFileSync(path.join(__dirname, "icon.svg"), "utf8");
const badge = readFileSync(path.join(__dirname, "badge.svg"), "utf8");
const out = [
  ["public/icons/icon-192.png", icon, 192, 0],
  ["public/icons/icon-512.png", icon, 512, 0],
  ["public/icons/icon-maskable-512.png", icon, 512, 0],
  ["public/apple-touch-icon.png", icon, 180, 0],
  ["public/icons/badge-96.png", badge, 96, 1],
];
(async () => {
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, svg, size, transparent] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: Boolean(transparent) });
  console.log("✓", file);
}
await browser.close();
})();
