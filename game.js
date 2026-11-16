/* Monna – Spielzustand, Kartenstapel und Filter. Keine Darstellung, kein DOM.
 *
 * Es gibt bewusst keine Punkte und keine Gewinner. Antworten werden nie
 * gespeichert; localStorage kennt nur Einstellungen (Modus, Intensität und –
 * nur auf Wunsch – die beiden Namen).
 */
(function (global) {
  'use strict';

  const SPEICHER = 'monna.einstellungen';

  const DATEIEN = {
    wissen: 'data/wissen.json',
    persoenlich: 'data/persoenlich.json',
    aufgaben: 'data/aufgaben.json',
    minispiele: 'data/minispiele.json',
    stirnraten: 'data/stirnraten.json',
    werbinich: 'data/werbinich.json',
    hku: 'data/hku.json',
  };

  const MODI = [
    { id: 'couple', name: 'Couple', text: 'Für euch zwei als Paar.', bild: 'mode-couple', verfuegbar: true },
    { id: 'friends', name: 'Friends', text: 'Für zwei gute Freunde.', bild: 'mode-friends', verfuegbar: true },
    { id: 'party', name: 'Party', text: 'Für die große Runde.', bild: 'mode-party', verfuegbar: false },
  ];

  const INTENSITAETEN = [
    { wert: 1, name: 'Leicht', text: 'Zum Ankommen: leichte, verspielte Karten.' },
    { wert: 2, name: 'Mittel', text: 'Dazu Karten, die etwas persönlicher werden.' },
    { wert: 3, name: 'Tief', text: 'Alle Karten, auch die, die nahegehen.' },
  ];

  /** Karten pro Runde in den Kartenkategorien. */
  const RUNDENLAENGE = 10;

  const zustand = {
    modus: null,          // 'couple' | 'friends'
    namen: ['', ''],
    namenMerken: false,
    intensitaet: 2,       // 1–3, es gelten alle Karten bis zu dieser Stufe
    dran: 0,              // Index der Person, die gerade an der Reihe ist
  };

  const daten = {};       // Inhalt der JSON-Dateien, nach Schlüssel aus DATEIEN
  const stapel = {};      // ein Stapel je Kartenquelle

  /* ---- Mischen und Ziehen ------------------------------------------------ */

  /** Fisher-Yates: gibt eine gemischte Kopie zurück. */
  function mischen(liste) {
    const kopie = liste.slice();
    for (let i = kopie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  /**
   * Kartenstapel ohne Wiederholung. Der Stapel merkt sich, was schon dran war,
   * auch wenn sich der Filter (Modus, Intensität) zwischendurch ändert. Erst
   * wenn alle passenden Karten gezogen wurden, wird neu gemischt.
   */
  class Stapel {
    constructor() {
      this.gesehen = new Set();
      this.folge = [];
      this.signatur = null;
      this.letzte = null;
    }

    /** @param karten bereits gefilterte Karten, jede mit eindeutiger `id` */
    ziehen(karten, signatur) {
      if (!karten.length) return null;
      if (signatur !== this.signatur || !this.folge.length) {
        this.signatur = signatur;
        let offen = karten.filter(k => !this.gesehen.has(k.id));
        if (!offen.length) {
          karten.forEach(k => this.gesehen.delete(k.id));
          offen = karten;
        }
        this.folge = mischen(offen);
        // Nach dem Neumischen nicht direkt mit der zuletzt gezeigten Karte beginnen.
        const oben = this.folge.length - 1;
        if (oben > 0 && this.folge[oben].id === this.letzte) {
          [this.folge[0], this.folge[oben]] = [this.folge[oben], this.folge[0]];
        }
      }
      const karte = this.folge.pop();
      this.gesehen.add(karte.id);
      this.letzte = karte.id;
      return karte;
    }

    /** Wie viele der übergebenen Karten wurden noch nicht gezeigt? */
    offen(karten) {
      return karten.filter(k => !this.gesehen.has(k.id)).length;
    }
  }

  /* ---- Filter ------------------------------------------------------------ */

  function passtModus(karte) {
    const m = karte.modus || 'beide';
    return m === 'beide' || m === zustand.modus;
  }

  function passt(karte) {
    return passtModus(karte) && (karte.intensitaet || 1) <= zustand.intensitaet;
  }

  function filtern(liste) {
    return (liste || []).filter(passt);
  }

  /** Kartenquellen der Runden. Jede liefert die aktuell passenden Karten. */
  const QUELLEN = {
    wissen: () => filtern(daten.wissen && daten.wissen.karten),
    fragen: () => filtern(daten.persoenlich && daten.persoenlich.karten),
    aufgaben: () => filtern(daten.aufgaben && daten.aufgaben.karten),
    satz: () => filtern(daten.minispiele && daten.minispiele.satzanfaenge),
  };

  function signatur() {
    return zustand.modus + '|' + zustand.intensitaet;
  }

  /** Zieht die nächste Karte einer Quelle (ohne Wiederholung). */
  function ziehen(quelle, karten) {
    const liste = karten || (QUELLEN[quelle] ? QUELLEN[quelle]() : []);
    if (!stapel[quelle]) stapel[quelle] = new Stapel();
    const karte = stapel[quelle].ziehen(liste, signatur());
    return karte ? Object.assign({ typ: quelle }, karte) : null;
  }

  /** Reihenfolge der Kartenarten für „Bunt gemischt“: ausgewogen, aber nicht starr. */
  function mixFolge(laenge) {
    const arten = ['wissen', 'fragen', 'aufgaben'].filter(a => QUELLEN[a]().length);
    let folge = [];
    while (arten.length && folge.length < laenge) folge = folge.concat(mischen(arten));
    return folge.slice(0, laenge);
  }

  /** Die vier Antworten einer Wissenskarte in zufälliger Reihenfolge. */
  function antworten(karte) {
    return mischen([{ text: karte.richtig, richtig: true }]
      .concat(karte.falsch.map(text => ({ text, richtig: false }))));
  }

  /* ---- Spieler ----------------------------------------------------------- */

  function name(index) {
    const n = (zustand.namen[index] || '').trim();
    return n || 'Person ' + (index + 1);
  }
  const dran = () => name(zustand.dran);
  const andere = () => name(1 - zustand.dran);
  function wechseln() { zustand.dran = 1 - zustand.dran; }
  const bereit = () => MODI.some(m => m.id === zustand.modus && m.verfuegbar);

  /* ---- Einstellungen ----------------------------------------------------- */

  function speichern() {
    const e = { modus: zustand.modus, intensitaet: zustand.intensitaet, namenMerken: zustand.namenMerken };
    if (zustand.namenMerken) e.namen = zustand.namen;
    try { localStorage.setItem(SPEICHER, JSON.stringify(e)); } catch (_) { /* privater Modus: egal */ }
  }

  function einstellungenLaden() {
    let e = null;
    try { e = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch (_) { e = null; }
    if (!e || typeof e !== 'object') return;
    if (MODI.some(m => m.id === e.modus && m.verfuegbar)) zustand.modus = e.modus;
    if ([1, 2, 3].includes(e.intensitaet)) zustand.intensitaet = e.intensitaet;
    zustand.namenMerken = e.namenMerken === true;
    if (zustand.namenMerken && Array.isArray(e.namen)) {
      zustand.namen = [String(e.namen[0] || ''), String(e.namen[1] || '')];
    }
  }

  function setModus(id) { zustand.modus = id; speichern(); }
  function setIntensitaet(wert) { zustand.intensitaet = wert; speichern(); }
  function setNamen(a, b, merken) {
    zustand.namen = [a.trim().slice(0, 24), b.trim().slice(0, 24)];
    zustand.namenMerken = !!merken;
    zustand.dran = 0;
    speichern();
  }

  /* ---- Daten laden ------------------------------------------------------- */

  let ladeVersprechen = null;
  function laden() {
    if (!ladeVersprechen) {
      ladeVersprechen = Promise.all(Object.entries(DATEIEN).map(([schluessel, pfad]) =>
        fetch(pfad)
          .then(antwort => {
            if (!antwort.ok) throw new Error(pfad + ': ' + antwort.status);
            return antwort.json();
          })
          .then(inhalt => { daten[schluessel] = inhalt; })
      )).catch(fehler => { ladeVersprechen = null; throw fehler; });
    }
    return ladeVersprechen;
  }

  global.Monna = global.Monna || {};
  global.Monna.Game = {
    MODI, INTENSITAETEN, RUNDENLAENGE, QUELLEN,
    zustand, daten,
    Stapel, mischen, ziehen, mixFolge, antworten,
    passt, passtModus, filtern,
    name, dran, andere, wechseln, bereit,
    setModus, setIntensitaet, setNamen, einstellungenLaden, speichern, laden,
  };
})(window);
