#!/usr/bin/env node
/* Erzeugt die PNG-Icons aus icons/icon.svg.
 *
 *   node tools/make_icons.js
 *
 * Braucht Playwright mit Chromium (nur für diesen Schritt, nicht für die App).
 * Nach einem neuen icons/icon.svg einmal ausführen und in sw.js die VERSION erhöhen.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ordner = path.join(__dirname, '..', 'icons');
const ziele = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

(async () => {
  const svg = fs.readFileSync(path.join(ordner, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const [datei, groesse] of ziele) {
    const seite = await browser.newPage({ viewport: { width: groesse, height: groesse }, deviceScaleFactor: 1 });
    await seite.setContent(`<style>html,body{margin:0}svg{display:block;width:${groesse}px;height:${groesse}px}</style>${svg}`);
    await seite.screenshot({ path: path.join(ordner, datei) });
    await seite.close();
    console.log(datei, groesse + 'px');
  }
  await browser.close();
})();
