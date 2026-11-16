/* Service Worker – macht Monna offline spielbar.
 * Strategie: Cache zuerst, im Hintergrund aktualisieren (stale-while-revalidate).
 * Bei jeder Änderung an Dateien die VERSION erhöhen, damit alte Caches gelöscht werden.
 * Neue Dateien (z. B. Grafiken) müssen in ASSETS stehen; tools/validate_data.py prüft das.
 */
const VERSION = 'monna-v1.2.0';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'game.js',
  'ui.js',
  'minigames.js',
  'manifest.json',
  'data/aufgaben.json',
  'data/hku.json',
  'data/minispiele.json',
  'data/persoenlich.json',
  'data/stirnraten.json',
  'data/werbinich.json',
  'data/wissen.json',
  'fonts/inter-latin-wght-normal.woff2',
  'fonts/playfair-display-latin-wght-italic.woff2',
  'fonts/playfair-display-latin-wght-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'assets/bg-texture.png',
  'assets/cat-aufgaben.svg',
  'assets/cat-fragen.svg',
  'assets/cat-hku.svg',
  'assets/cat-minispiele.svg',
  'assets/cat-mix.svg',
  'assets/cat-stirnraten.svg',
  'assets/cat-werbinich.svg',
  'assets/cat-wissen.svg',
  'assets/empty-pause.svg',
  'assets/end-danke.svg',
  'assets/game-assoziation.svg',
  'assets/game-atem.svg',
  'assets/game-gefuehlsrad.svg',
  'assets/game-geschichte.svg',
  'assets/game-rosedornknospe.svg',
  'assets/game-satzanfaenge.svg',
  'assets/game-spiegeln.svg',
  'assets/game-zukunftsbild.svg',
  'assets/hero-start.svg',
  'assets/icon-back.svg',
  'assets/icon-check.svg',
  'assets/icon-close.svg',
  'assets/icon-info.svg',
  'assets/icon-next.svg',
  'assets/icon-pause.svg',
  'assets/icon-rotate.svg',
  'assets/icon-skip.svg',
  'assets/icon-timer.svg',
  'assets/mode-couple.svg',
  'assets/mode-friends.svg',
  'assets/mode-party.svg',
  'assets/story-haus.svg',
  'assets/story-tuer.svg',
  'assets/story-weg.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const network = fetch(req).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then(cache => cache.put(req, copy));
    }
    return res;
  });
  event.waitUntil(network.then(() => {}, () => {}));

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return network.catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
