#!/usr/bin/env node
/* Rechnet die sauberen Vektormotive aus tools/grafiken/quelle/ in Tuschezeichnungen um
 * und schreibt sie unter denselben Namen nach assets/.
 *
 *   node tools/grafiken/tuschen.js [name …]
 *
 * Stil: handgezogene, leicht zittrige Konturen in wechselnder Strichstärke, dazu
 * Schraffur statt Flächen – helle Schraffur für den Hintergrund, dichtere für
 * Schatten, Kreuzschraffur für Schwarz. Braucht Playwright mit Chromium (nur hier).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const QUELLE = path.join(__dirname, 'quelle');
const ZIEL = path.join(__dirname, '..', '..', 'assets');

/* Läuft im Browser: misst Geometrie und Tonwerte und gibt das neue SVG zurück. */
async function tuschen({ svgText, seed }) {
  let zustand = seed >>> 0;
  const rnd = () => { zustand = (zustand * 1664525 + 1013904223) >>> 0; return zustand / 4294967296; };
  const f1 = z => (Math.round(z * 10) / 10).toString();

  const halter = document.createElement('div');
  halter.innerHTML = svgText;
  document.body.appendChild(halter);
  const wurzel = halter.querySelector('svg');
  const [, , W, H] = wurzel.getAttribute('viewBox').split(' ').map(Number);
  const S = W > 200 ? 4 : 6;                      // Rasterpunkte je Einheit
  const pw = Math.round(W * S), ph = Math.round(H * S);

  async function raster(text) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = pw; c.height = ph;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, pw, ph);
    return ctx.getImageData(0, 0, pw, ph).data;
  }
  const voll = await raster(svgText);
  const flaechen = await raster(svgText.replace('>', '><style>*{stroke:none!important}[stroke="none"][fill="#111111"]{display:none}</style>'));

  // ---- Tonwerte --------------------------------------------------------------
  const N = pw * ph;
  const weiss = new Uint8Array(N), grau = new Uint8Array(N), schwarz = new Uint8Array(N), dunkel = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    const a = flaechen[j + 3] / 255;
    const l = (0.299 * flaechen[j] + 0.587 * flaechen[j + 1] + 0.114 * flaechen[j + 2]) / 255;
    if (a > 0.5) { if (l > 0.97) weiss[i] = 1; else if (l > 0.6) grau[i] = 1; else if (l < 0.3) schwarz[i] = 1; }
    const av = voll[j + 3] / 255;
    const lv = ((0.299 * voll[j] + 0.587 * voll[j + 1] + 0.114 * voll[j + 2]) / 255) * av + (1 - av);
    if (lv < 0.62) dunkel[i] = 1;
  }
  const an = (maske, x, y) => x >= 0 && y >= 0 && x < pw && y < ph && maske[y * pw + x] === 1;
  const draussen = (x, y) => x < 0 || y < 0 || x >= pw || y >= ph;
  // Ton: 1 Hintergrund, 2 Schatten im Körper, 3 Schlagschatten, 4 Schwarz, 5 weicher Schattenrand
  const ton = new Uint8Array(N);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      if (schwarz[i]) { ton[i] = 4; continue; }
      if (dunkel[i]) continue;
      if (weiss[i]) {
        for (const k of [1.1, 2.2, 3.3, 4.4, 6, 7.5, 9]) {
          const d = Math.round(k * S);
          if (draussen(x + d, y + d)) break;
          if (!an(weiss, x + d, y + d) || an(dunkel, x + d, y + d)) { ton[i] = k < 5 ? 2 : 5; break; }
        }
      } else if (grau[i]) {
        ton[i] = 1;
        for (const k of [1.5, 3, 4.5, 6]) {
          const d = Math.round(k * S);
          if (an(weiss, x - d, y - d) || an(schwarz, x - d, y - d)) { ton[i] = 3; break; }
        }
      }
    }
  }

  // ---- Schraffur --------------------------------------------------------------
  function schraffur(passt, winkel, abstand, o) {
    const th = (winkel * Math.PI) / 180;
    const nx = -Math.sin(th), ny = Math.cos(th);
    const diag = Math.hypot(W, H) / 2 + 2;
    let d = '';
    for (let c = -diag; c < diag; c += abstand * (0.8 + 0.4 * rnd())) {
      const w = th + (rnd() - 0.5) * 0.07;
      const vx = Math.cos(w), vy = Math.sin(w);
      let start = null;
      const ende = t => {
        let a = start + rnd() * o.kuerzen, b = t - rnd() * o.kuerzen;
        start = null;
        while (b - a > o.min) {
          const laenge = Math.min(b - a, o.stueck[0] + rnd() * (o.stueck[1] - o.stueck[0]));
          const q = a + laenge;
          const j = () => (rnd() - 0.5) * 2 * o.zittern;
          const x1 = W / 2 + nx * c + vx * a + nx * j(), y1 = H / 2 + ny * c + vy * a + ny * j();
          const x2 = W / 2 + nx * c + vx * q + nx * j(), y2 = H / 2 + ny * c + vy * q + ny * j();
          const b0 = j() * 1.5;
          d += 'M' + f1(x1) + ' ' + f1(y1) + 'Q' + f1((x1 + x2) / 2 + nx * b0) + ' ' + f1((y1 + y2) / 2 + ny * b0) + ' ' + f1(x2) + ' ' + f1(y2);
          a = q + (rnd() < o.luecke ? 0.6 + rnd() * 1.6 : 0.15);
        }
      };
      for (let t = -diag; t <= diag; t += 1 / S) {
        const x = Math.round((W / 2 + nx * c + vx * t) * S), y = Math.round((H / 2 + ny * c + vy * t) * S);
        const drin = x >= 0 && y >= 0 && x < pw && y < ph && passt(ton[y * pw + x]);
        if (drin && start === null) start = t;
        else if (!drin && start !== null) ende(t);
      }
      if (start !== null) ende(diag);
    }
    return d;
  }
  const hell = schraffur(t => t === 1 || t === 3, 32, 2.5, { kuerzen: 2.2, min: 1.2, stueck: [5, 16], luecke: 0.45, zittern: 0.22 });
  const mittel = schraffur(t => t === 2 || t === 3, 32, 1.25, { kuerzen: 1, min: 0.7, stueck: [3, 9], luecke: 0.25, zittern: 0.16 })
    + schraffur(t => t === 3, -58, 2, { kuerzen: 1, min: 0.8, stueck: [3, 8], luecke: 0.3, zittern: 0.16 });
  const weich = schraffur(t => t === 5, 32, 2.3, { kuerzen: 1.6, min: 1, stueck: [3, 8], luecke: 0.5, zittern: 0.18 });
  const tief = schraffur(t => t === 4, 32, 0.75, { kuerzen: 0.3, min: 0.4, stueck: [3, 10], luecke: 0.1, zittern: 0.12 })
    + schraffur(t => t === 4, -58, 1, { kuerzen: 0.3, min: 0.4, stueck: [3, 10], luecke: 0.15, zittern: 0.12 });

  // ---- Konturen ---------------------------------------------------------------
  const zuege = [];   // { punkte: [[x, y, s]], breite }
  for (const el of wurzel.querySelectorAll('path, rect, circle')) {
    const stil = getComputedStyle(el);
    if (stil.stroke === 'none' || !el.getTotalLength) continue;
    const m = el.getCTM();
    const massstab = Math.hypot(m.a, m.b);
    const blass = stil.stroke.replace(/\s/g, '') === 'rgb(110,110,110)';
    const breite = blass ? 0.9 : Math.max(1.2, parseFloat(stil.strokeWidth) * massstab * 0.82);
    const gestrichelt = el.hasAttribute('stroke-dasharray');
    const L = el.getTotalLength();
    const schrittweite = 1 / massstab;
    let zug = null, letzter = null, weg = 0;
    const schliessen = () => { if (zug && zug.punkte.length > 2) zuege.push(zug); zug = null; };
    for (let dist = 0; dist <= L + schrittweite * 0.5; dist += schrittweite) {
      const p = el.getPointAtLength(Math.min(dist, L));
      const x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
      const sprung = letzter && Math.hypot(x - letzter[0], y - letzter[1]) > 3;
      if (letzter && !sprung) weg += Math.hypot(x - letzter[0], y - letzter[1]);
      letzter = [x, y];
      const px = Math.round(x * S), py = Math.round(y * S);
      let sichtbar = false;
      for (let dy = -1; dy <= 1 && !sichtbar; dy++) for (let dx = -1; dx <= 1; dx++) if (an(dunkel, px + dx, py + dy)) { sichtbar = true; break; }
      if (gestrichelt && weg % 5.6 > 2.3) sichtbar = false;
      if (sprung || !sichtbar) { schliessen(); if (!sichtbar) continue; }
      if (!zug) zug = { punkte: [], breite };
      zug.punkte.push([x, y, weg]);
    }
    schliessen();
  }

  const klassen = {};   // Strichstärke → Pfaddaten
  function zeichne(zug, staerke, ausschlag, auslassen) {
    const p1 = rnd() * 6.3, p2 = rnd() * 6.3, p3 = rnd() * 6.3;
    const l1 = 17 + rnd() * 14, l2 = 6 + rnd() * 5;
    const P = zug.punkte;
    const versetzt = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty) || 1;
      const v = ausschlag * (0.42 * Math.sin((p[2] * 6.283) / l1 + p1) + 0.2 * Math.sin((p[2] * 6.283) / l2 + p2));
      return [p[0] - (ty / n) * v, p[1] + (tx / n) * v, p[2]];
    });
    // in Abschnitte teilen, jeder mit eigener Strichstärke (wie wechselnder Federdruck)
    let i = 0;
    while (i < versetzt.length - 1) {
      const s0 = versetzt[i][2];
      const laenge = 6 + rnd() * 9;
      let j = i + 1;
      while (j < versetzt.length - 1 && versetzt[j][2] - s0 < laenge) j++;
      const druck = 0.78 + 0.5 * (0.5 + 0.5 * Math.sin((s0 * 6.283) / 31 + p3));
      const klasse = (Math.round((zug.breite * staerke * druck) / 0.3) * 0.3).toFixed(1);
      if (!(auslassen && rnd() < auslassen)) {
        const stueck = versetzt.slice(i, j + 1).filter((_, k, alle) => k % 2 === 0 || k === alle.length - 1);
        let d = 'M' + f1(stueck[0][0]) + ' ' + f1(stueck[0][1]);
        for (let k = 1; k < stueck.length - 1; k++) {
          const mx = (stueck[k][0] + stueck[k + 1][0]) / 2, my = (stueck[k][1] + stueck[k + 1][1]) / 2;
          d += 'Q' + f1(stueck[k][0]) + ' ' + f1(stueck[k][1]) + ' ' + f1(mx) + ' ' + f1(my);
        }
        const z = stueck[stueck.length - 1];
        d += 'L' + f1(z[0]) + ' ' + f1(z[1]);
        klassen[klasse] = (klassen[klasse] || '') + d;
      }
      i = j;
    }
  }
  for (const zug of zuege) {
    zeichne(zug, 1, 0.62, 0);
    zeichne(zug, 0.4, 1.5, 0.3);     // zweiter, feiner Strich daneben
  }

  // ---- kleine Vollflächen (Funken, Punkte) bleiben, wie sie sind -------------------
  const voll_s = [...wurzel.querySelectorAll('[stroke="none"][fill="#111111"]')]
    .map(el => new XMLSerializer().serializeToString(el).replace(' xmlns="http://www.w3.org/2000/svg"', '')).join('\n  ');

  halter.remove();
  const pfad = (breite, d) => (d ? `  <path stroke-width="${breite}" d="${d}"/>\n` : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" stroke="#111111" stroke-linecap="round" stroke-linejoin="round">\n`
    + pfad(0.45, hell + weich) + pfad(0.5, mittel) + pfad(0.55, tief)
    + Object.keys(klassen).sort().map(k => pfad(k, klassen[k])).join('')
    + (voll_s ? '  ' + voll_s + '\n' : '') + '</svg>\n';
}

(async () => {
  const wahl = process.argv.slice(2);
  const dateien = fs.readdirSync(QUELLE).filter(f => f.endsWith('.svg') && (!wahl.length || wahl.includes(f.replace('.svg', '')))).sort();
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  await seite.setContent('<!DOCTYPE html><body></body>');
  for (const [i, datei] of dateien.entries()) {
    const svgText = fs.readFileSync(path.join(QUELLE, datei), 'utf8');
    const ergebnis = await seite.evaluate(tuschen, { svgText, seed: 1000 + i * 77 });
    fs.writeFileSync(path.join(ZIEL, datei), ergebnis);
    console.log(datei.padEnd(28), (ergebnis.length / 1024).toFixed(0) + ' KB');
  }
  await browser.close();
})();
