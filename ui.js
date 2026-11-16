/* Monna – Darstellung: Bausteine, Navigation, Screens und Kartenrunden.
 *
 * Grafiken werden ausschließlich über feste Pfade in assets/ geladen
 * (bild('cat-wissen') → assets/cat-wissen.svg). Fehlt eine Datei, wird das Bild
 * einfach ausgeblendet; an den Grafiken hängt keine Logik.
 */
(function (global) {
  'use strict';

  const Game = global.Monna.Game;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ASSETS = 'assets/';

  /* ---- DOM-Helfer --------------------------------------------------------- */

  function fuelle(el, attrs, kinder) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    const anhaengen = kind => {
      if (kind === null || kind === undefined || kind === false) return;
      if (Array.isArray(kind)) kind.forEach(anhaengen);
      else el.appendChild(kind instanceof Node ? kind : document.createTextNode(String(kind)));
    };
    kinder.forEach(anhaengen);
    return el;
  }
  const h = (tag, attrs, ...kinder) => fuelle(document.createElement(tag), attrs, kinder);
  const svg = (tag, attrs, ...kinder) => fuelle(document.createElementNS(SVG_NS, tag), attrs, kinder);

  /* ---- Bausteine ---------------------------------------------------------- */

  /** Einfarbiges Icon aus assets/icon-<name>.svg (als Maske, Farbe = Textfarbe). */
  function icon(name) {
    const el = h('span', { class: 'icon', 'aria-hidden': 'true' });
    const url = 'url("' + ASSETS + 'icon-' + name + '.svg")';
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
    return el;
  }

  /** Illustration aus assets/<name>.svg. Rein dekorativ, daher leerer Alt-Text. */
  function bild(name, klasse) {
    const el = h('img', {
      class: klasse || 'illustration', src: ASSETS + name + '.svg', alt: '', decoding: 'async', draggable: 'false',
    });
    el.addEventListener('error', () => { el.hidden = true; });
    return el;
  }

  /** Zweizeilige Überschrift: kleine Zeile, große Zeile. */
  function headline(klein, gross, opt) {
    const o = opt || {};
    return h(o.ebene || 'h1', { class: 'headline' + (o.zentriert ? ' headline--center' : '') },
      klein ? h('span', { class: 'headline__small' }, klein) : null,
      h('span', { class: 'headline__large' }, gross));
  }

  function knopf(text, onclick, variante, attrs) {
    return h('button', Object.assign({
      type: 'button', class: 'btn' + (variante ? ' btn--' + variante.split(' ').join(' btn--') : ''), onclick,
    }, attrs), text);
  }

  /** Der Button, den jede Karte hat. */
  const lieberNicht = (onclick, text) => knopf(text || 'Lieber nicht', onclick, 'text', { 'data-aktion': 'lieber-nicht' });

  function iconKnopf(name, label, onclick) {
    return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, onclick }, icon(name));
  }

  /** Segment-Umschalter. optionen: [{ wert, text, disabled }] */
  function segment(opt) {
    const el = h('div', { class: 'segment', role: 'radiogroup', 'aria-label': opt.label });
    let aktuell = opt.wert;
    const zeichne = () => {
      el.replaceChildren(...opt.optionen.map(o => h('button', {
        type: 'button', class: 'segment__option', role: 'radio',
        'aria-checked': String(o.wert === aktuell), disabled: !!o.disabled,
        onclick: () => {
          if (o.wert === aktuell && !opt.abwaehlbar) return;
          aktuell = o.wert === aktuell ? null : o.wert;
          zeichne();
          opt.onChange(aktuell);
        },
      }, o.text)));
    };
    zeichne();
    el.setze = wert => { aktuell = wert; zeichne(); };
    return el;
  }

  function gruppe(label, inhalt, hinweis) {
    return h('div', { class: 'group' },
      h('span', { class: 'group__label' }, label), inhalt,
      hinweis ? h('p', { class: 'group__hint' }, hinweis) : null);
  }

  /** Kopfzeile. opt: { zurueck: fn, schliessen: fn, titel, rechts: Node } */
  function kopf(opt) {
    const o = opt || {};
    const links = o.zurueck ? iconKnopf('back', 'Zurück', o.zurueck)
      : o.schliessen ? iconKnopf('close', 'Beenden und zurück', o.schliessen) : null;
    return h('header', { class: 'topbar' },
      h('div', { class: 'topbar__slot' }, links),
      h('div', { class: 'topbar__title' }, o.titel || ''),
      h('div', { class: 'topbar__slot topbar__slot--end' }, o.rechts || null));
  }

  /** Listen-Kachel mit Bild, Titel und Beschreibung. */
  function kachel(opt) {
    return h('button', {
      type: 'button', class: 'tile' + (opt.kompakt ? ' tile--compact' : ''),
      disabled: !!opt.gesperrt, onclick: opt.gesperrt ? null : opt.onclick, 'data-id': opt.id,
    },
      opt.bild ? bild(opt.bild, 'tile__image') : null,
      h('span', { class: 'tile__text' },
        h('span', { class: 'tile__title' }, opt.titel),
        opt.text ? h('span', { class: 'tile__desc' }, opt.text) : null,
        opt.marke ? h('span', { class: 'tile__badge' }, opt.marke) : null));
  }

  const dranChip = text => h('div', { class: 'chip', 'data-rolle': 'dran' }, text || Game.dran() + ' ist dran');

  /** Optionales Schreibfeld. Der Inhalt bleibt nur im Eingabefeld und wird nie gespeichert. */
  function schreibfeld(label, opt) {
    const o = opt || {};
    const eingabe = h(o.einzeilig ? 'input' : 'textarea', {
      class: 'field__input', type: o.einzeilig ? 'text' : null, rows: o.einzeilig ? null : '2',
      maxlength: o.max || '200', autocomplete: 'off', autocapitalize: 'sentences', placeholder: o.platzhalter || '',
    });
    const el = h('label', { class: 'field' },
      h('span', { class: 'field__label' }, label), eingabe,
      h('span', { class: 'field__hint' }, 'Nur für diesen Moment – wird nicht gespeichert.'));
    el.eingabe = eingabe;
    return el;
  }

  /** Timer-Ring. Läuft lautlos ab; am Ende ändert sich nur die Anzeige. */
  function timerRing(sekunden, opt) {
    const o = opt || {};
    const R = 54;
    const U = 2 * Math.PI * R;
    const gesamt = sekunden * 1000;
    const wert = svg('circle', { class: 'ring__value', cx: 60, cy: 60, r: R, 'stroke-dasharray': U, 'stroke-dashoffset': 0 });
    const zahl = h('span', {}, String(sekunden));
    const sub = h('span', { class: 'ring__sub' }, 'Sekunden');
    const el = h('div', { class: 'ring', role: 'timer' },
      svg('svg', { class: 'ring__svg', viewBox: '0 0 120 120', 'aria-hidden': 'true' },
        svg('circle', { class: 'ring__track', cx: 60, cy: 60, r: R }), wert),
      h('div', { class: 'ring__label' }, zahl, sub));
    let rest = gesamt;
    let ende = 0;
    let id = null;

    function zeichne() {
      zahl.textContent = String(Math.ceil(rest / 1000));
      wert.setAttribute('stroke-dashoffset', String(U * (1 - rest / gesamt)));
    }
    function tick() {
      rest = Math.max(0, ende - Date.now());
      zeichne();
      if (rest <= 0) {
        clearInterval(id);
        id = null;
        sub.textContent = 'Zeit ist um';
        if (o.onEnde) o.onEnde();
      }
    }
    function start() {
      if (id || rest <= 0) return;
      ende = Date.now() + rest;
      id = setInterval(tick, 200);
      beimVerlassen(stop);
    }
    function stop() {
      if (!id) return;
      clearInterval(id);
      id = null;
      rest = Math.max(0, ende - Date.now());
    }
    return { el, start, stop, laeuft: () => !!id, fertig: () => rest <= 0 };
  }

  /** Ring samt Start/Pause-Knopf, wie ihn Aufgaben und Übungen verwenden. */
  function timerBlock(sekunden, opt) {
    const o = opt || {};
    const schalter = knopf('Timer starten', () => {
      if (ring.laeuft()) { ring.stop(); schalter.textContent = 'Weiter'; }
      else { ring.start(); schalter.textContent = 'Anhalten'; }
    }, 'ghost small', { 'data-aktion': 'timer' });
    const ring = timerRing(sekunden, {
      onEnde: () => { schalter.hidden = true; if (o.onEnde) o.onEnde(); },
    });
    schalter.style.alignSelf = 'center';
    return [ring.el, schalter];
  }

  /* ---- Screen-Verwaltung -------------------------------------------------- */

  const wurzel = () => document.getElementById('app');
  let aufraeumListe = [];

  /** Registriert etwas, das beim Verlassen des Screens gestoppt werden muss (Timer, Sensoren …). */
  function beimVerlassen(fn) { aufraeumListe.push(fn); }

  function aufraeumen() {
    const liste = aufraeumListe;
    aufraeumListe = [];
    liste.forEach(fn => { try { fn(); } catch (_) { /* weiter aufräumen */ } });
  }

  /**
   * Baut einen Screen und zeigt ihn an.
   * opt: { kopf: Node, inhalt: [Nodes], aktionen: [Nodes], zentriert: bool }
   */
  function seite(name, opt) {
    const el = h('section', { class: 'screen screen--' + name, 'data-screen': name },
      opt.kopf || kopf(),
      h('div', { class: 'screen__body' + (opt.zentriert ? ' screen__body--center' : '') }, opt.inhalt),
      opt.aktionen && opt.aktionen.length ? h('footer', { class: 'screen__actions' }, opt.aktionen) : null);
    wurzel().replaceChildren(el);
    window.scrollTo(0, 0);
    return el;
  }

  function fortschritt(anteil) {
    const balken = document.getElementById('progress');
    if (anteil === null || anteil === undefined) { balken.hidden = true; return; }
    const prozent = Math.round(Math.max(0, Math.min(1, anteil)) * 100);
    balken.hidden = false;
    balken.setAttribute('aria-valuenow', String(prozent));
    document.getElementById('progressBar').style.width = prozent + '%';
  }

  /* ---- Navigation --------------------------------------------------------- */

  const routen = {};
  const OHNE_SPIELER = new Set(['start', 'modus', 'ueber']);
  const route = (name, fn) => { routen[name] = fn; };

  function zeige(eintrag) {
    let name = eintrag && eintrag.name;
    const params = (eintrag && eintrag.params) || {};
    if (!routen[name]) name = 'start';
    if (!OHNE_SPIELER.has(name) && !Game.bereit()) name = 'start';
    aufraeumen();
    fortschritt(null);
    if (OHNE_SPIELER.has(name)) { routen[name](params); return; }
    Game.laden().then(() => routen[name](params), () => fehler());
  }

  function gehe(name, params, opt) {
    const eintrag = { name, params: params || {} };
    if (opt && opt.ersetzen) history.replaceState(eintrag, '');
    else history.pushState(eintrag, '');
    zeige(eintrag);
  }

  /** Zurück zum vorherigen Screen (aus einem Spiel heraus: ins Menü bzw. zur Auswahl). */
  function zurueck() {
    if (history.state && history.state.name && history.state.name !== 'start') history.back();
    else gehe('start', {}, { ersetzen: true });
  }

  /** Aktuellen Screen neu aufbauen, z. B. für „Noch eine Runde“. */
  const neuStarten = () => zeige(history.state);

  window.addEventListener('popstate', ereignis => zeige(ereignis.state));

  /* ---- Allgemeine Screens ------------------------------------------------- */

  function fehler() {
    seite('fehler', {
      zentriert: true,
      inhalt: [bild('empty-pause'),
        headline('Das hat nicht geklappt', 'Die Karten fehlen', { zentriert: true }),
        h('p', { class: 'text text--muted text--center' }, 'Die Spielinhalte konnten nicht geladen werden. Prüft kurz eure Verbindung und versucht es noch einmal.')],
      aktionen: [knopf('Noch einmal versuchen', neuStarten), knopf('Zum Anfang', () => gehe('start', {}, { ersetzen: true }), 'ghost')],
    });
  }

  /** Abschluss eines Spiels: ein Dank, kein Ergebnis. */
  function ende(opt) {
    const o = opt || {};
    aufraeumen();
    fortschritt(null);
    seite('ende', {
      kopf: kopf({ schliessen: zurueck }),
      inhalt: [bild('end-danke'),
        headline(o.klein || 'Danke für', o.gross || 'diese Runde', { zentriert: true }),
        h('p', { class: 'text text--muted text--center' }, o.text || 'Schön, dass ihr euch Zeit füreinander genommen habt.')],
      aktionen: [knopf(o.nochmalText || 'Noch eine Runde', o.nochmal || neuStarten),
        knopf(o.zurueckText || 'Zurück zum Menü', zurueck, 'ghost')],
    });
  }

  function leer(text) {
    aufraeumen();
    fortschritt(null);
    seite('leer', {
      kopf: kopf({ zurueck }),
      zentriert: true,
      inhalt: [bild('empty-pause'),
        headline('Gerade liegt hier', 'nichts auf dem Stapel', { zentriert: true }),
        h('p', { class: 'text text--muted text--center' }, text || 'Für eure Auswahl gibt es hier noch keine Karten. Probiert eine andere Stufe oder ein anderes Spiel.')],
      aktionen: [knopf('Zurück', zurueck)],
    });
  }

  /** Pause-Ebene über dem laufenden Spiel. */
  function pause() {
    const schliessen = () => ebene.remove();
    const ebene = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pause' },
      h('section', { class: 'screen screen--pause' },
        kopf(),
        h('div', { class: 'screen__body screen__body--center' },
          bild('empty-pause'),
          headline('Kurze Pause', 'Lasst euch Zeit', { zentriert: true }),
          h('p', { class: 'text text--muted text--center' }, 'Holt euch etwas zu trinken, atmet durch. Die Karte wartet auf euch.')),
        h('footer', { class: 'screen__actions' },
          knopf('Weiterspielen', schliessen),
          knopf('Zum Menü', () => { schliessen(); zurueck(); }, 'ghost'))));
    document.body.appendChild(ebene);
    beimVerlassen(schliessen);
    ebene.querySelector('.btn').focus();
  }
  const pauseKnopf = () => iconKnopf('pause', 'Pause', pause);

  /* ---- Start, Modus, Namen, Menü ------------------------------------------ */

  route('start', () => {
    const z = Game.zustand;
    const bekannt = Game.bereit() && z.namenMerken && z.namen.some(n => n);
    seite('start', {
      kopf: kopf({ rechts: iconKnopf('info', 'Über Monna', () => gehe('ueber')) }),
      inhalt: [bild('hero-start', 'illustration illustration--hero'),
        headline('Ein ruhiges Kartenspiel', 'Monna', { zentriert: true }),
        h('p', { class: 'text text--muted text--center' }, 'Für zwei, die sich Zeit füreinander nehmen. Ein Handy, reihum weitergegeben. Keine Punkte, keine Gewinner.')],
      aktionen: bekannt
        ? [knopf('Weiter mit ' + Game.name(0) + ' & ' + Game.name(1), () => gehe('menu')),
          knopf('Neu beginnen', () => gehe('modus'), 'ghost')]
        : [knopf('Los geht’s', () => gehe('modus'))],
    });
  });

  route('modus', () => {
    seite('modus', {
      kopf: kopf({ zurueck }),
      inhalt: [headline('Wer spielt', 'heute zusammen?'),
        h('div', { class: 'tiles' }, Game.MODI.map(m => kachel({
          id: m.id, titel: m.name, text: m.text, bild: m.bild,
          gesperrt: !m.verfuegbar, marke: m.verfuegbar ? null : 'kommt bald',
          onclick: () => { Game.setModus(m.id); gehe('namen'); },
        })))],
    });
  });

  route('namen', () => {
    const z = Game.zustand;
    const feld = (label, wert) => {
      const eingabe = h('input', {
        class: 'field__input', type: 'text', maxlength: '24', value: wert, placeholder: 'Name',
        autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done',
      });
      const el = h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), eingabe);
      el.eingabe = eingabe;
      return el;
    };
    const a = feld('Erste Person', z.namen[0]);
    const b = feld('Zweite Person', z.namen[1]);
    const merken = h('input', { type: 'checkbox', checked: z.namenMerken });
    const weiter = () => {
      Game.setNamen(a.eingabe.value, b.eingabe.value, merken.checked);
      gehe('menu');
    };
    seite('namen', {
      kopf: kopf({ zurueck }),
      inhalt: [headline('Wie heißt', 'ihr beiden?'),
        h('form', { class: 'group', style: 'gap: var(--space-4)', onsubmit: e => { e.preventDefault(); weiter(); } },
          a, b,
          h('label', { class: 'check' }, merken, h('span', {}, 'Namen auf diesem Gerät merken')),
          h('p', { class: 'text text--muted text--small' }, 'Ohne Haken vergisst Monna eure Namen, sobald ihr die App schließt. Antworten werden nie gespeichert.'),
          h('button', { type: 'submit', hidden: true }))],
      aktionen: [knopf('Weiter', weiter)],
    });
  });

  const KATEGORIEN = [
    { id: 'mix', titel: 'Bunt gemischt', text: 'Wissen, Fragen und Aufgaben im Wechsel', bild: 'cat-mix', ziel: ['runde', { typ: 'mix' }] },
    { id: 'wissen', titel: 'Wissen', text: 'Gemeinsam rätseln, ganz ohne richtig oder falsch', bild: 'cat-wissen', ziel: ['runde', { typ: 'wissen' }] },
    { id: 'fragen', titel: 'Persönliche Fragen', text: 'Erzählen, zuhören, nachfragen', bild: 'cat-fragen', ziel: ['runde', { typ: 'fragen' }] },
    { id: 'aufgaben', titel: 'Aufgaben', text: 'Kleine Dinge zum Tun, manche mit Timer', bild: 'cat-aufgaben', ziel: ['runde', { typ: 'aufgaben' }] },
    { id: 'minispiele', titel: 'Minispiele', text: 'Acht ruhige Übungen für zwei', bild: 'cat-minispiele', ziel: ['minispiele'] },
    { id: 'stirnraten', titel: 'Stirnraten', text: 'Handy an die Stirn und raten, was draufsteht', bild: 'cat-stirnraten', ziel: ['stirnraten'] },
    { id: 'werbinich', titel: 'Wer bin ich?', text: 'Ja-Nein-Fragen ohne Zeitdruck', bild: 'cat-werbinich', ziel: ['werbinich'] },
    { id: 'hku', titel: 'Heiraten, Küssen, Weg damit', text: 'Drei Dinge, drei Entscheidungen, ein Gespräch', bild: 'cat-hku', ziel: ['hku'] },
  ];

  route('menu', () => {
    const z = Game.zustand;
    const modus = Game.MODI.find(m => m.id === z.modus);
    const hinweis = h('p', { class: 'group__hint' });
    const zeigeHinweis = () => { hinweis.textContent = Game.INTENSITAETEN.find(i => i.wert === z.intensitaet).text; };
    zeigeHinweis();
    seite('menu', {
      kopf: kopf({ zurueck, titel: modus.name, rechts: iconKnopf('info', 'Über Monna', () => gehe('ueber')) }),
      inhalt: [headline(Game.name(0) + ' & ' + Game.name(1), 'Worauf habt ihr Lust?'),
        h('div', { class: 'group' },
          h('span', { class: 'group__label' }, 'Wie nah darf es gehen?'),
          segment({
            label: 'Intensität der Karten', wert: z.intensitaet,
            optionen: Game.INTENSITAETEN.map(i => ({ wert: i.wert, text: i.name })),
            onChange: wert => { Game.setIntensitaet(wert); zeigeHinweis(); },
          }),
          hinweis),
        h('div', { class: 'tiles' }, KATEGORIEN.map(k => kachel({
          id: k.id, titel: k.titel, text: k.text, bild: k.bild, onclick: () => gehe(k.ziel[0], k.ziel[1]),
        }))),
        h('div', { class: 'footer-links' },
          knopf('Modus & Namen ändern', () => gehe('modus'), 'text small'),
          knopf('Über Monna', () => gehe('ueber'), 'text small'))],
    });
  });

  /* ---- Über --------------------------------------------------------------- */

  const link = (text, url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text);

  route('ueber', () => {
    seite('ueber', {
      kopf: kopf({ zurueck, titel: 'Über' }),
      inhalt: [headline('Ein paar Worte', 'über Monna'),
        h('div', { class: 'prose' },
          h('p', {}, 'Monna ist ein ruhiges Kartenspiel für gute Freunde und Paare. Ihr gebt ein Handy reihum weiter, lest die Karte und sprecht miteinander. Es gibt keine Punkte, keine Gewinner und keinen Ton.'),
          h('p', {}, 'Auf jeder Karte steht „Lieber nicht“. Niemand muss etwas erklären, wenn er oder sie eine Karte überspringt.'),
          h('h2', {}, 'Eure Daten'),
          h('ul', {},
            h('li', {}, 'Antworten werden nicht gespeichert, auch nicht aus den Schreibfeldern.'),
            h('li', {}, 'Auf dem Gerät liegen nur Einstellungen: Modus, Stufe und – wenn ihr es wollt – eure Namen.'),
            h('li', {}, 'Kein Tracking, keine Werbung, keine Konten. Die App funktioniert offline.')),
          h('h2', {}, 'Quellen und Lizenzen'),
          h('ul', {},
            h('li', {}, 'Wissensfragen: ', link('Open Trivia Database', 'https://opentdb.com'), ', Lizenz ',
              link('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'),
              '. Die Fragen wurden ausgewählt, ins Deutsche übersetzt und bearbeitet; die übersetzte Sammlung steht unter derselben Lizenz.'),
            h('li', {}, 'Schriften: Playfair Display und Inter, beide unter der ',
              link('SIL Open Font License 1.1', 'https://openfontlicense.org'), ', lokal eingebettet.'),
            h('li', {}, 'Alle anderen Karten und Spiele wurden für Monna geschrieben.')),
          h('h2', {}, 'Gut zu wissen'),
          h('p', {}, 'Die Minispiele sind Gesprächsanlässe, keine Therapie und keine Tests. Wenn euch ein Thema belastet, sprecht mit Menschen, denen ihr vertraut, oder holt euch professionelle Unterstützung.'))],
    });
  });

  /* ---- Kartenrunden -------------------------------------------------------- */

  const RUNDEN = {
    mix: { titel: 'Bunt gemischt' },
    wissen: { titel: 'Wissen' },
    fragen: { titel: 'Persönliche Fragen' },
    aufgaben: { titel: 'Aufgaben' },
    satz: { titel: 'Satzanfänge', zurueckText: 'Zurück zur Auswahl' },
  };

  /**
   * Darstellung je Kartenart. Jede Funktion bekommt die Karte und { weiter, aktionen }
   * und liefert die Elemente für den Kartenbereich. `aktionen` ist die Fußzeile.
   */
  const KARTEN = {
    wissen(karte, ctx) {
      const hinweis = h('p', { class: 'headline__small', style: 'font-family: var(--font-serif)', hidden: true }, 'Wusstest du’s?');
      const info = h('p', { class: 'card__note', hidden: true }, karte.info || '');
      const antworten = Game.antworten(karte);
      const liste = h('div', { class: 'answers' });
      const knoepfe = antworten.map(a => h('button', {
        type: 'button', class: 'answer', 'data-richtig': a.richtig ? '1' : null,
        onclick: () => aufloesen(a),
      }, h('span', {}, a.text)));
      liste.append(...knoepfe);

      function aufloesen(tipp) {
        antworten.forEach((a, i) => {
          knoepfe[i].disabled = true;
          if (a.richtig) {
            knoepfe[i].classList.add('answer--loesung');
            knoepfe[i].append(h('span', { class: 'answer__tag' }, 'Auflösung'));
          } else if (a === tipp) {
            knoepfe[i].classList.add('answer--tipp');
            knoepfe[i].append(h('span', { class: 'answer__tag' }, 'euer Tipp'));
          }
        });
        hinweis.hidden = false;
        info.hidden = !karte.info;
        ctx.aktionen.replaceChildren(knopf('Weiter', ctx.weiter, null, { 'data-aktion': 'weiter' }));
      }

      return [h('div', { class: 'card' },
        h('span', { class: 'card__kicker' }, karte.kategorie || 'Wissen'),
        h('p', { class: 'card__text' }, karte.frage)),
      hinweis, liste, info];
    },

    fragen(karte) {
      return [h('div', { class: 'card card--grow' },
        h('span', { class: 'card__kicker' }, karte.thema || 'Persönliche Frage'),
        h('p', { class: 'card__text' }, Game.einsetzen(karte.text)),
        h('p', { class: 'card__note' }, Game.andere() + ' hört zu und darf nachfragen.'))];
    },

    aufgaben(karte) {
      return [h('div', { class: 'card' + (karte.dauer ? '' : ' card--grow') },
        h('span', { class: 'card__kicker' }, karte.dauer ? 'Aufgabe mit Timer' : 'Aufgabe'),
        h('p', { class: 'card__text' }, Game.einsetzen(karte.text)))]
        .concat(karte.dauer ? timerBlock(karte.dauer) : []);
    },

    satz(karte) {
      return [h('div', { class: 'card' },
        h('span', { class: 'card__kicker' }, 'Satzanfang'),
        h('p', { class: 'card__text' }, Game.einsetzen(karte.text)),
        h('p', { class: 'card__note' }, 'Sprich den Satz laut zu Ende. Der erste Gedanke zählt.')),
      schreibfeld('Wer mag, schreibt den Satz erst auf (optional)')];
    },
  };

  const WEITER_TEXT = { fragen: 'Weiter', aufgaben: 'Geschafft', satz: 'Weiter' };

  route('runde', params => {
    const typ = RUNDEN[params.typ] ? params.typ : 'mix';
    const def = RUNDEN[typ];
    const laenge = Game.RUNDENLAENGE;
    const folge = typ === 'mix' ? Game.mixFolge(laenge) : null;
    let index = 0;

    function karteZeigen() {
      const art = folge ? folge[index] : typ;
      const karte = art ? Game.ziehen(art) : null;
      if (!karte) { leer(); return; }
      aufraeumen();
      fortschritt(index / laenge);

      const aktionen = h('footer', { class: 'screen__actions' });
      const weiter = () => {
        index += 1;
        Game.wechseln();
        if (index >= laenge) {
          aufraeumen();
          ende({ zurueckText: def.zurueckText });
        } else karteZeigen();
      };
      // „Lieber nicht“: neue Karte für dieselbe Person, ohne Nachfrage.
      const ueberspringen = () => karteZeigen();

      const inhalt = KARTEN[art](karte, { weiter, aktionen });
      if (WEITER_TEXT[art]) aktionen.append(knopf(WEITER_TEXT[art], weiter, null, { 'data-aktion': 'weiter' }));
      aktionen.append(lieberNicht(ueberspringen));

      const el = seite('karte', {
        kopf: kopf({ schliessen: zurueck, titel: def.titel, rechts: pauseKnopf() }),
        inhalt: [dranChip()].concat(inhalt),
      });
      el.setAttribute('data-kartenart', art);
      el.setAttribute('data-karten-id', karte.id);
      el.append(aktionen);
    }

    karteZeigen();
  });

  /* ---- Start der App ------------------------------------------------------- */

  function serviceWorkerAnmelden() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus geht es auch */ });
    });
  }

  function starten() {
    Game.einstellungenLaden();
    history.replaceState({ name: 'start', params: {} }, '');
    zeige(history.state);
    Game.laden().catch(() => { /* Fehler zeigt sich beim Öffnen eines Spiels */ });
  }

  global.Monna.UI = {
    h, svg, icon, bild, headline, knopf, lieberNicht, iconKnopf, segment, gruppe, kopf, kachel,
    dranChip, schreibfeld, timerRing, timerBlock,
    seite, fortschritt, beimVerlassen, aufraeumen,
    route, gehe, zurueck, neuStarten, ende, leer, pause, pauseKnopf,
  };

  serviceWorkerAnmelden();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
})(window);
