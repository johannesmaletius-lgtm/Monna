/* Monna – Minispiele, Stirnraten, Wer bin ich? und Heiraten/Küssen/Weg damit.
 *
 * Alle Spiele sind Gesprächsanlässe: keine Punkte, kein Vergleich, kein Ton.
 * Was in Schreibfelder getippt wird, lebt nur in Variablen dieses Screens und
 * ist beim nächsten Schritt wieder weg.
 */
(function (global) {
  'use strict';

  const Game = global.Monna.Game;
  const UI = global.Monna.UI;
  const {
    h, svg, bild, headline, knopf, lieberNicht, segment, kopf, kachel, dranChip, schreibfeld,
    timerBlock, timerRing, seite, fortschritt, beimVerlassen, route, gehe, zurueck, ende, leer, pauseKnopf,
  } = UI;

  const mini = () => Game.daten.minispiele;
  const zufall = liste => liste[Math.floor(Math.random() * liste.length)];
  const text = (inhalt, klasse) => h('p', { class: klasse || 'text text--muted' }, inhalt);
  const ZURUECK_AUSWAHL = 'Zurück zur Auswahl';

  /** Ein Schritt innerhalb eines Spiels: räumt den vorherigen auf und zeigt den neuen. */
  function schritt(name, titel, opt) {
    UI.aufraeumen();
    return seite(name, Object.assign({ kopf: kopf({ schliessen: zurueck, titel, rechts: pauseKnopf() }) }, opt));
  }

  /** Bildschirm wach halten, solange ein Spiel läuft, bei dem niemand tippt. */
  function wachBleiben() {
    let sperre = null;
    let aktiv = true;
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(s => { if (aktiv) sperre = s; else s.release(); }, () => {});
    }
    beimVerlassen(() => { aktiv = false; if (sperre) sperre.release().catch(() => {}); });
  }

  /* ======================================================================
     Übersicht der Minispiele
     ====================================================================== */

  const SPIELE = [
    { id: 'assoziation', titel: 'Wort-Assoziation', text: 'Ein Wort, ein Countdown, zwei erste Gedanken', bild: 'game-assoziation', ziel: ['assoziation'] },
    { id: 'geschichte', titel: 'Gedankengeschichte', text: 'Schritt für Schritt durch ein inneres Bild', bild: 'game-geschichte', ziel: ['geschichte'] },
    { id: 'satz', titel: 'Satzanfänge', text: 'Einen Satz laut zu Ende sprechen', bild: 'game-satzanfaenge', ziel: ['runde', { typ: 'satz' }] },
    { id: 'gefuehlsrad', titel: 'Gefühlsrad', text: 'Ein Wort finden für das, was gerade da ist', bild: 'game-gefuehlsrad', ziel: ['gefuehlsrad'] },
    { id: 'rosedornknospe', titel: 'Rose, Dorn, Knospe', text: 'Etwas Schönes, etwas Schweres, etwas Neues', bild: 'game-rosedornknospe', ziel: ['rosedornknospe'] },
    { id: 'spiegeln', titel: 'Spiegeln', text: 'Erzählen, zuhören, in eigenen Worten wiedergeben', bild: 'game-spiegeln', ziel: ['spiegeln'] },
    { id: 'atem', titel: 'Atem zu zweit', text: 'Eine Minute gemeinsam ruhig atmen', bild: 'game-atem', ziel: ['atem'] },
    { id: 'zukunftsbild', titel: 'Zukunftsbild', text: 'Sich ausmalen, was kommen darf', bild: 'game-zukunftsbild', ziel: ['zukunftsbild'] },
  ];

  route('minispiele', () => {
    seite('minispiele', {
      kopf: kopf({ zurueck, titel: 'Minispiele' }),
      inhalt: [headline('Ruhige Übungen', 'für euch zwei'),
        h('div', { class: 'tiles' }, SPIELE.map(s => kachel({
          id: s.id, titel: s.titel, text: s.text, bild: s.bild, kompakt: true, onclick: () => gehe(s.ziel[0], s.ziel[1]),
        })))],
    });
  });

  /* ======================================================================
     Geführte Schritte (Gedankengeschichte, Zukunftsbild)
     ====================================================================== */

  /**
   * Zeigt Texte Schritt für Schritt.
   * opt: { titel, schritte: [{ kicker, text, notiz, extra }], fertig(ausgelassen: Set<number>) }
   */
  function gefuehrt(opt) {
    const ausgelassen = new Set();
    let i = 0;
    const zeigen = () => {
      if (i >= opt.schritte.length) { fortschritt(null); opt.fertig(ausgelassen); return; }
      const s = opt.schritte[i];
      fortschritt(i / opt.schritte.length);
      const weiter = () => { i += 1; zeigen(); };
      schritt('schritt', opt.titel, {
        inhalt: [
          h('span', { class: 'step-count' }, 'Schritt ' + (i + 1) + ' von ' + opt.schritte.length),
          h('div', { class: 'card card--grow' },
            s.kicker ? h('span', { class: 'card__kicker' }, s.kicker) : null,
            h('p', { class: 'card__text' }, Game.einsetzen(s.text)),
            s.notiz ? h('p', { class: 'card__note' }, Game.einsetzen(s.notiz)) : null),
          s.extra ? s.extra() : null],
        aktionen: [knopf('Weiter', weiter, null, { 'data-aktion': 'weiter' }),
          lieberNicht(() => { ausgelassen.add(i); weiter(); })],
      });
    };
    zeigen();
  }

  /* ---- Gedankengeschichte -------------------------------------------------- */

  route('geschichte', params => {
    const alle = mini().geschichten;
    const geschichte = alle.find(g => g.id === params.id);

    if (!geschichte) {
      seite('geschichte-auswahl', {
        kopf: kopf({ zurueck, titel: 'Gedankengeschichte' }),
        inhalt: [headline('Drei innere Bilder', 'Wohin soll es gehen?'),
          text('Eine Person liest vor, beide beschreiben, was sie vor sich sehen. Am Ende gibt es, wenn ihr mögt, eine verspielte Deutung.'),
          h('div', { class: 'tiles' }, alle.map(g => kachel({
            id: g.id, titel: g.titel, text: g.text, bild: g.bild, onclick: () => gehe('geschichte', { id: g.id }),
          })))],
      });
      return;
    }

    const deutung = ausgelassen => {
      const zeilen = geschichte.schritte.filter((_, i) => !ausgelassen.has(i));
      schritt('deutung', geschichte.titel, {
        inhalt: [headline('Eine mögliche Lesart', 'Was es bedeuten könnte'),
          h('ul', { class: 'prose', style: 'gap: var(--space-4)' }, zeilen.map(s => h('li', {},
            h('span', { class: 'card__kicker' }, s.stichwort), h('p', {}, s.deutung)))),
          text('Das ist ein Gesprächsanlass, kein Test. Was davon passt für euch – und was überhaupt nicht?')],
        aktionen: [knopf('Fertig', abschluss)],
      });
    };
    const abschluss = () => ende({ klein: 'Danke fürs', gross: 'Mitkommen', zurueckText: ZURUECK_AUSWAHL });

    const erzaehlen = () => gefuehrt({
      titel: geschichte.titel,
      schritte: geschichte.schritte.map(s => ({
        kicker: s.stichwort, text: s.text, notiz: 'Schließt kurz die Augen. Erst erzählt {dran}, dann {andere}.',
      })),
      fertig: ausgelassen => {
        if (ausgelassen.size === geschichte.schritte.length) { abschluss(); return; }
        schritt('deutung-frage', geschichte.titel, {
          zentriert: true,
          inhalt: [bild(geschichte.bild),
            headline('Ihr seid angekommen', 'Mögt ihr eine Deutung?', { zentriert: true }),
            h('p', { class: 'text text--muted text--center' }, 'Zu jedem Bild gibt es eine verspielte Lesart. Ihr könnt sie ansehen oder eure Bilder einfach so stehen lassen.')],
          aktionen: [knopf('Deutung ansehen', () => deutung(ausgelassen)), knopf('Ohne Deutung beenden', abschluss, 'ghost')],
        });
      },
    });

    schritt('geschichte', 'Gedankengeschichte', {
      zentriert: true,
      inhalt: [bild(geschichte.bild),
        headline('Gedankengeschichte', geschichte.titel, { zentriert: true }),
        h('p', { class: 'text text--muted text--center' }, Game.einsetzen('{dran} liest jeden Schritt laut vor. Dann beschreibt ihr beide, was ihr vor euch seht. Es gibt kein Richtig und kein Falsch.'))],
      aktionen: [knopf('Beginnen', erzaehlen), lieberNicht(zurueck, 'Lieber eine andere Geschichte')],
    });
  });

  /* ---- Zukunftsbild --------------------------------------------------------- */

  route('zukunftsbild', params => {
    const alle = mini().zukunftsbild.filter(Game.passtModus);
    const bildDef = alle.find(z => z.id === params.id);

    if (!bildDef) {
      if (!alle.length) { leer(); return; }
      seite('zukunft-auswahl', {
        kopf: kopf({ zurueck, titel: 'Zukunftsbild' }),
        inhalt: [bild('game-zukunftsbild', 'illustration illustration--small'),
          headline('Ein Blick nach vorn', 'Welches Bild malt ihr?'),
          h('div', { class: 'tiles' }, alle.map(z => kachel({
            id: z.id, titel: z.titel, text: z.text, onclick: () => gehe('zukunftsbild', { id: z.id }),
          })))],
      });
      return;
    }

    const letzter = bildDef.schritte.length - 1;
    gefuehrt({
      titel: bildDef.titel,
      schritte: bildDef.schritte.map((s, i) => ({
        text: s, notiz: 'Lasst euch Zeit. Erst erzählt {dran}, dann {andere}.',
        extra: i === letzter ? () => schreibfeld('Ein Satz für euer Bild (optional)') : null,
      })),
      fertig: () => ende({
        klein: 'Ein schönes Bild', gross: 'Haltet es fest', zurueckText: ZURUECK_AUSWAHL,
        text: 'Vielleicht mögt ihr euch gegenseitig sagen, worauf ihr euch am meisten freut.',
      }),
    });
  });

  /* ======================================================================
     Wort-Assoziation
     ====================================================================== */

  route('assoziation', () => {
    const cfg = mini().assoziation;
    const woerter = cfg.woerter.filter(Game.passtModus);
    const RUNDE = 5;
    let nummer = 0;
    if (!woerter.length) { leer(); return; }

    function neuesWort() {
      if (nummer >= RUNDE) { ende({ zurueckText: ZURUECK_AUSWAHL }); return; }
      const wort = Game.ziehen('assoziation', woerter).wort;
      const erste = Game.zustand.dran;
      const eingaben = ['', ''];
      fortschritt(nummer / RUNDE);

      const person = index => {
        const feld = schreibfeld('Dein erstes Wort (optional)', { einzeilig: true, max: '40' });
        const ring = timerRing(cfg.sekunden);
        const fertig = () => {
          eingaben[index] = feld.eingabe.value.trim();
          if (index === erste) uebergabe(); else vergleich();
        };
        schritt('assoziation', 'Wort-Assoziation', {
          inhalt: [dranChip(Game.name(index) + ' ist dran'),
            h('p', { class: 'word', 'data-rolle': 'wort' }, wort),
            ring.el,
            text('Sag oder schreib das Erste, was dir einfällt. Nicht lange überlegen.', 'text text--muted text--center'),
            feld],
          aktionen: [knopf('Weiter', fertig, null, { 'data-aktion': 'weiter' }), lieberNicht(neuesWort, 'Lieber ein anderes Wort')],
        });
        ring.start();
      };

      const uebergabe = () => schritt('uebergabe', 'Wort-Assoziation', {
        zentriert: true,
        inhalt: [headline('Handy weitergeben', 'Jetzt ' + Game.name(1 - erste), { zentriert: true }),
          h('p', { class: 'text text--muted text--center' }, Game.name(erste) + ', behalte dein Wort noch für dich. Gleich erscheint dasselbe Wort noch einmal.')],
        aktionen: [knopf(Game.name(1 - erste) + ' ist bereit', () => person(1 - erste), null, { 'data-aktion': 'weiter' })],
      });

      const zelle = index => h('div', { class: 'compare__cell' },
        h('span', { class: 'compare__name' }, Game.name(index)),
        h('span', { class: 'compare__word' }, eingaben[index] || '… erzählt es selbst'));

      const vergleich = () => {
        schritt('vergleich', 'Wort-Assoziation', {
          inhalt: [h('span', { class: 'step-count' }, 'Euer Wort'),
            h('p', { class: 'word' }, wort),
            h('div', { class: 'compare' }, zelle(0), zelle(1)),
            text('Erzählt euch, wie ihr auf eure Wörter gekommen seid. Wo berühren sie sich, wo gehen sie auseinander?', 'text text--muted text--center')],
          aktionen: [knopf('Nächstes Wort', () => { nummer += 1; Game.wechseln(); neuesWort(); }, null, { 'data-aktion': 'weiter' })],
        });
        eingaben[0] = eingaben[1] = '';   // nichts aufbewahren
      };

      person(erste);
    }

    neuesWort();
  });

  /* ======================================================================
     Gefühlsrad
     ====================================================================== */

  /** Baut das Rad als SVG. onWahl(index) wird beim Antippen eines Bereichs aufgerufen. */
  function rad(gefuehle, onWahl) {
    const R = 100;
    const r = 30;
    const n = gefuehle.length;
    const punkt = (radius, winkel) => (radius * Math.sin(winkel)).toFixed(2) + ' ' + (-radius * Math.cos(winkel)).toFixed(2);
    const segmente = svg('g', {});
    const labels = svg('g', {});
    const teile = gefuehle.map((g, i) => {
      const a0 = (i / n) * 2 * Math.PI;
      const a1 = ((i + 1) / n) * 2 * Math.PI;
      const pfad = svg('path', {
        class: 'wheel__segment', role: 'button', tabindex: '0', 'aria-label': g.name, 'aria-pressed': 'false', 'data-gefuehl': g.name,
        d: 'M' + punkt(r, a0) + ' L' + punkt(R, a0) + ' A' + R + ' ' + R + ' 0 0 1 ' + punkt(R, a1) +
          ' L' + punkt(r, a1) + ' A' + r + ' ' + r + ' 0 0 0 ' + punkt(r, a0) + ' Z',
      });
      const grad = ((i + 0.5) / n) * 360;
      const unten = grad > 90 && grad < 270;
      const label = svg('text', {
        class: 'wheel__label', 'text-anchor': 'middle', 'dominant-baseline': 'central',
        transform: 'rotate(' + grad + ') translate(0 -72)' + (unten ? ' rotate(180)' : ''),
      }, g.name);
      const waehlen = () => {
        teile.forEach(t => { t.pfad.setAttribute('aria-pressed', 'false'); t.label.setAttribute('class', 'wheel__label'); });
        pfad.setAttribute('aria-pressed', 'true');
        label.setAttribute('class', 'wheel__label wheel__label--active');
        onWahl(i);
      };
      pfad.addEventListener('click', waehlen);
      pfad.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); waehlen(); } });
      segmente.append(pfad);
      labels.append(label);
      return { pfad, label };
    });
    return h('div', { class: 'wheel' },
      svg('svg', { viewBox: '-104 -104 208 208', role: 'group', 'aria-label': 'Gefühlsrad' },
        segmente, labels, svg('circle', { class: 'wheel__hub', r: r - 6 })));
  }

  route('gefuehlsrad', () => {
    const cfg = mini().gefuehlsrad;
    let runde = 0;

    function waehlen() {
      if (runde >= 2) { ende({ klein: 'Danke fürs', gross: 'Hinspüren', zurueckText: ZURUECK_AUSWAHL }); return; }
      fortschritt(runde / 2);
      const feiner = h('div', { class: 'chips chips--center', role: 'radiogroup', 'aria-label': 'Genaueres Gefühl' });
      const hinweis = text('Tippe auf den Bereich, der am ehesten passt.', 'text text--muted text--center');
      const weiter = knopf('Weiter', () => zeigen(gewaehlt), null, { 'data-aktion': 'weiter', disabled: true });
      let gewaehlt = null;

      const radEl = rad(cfg.gefuehle, index => {
        gewaehlt = null;
        weiter.disabled = true;
        hinweis.textContent = 'Und genauer? Wähle das Wort, das am besten trifft.';
        feiner.replaceChildren(...cfg.gefuehle[index].feiner.map(wort => h('button', {
          type: 'button', class: 'chip-btn', role: 'radio', 'aria-checked': 'false',
          onclick: e => {
            feiner.querySelectorAll('.chip-btn').forEach(b => b.setAttribute('aria-checked', 'false'));
            e.currentTarget.setAttribute('aria-checked', 'true');
            gewaehlt = wort;
            weiter.disabled = false;
          },
        }, wort)));
      });

      schritt('gefuehlsrad', 'Gefühlsrad', {
        inhalt: [dranChip(), headline('Gefühlsrad', 'Wie geht es dir gerade?'), radEl, hinweis, feiner],
        aktionen: [weiter, lieberNicht(naechste)],
      });
    }

    function zeigen(wort) {
      schritt('gefuehl', 'Gefühlsrad', {
        inhalt: [dranChip(),
          h('div', { class: 'card card--grow' },
            h('span', { class: 'card__kicker' }, Game.dran() + ' fühlt sich gerade'),
            h('p', { class: 'card__text card__text--large' }, wort),
            h('p', { class: 'card__text', style: 'font-size: var(--text-l)' }, zufall(cfg.impulse)),
            h('p', { class: 'card__note' }, Game.andere() + ' hört zu. Gefühle müssen nicht erklärt oder gelöst werden.'))],
        aktionen: [knopf('Weiter', naechste, null, { 'data-aktion': 'weiter' })],
      });
    }

    function naechste() { runde += 1; Game.wechseln(); waehlen(); }

    waehlen();
  });

  /* ======================================================================
     Rose, Dorn, Knospe
     ====================================================================== */

  route('rosedornknospe', () => {
    const teile = mini().rosedornknospe.teile;
    let i = 0;
    const zeigen = () => {
      if (i >= teile.length) {
        ende({ klein: 'Rose, Dorn, Knospe', gross: 'Danke fürs Teilen', zurueckText: ZURUECK_AUSWAHL });
        return;
      }
      const teil = teile[i];
      fortschritt(i / teile.length);
      const weiter = () => { i += 1; Game.wechseln(); zeigen(); };
      schritt('rdk', 'Rose, Dorn, Knospe', {
        inhalt: [h('span', { class: 'step-count' }, (i + 1) + ' von ' + teile.length),
          bild('game-rosedornknospe', 'illustration illustration--small'),
          headline(teil.untertitel, teil.titel, { zentriert: true }),
          h('div', { class: 'card card--grow', 'data-teil': teil.id },
            h('p', { class: 'card__text' }, zufall(teil.fragen)),
            h('p', { class: 'card__note' }, Game.einsetzen('Erst erzählt {dran}, dann {andere}. Zuhören genügt – niemand muss etwas lösen.')))],
        aktionen: [knopf('Weiter', weiter, null, { 'data-aktion': 'weiter' }), lieberNicht(weiter)],
      });
    };
    zeigen();
  });

  /* ======================================================================
     Spiegeln
     ====================================================================== */

  route('spiegeln', () => {
    const cfg = mini().spiegeln;
    const themen = Game.filtern(cfg.themen);
    if (!themen.length) { leer(); return; }
    const GESAMT = 8;
    let position = 0;      // 0–7 über beide Durchgänge
    let durchgang = 0;

    function thema() {
      if (durchgang >= 2) { ende({ klein: 'Gehört und', gross: 'verstanden', zurueckText: ZURUECK_AUSWAHL }); return; }
      const sprecher = Game.dran();
      const zuhoerer = Game.andere();
      const karte = Game.ziehen('spiegeln', themen);
      position = durchgang * 4;
      fortschritt(position / GESAMT);

      const folge = [
        () => ({
          chip: sprecher + ' erzählt',
          karte: [h('span', { class: 'card__kicker' }, 'Dein Thema'), h('p', { class: 'card__text' }, karte.text),
            h('p', { class: 'card__note' }, zuhoerer + ' hört nur zu: kein Kommentar, kein Rat, keine eigene Geschichte.')],
          extra: timerBlock(cfg.sekunden),
        }),
        () => ({
          chip: zuhoerer + ' spiegelt',
          karte: [h('span', { class: 'card__kicker' }, 'In eigenen Worten'), h('p', { class: 'card__text' }, '„Ich habe gehört, dass …“'),
            h('p', { class: 'card__note' }, 'Gib wieder, was bei dir angekommen ist. Ohne Deutung und ohne Bewertung.')],
        }),
        () => ({
          chip: sprecher + ' ergänzt',
          karte: [h('span', { class: 'card__kicker' }, 'Nachspüren'), h('p', { class: 'card__text' }, 'Fühlst du dich verstanden?'),
            h('p', { class: 'card__note' }, 'Ergänze, was noch fehlt – oder sag einfach Danke.')],
        }),
      ];

      const vorstellen = () => schritt('spiegeln-thema', 'Spiegeln', {
        inhalt: [dranChip(sprecher + ' ist dran'),
          h('div', { class: 'card card--grow' },
            h('span', { class: 'card__kicker' }, 'Worüber magst du erzählen?'),
            h('p', { class: 'card__text' }, karte.text),
            h('p', { class: 'card__note' }, 'Du erzählst eine Minute lang. Danach gibt ' + zuhoerer + ' wieder, was angekommen ist.'))],
        aktionen: [knopf('Das passt', () => teil(0), null, { 'data-aktion': 'weiter' }), lieberNicht(thema, 'Lieber ein anderes Thema')],
      });

      const teil = index => {
        if (index >= folge.length) { durchgang += 1; Game.wechseln(); thema(); return; }
        const t = folge[index]();
        fortschritt((position + 1 + index) / GESAMT);
        const weiter = () => teil(index + 1);
        schritt('spiegeln', 'Spiegeln', {
          inhalt: [dranChip(t.chip), h('div', { class: 'card' + (t.extra ? '' : ' card--grow') }, t.karte)].concat(t.extra || []),
          aktionen: [knopf('Weiter', weiter, null, { 'data-aktion': 'weiter' }), lieberNicht(weiter)],
        });
      };

      vorstellen();
    }

    thema();
  });

  /* ======================================================================
     Atem zu zweit
     ====================================================================== */

  route('atem', () => {
    const cfg = mini().atem;

    function atmen() {
      const kreis = h('div', { class: 'breath__circle' });
      const partner = h('div', { class: 'breath__circle breath__circle--partner' });
      const label = h('span', { class: 'breath__label', 'aria-live': 'polite' }, 'Gleich geht es los');
      const zaehler = h('p', { class: 'text text--muted text--center' }, cfg.atemzuege + ' Atemzüge');
      let zug = 0;
      let timer = null;

      schritt('atem', 'Atem zu zweit', {
        zentriert: true,
        inhalt: [h('div', { class: 'breath' }, h('div', { class: 'breath__outline' }), partner, kreis, label), zaehler],
        aktionen: [lieberNicht(zurueck, 'Beenden')],
      });
      wachBleiben();
      beimVerlassen(() => clearTimeout(timer));

      const phase = (name, sekunden, groesse, danach) => {
        label.textContent = name;
        [kreis, partner].forEach(k => {
          k.style.transitionDuration = sekunden + 's';
          k.style.transform = 'scale(' + groesse + ')';
        });
        kreis.setAttribute('data-phase', name);
        timer = setTimeout(danach, sekunden * 1000);
      };
      const einatmen = () => {
        if (zug >= cfg.atemzuege) {
          ende({
            klein: 'Angekommen', gross: 'Wie fühlt es sich an?', nochmalText: 'Noch einmal atmen', zurueckText: ZURUECK_AUSWAHL,
            text: 'Bleibt noch einen Moment so. Wenn ihr mögt, sagt euch ein Wort dazu.',
          });
          return;
        }
        zug += 1;
        zaehler.textContent = 'Atemzug ' + zug + ' von ' + cfg.atemzuege;
        phase('Einatmen', cfg.einatmen, 1, () => phase('Ausatmen', cfg.ausatmen, 0.4, einatmen));
      };
      timer = setTimeout(einatmen, 1200);
    }

    schritt('atem-start', 'Atem zu zweit', {
      zentriert: true,
      inhalt: [bild('game-atem'),
        headline('Atem zu zweit', 'Kommt gemeinsam an', { zentriert: true }),
        h('p', { class: 'text text--muted text--center' },
          'Setzt euch bequem hin, gern Rücken an Rücken oder Hand in Hand. Der Kreis wächst beim Einatmen und wird kleiner beim Ausatmen. ' +
          cfg.atemzuege + ' Atemzüge, etwa eine Minute.')],
      aktionen: [knopf('Beginnen', atmen, null, { 'data-aktion': 'weiter' }), lieberNicht(zurueck)],
    });
  });

  /* ======================================================================
     Stirnraten
     ====================================================================== */

  /** null = noch nicht gefragt, true = Neigen erlaubt, false = nur Tippen */
  let neigenErlaubt = null;

  /** Fragt einmalig die Freigabe für die Bewegungssensoren an (nötig auf iOS). */
  function neigenAnfragen() {
    if (neigenErlaubt !== null) return Promise.resolve(neigenErlaubt);
    const D = window.DeviceOrientationEvent;
    if (!D) { neigenErlaubt = false; return Promise.resolve(false); }
    if (typeof D.requestPermission !== 'function') { neigenErlaubt = true; return Promise.resolve(true); }
    return D.requestPermission().then(antwort => antwort === 'granted', () => false)
      .then(ok => { neigenErlaubt = ok; return ok; });
  }

  /**
   * Wie stark zeigt der Bildschirm nach oben (+1) oder unten (−1)?
   * Das ist die z-Komponente der Schwerkraft im Gerätesystem. Sie hängt nicht
   * davon ab, in welche Richtung das Handy quer gedreht wurde.
   */
  function bildschirmNeigung(ereignis) {
    if (ereignis.beta === null || ereignis.gamma === null) return null;
    const rad = Math.PI / 180;
    return Math.cos(ereignis.beta * rad) * Math.cos(ereignis.gamma * rad);
  }
  const NEIGUNG_AUSLOESEN = 0.55;   // etwa 35° aus der Senkrechten
  const NEIGUNG_NEUTRAL = 0.3;

  /** Schrift so groß wie möglich, ohne dass der Begriff aus dem Kasten läuft. */
  function einpassen(el, kasten) {
    let min = 24;
    let max = 220;
    while (max - min > 2) {
      const mitte = (min + max) / 2;
      el.style.fontSize = mitte + 'px';
      // etwas Luft lassen, damit Unterlängen und Ränder frei bleiben
      const passt = Math.max(el.scrollWidth, el.offsetWidth) <= kasten.clientWidth * 0.92 &&
        el.offsetHeight <= kasten.clientHeight * 0.86;
      if (passt) min = mitte; else max = mitte;
    }
    el.style.fontSize = min + 'px';
  }

  route('stirnraten', () => {
    const cfg = Game.daten.stirnraten;
    const kategorien = cfg.kategorien.filter(Game.passtModus);
    if (!kategorien.length) { leer(); return; }
    let kategorie = kategorien[0];
    let sekunden = cfg.sekunden[0];

    function vorbereiten() {
      const rater = Game.dran();
      const hinweis = text('', 'text text--muted text--small');
      const zeigeHinweis = () => {
        hinweis.textContent = neigenErlaubt === false
          ? 'Neigen ist auf diesem Gerät nicht freigegeben. Tippt stattdessen auf „Erraten“ oder „Weiter“.'
          : 'Beim ersten Start fragt dein Handy, ob Monna die Bewegung erkennen darf. Ohne Freigabe spielt ihr einfach mit Tippen.';
      };
      zeigeHinweis();
      schritt('stirnraten', 'Stirnraten', {
        inhalt: [dranChip(rater + ' rät'),
          headline('Stirnraten', 'Was steht auf deiner Stirn?'),
          UI.gruppe('Kategorie', h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Kategorie' },
            kategorien.map(k => h('button', {
              type: 'button', class: 'chip-btn', role: 'radio', 'aria-checked': String(k === kategorie), 'data-kategorie': k.id,
              onclick: e => {
                kategorie = k;
                e.currentTarget.parentNode.querySelectorAll('.chip-btn').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget)));
              },
            }, k.name)))),
          UI.gruppe('Zeit pro Runde', segment({
            label: 'Zeit pro Runde', wert: sekunden,
            optionen: cfg.sekunden.map(s => ({ wert: s, text: s + ' Sek.' })),
            onChange: wert => { sekunden = wert; },
          })),
          h('ol', { class: 'prose', style: 'padding-left: var(--space-4); list-style: decimal' },
            h('li', {}, 'Halte das Handy quer an deine Stirn, der Bildschirm zeigt zu ' + Game.andere() + '.'),
            h('li', {}, Game.andere() + ' umschreibt den Begriff, ohne ihn zu nennen.'),
            h('li', {}, 'Erraten: Handy nach unten neigen. Weiter zum nächsten Begriff: nach oben neigen. Tippen geht immer.')),
          hinweis],
        aktionen: [knopf('Bereit', () => neigenAnfragen().then(spielen), null, { 'data-aktion': 'weiter' }),
          lieberNicht(beenden, 'Stirnraten beenden')],
      });
    }

    function spielen() {
      UI.aufraeumen();
      const begriffe = kategorie.begriffe.map(b => ({ id: b, wort: b }));
      const ergebnis = [];            // { wort, erraten } – nur für die Anzeige am Rundenende
      let phase = 'bereit';           // bereit → countdown → spiel → pause (kurze Rückmeldung)
      let aktuell = null;
      let endzeit = 0;
      let scharf = false;             // Neigen löst erst aus, wenn das Handy einmal gerade war
      const timer = [];

      const zeit = h('span', { class: 'stirn__time' }, String(sekunden));
      const balken = h('i', {});
      const begriff = h('div', { class: 'stirn__term', 'data-rolle': 'begriff' });
      const mitte = h('div', { class: 'stirn__main' }, begriff);
      const zonen = h('div', { class: 'stirn__zones' });
      const buehne = h('div', { class: 'stirn__stage' },
        h('div', { class: 'stirn__top' }, zeit, h('div', { class: 'stirn__timebar' }, balken),
          h('button', { type: 'button', class: 'stirn__close', onclick: () => abbrechen() }, 'Abbrechen')),
        mitte, zonen);
      const ebene = h('div', { class: 'stirn', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Stirnraten' }, buehne);

      const zeigeText = (inhalt, alsHinweis) => {
        begriff.className = alsHinweis ? 'stirn__hint' : 'stirn__term';
        begriff.style.fontSize = '';
        begriff.textContent = inhalt;
        if (!alsHinweis) einpassen(begriff, mitte);
      };
      const zone = (inhalt, onclick, primaer, aktion) => h('button', {
        type: 'button', class: 'stirn__zone' + (primaer ? ' stirn__zone--primary' : ''), onclick, 'data-aktion': aktion,
      }, inhalt);

      function naechster() {
        aktuell = Game.ziehen('stirn:' + kategorie.id, begriffe).wort;
        buehne.className = 'stirn__stage';
        zeigeText(aktuell);
        phase = 'spiel';
      }
      function melden(erraten) {
        if (phase !== 'spiel') return;
        phase = 'pause';
        scharf = false;
        ergebnis.push({ wort: aktuell, erraten });
        buehne.className = 'stirn__stage stirn__stage--' + (erraten ? 'erraten' : 'weiter');
        zeigeText(erraten ? 'Erraten' : 'Weiter');
        timer.push(setTimeout(() => { if (phase === 'pause') naechster(); }, 700));
      }
      function tick() {
        const rest = Math.max(0, endzeit - Date.now());
        zeit.textContent = String(Math.ceil(rest / 1000));
        balken.style.transform = 'scaleX(' + (rest / (sekunden * 1000)) + ')';
        if (rest <= 0) schluss();
      }
      function starten() {
        phase = 'countdown';
        zonen.replaceChildren();
        let n = 3;
        const zaehlen = () => {
          if (n === 0) {
            endzeit = Date.now() + sekunden * 1000;
            zonen.replaceChildren(zone('Weiter', () => melden(false), false, 'stirn-weiter'), zone('Erraten', () => melden(true), true, 'stirn-erraten'));
            naechster();
            timer.push(setInterval(tick, 100));
            return;
          }
          zeigeText(String(n));
          n -= 1;
          timer.push(setTimeout(zaehlen, 1000));
        };
        zaehlen();
      }
      function schliessen() {
        timer.forEach(id => { clearTimeout(id); clearInterval(id); });
        window.removeEventListener('deviceorientation', neigen);
        window.removeEventListener('resize', anpassen);
        ebene.remove();
      }
      function schluss() {
        if (phase === 'spiel') ergebnis.push({ wort: aktuell, erraten: false, offen: true });
        phase = 'ende';
        auswertung(ergebnis);
      }
      function abbrechen() { phase = 'ende'; vorbereiten(); }
      function neigen(ereignis) {
        const z = bildschirmNeigung(ereignis);
        if (z === null) return;
        if (Math.abs(z) < NEIGUNG_NEUTRAL) { scharf = true; return; }
        if (phase !== 'spiel' || !scharf) return;
        if (z <= -NEIGUNG_AUSLOESEN) melden(true);          // Bildschirm zeigt zum Boden
        else if (z >= NEIGUNG_AUSLOESEN) melden(false);     // Bildschirm zeigt zur Decke
      }
      function anpassen() { if (phase === 'spiel' || phase === 'pause' || phase === 'countdown') einpassen(begriff, mitte); }

      document.body.appendChild(ebene);
      beimVerlassen(schliessen);
      wachBleiben();
      if (neigenErlaubt) window.addEventListener('deviceorientation', neigen);
      window.addEventListener('resize', anpassen);

      zeigeText('Halte das Handy quer an deine Stirn. ' + (neigenErlaubt
        ? 'Nach unten neigen heißt erraten, nach oben heißt weiter.'
        : 'Gespielt wird mit Tippen: ' + Game.andere() + ' tippt für dich.'), true);
      zonen.replaceChildren(zone('Start', starten, true, 'stirn-start'));
    }

    function auswertung(ergebnis) {
      const erraten = ergebnis.filter(e => e.erraten).length;
      const rater = Game.dran();
      const naechste = Game.andere();
      schritt('stirn-ergebnis', 'Stirnraten', {
        inhalt: [dranChip(rater + ' hat geraten'),
          h('p', { class: 'display', 'data-rolle': 'erraten' }, String(erraten)),
          headline(null, erraten === 1 ? 'Begriff erraten' : 'Begriffe erraten', { zentriert: true, ebene: 'h2' }),
          ergebnis.length ? h('ul', { class: 'list-plain' }, ergebnis.map(e => h('li', {},
            h('span', {}, e.wort),
            h('span', { class: 'list-plain__note' }, e.erraten ? 'erraten' : e.offen ? 'noch offen' : 'weiter')))) : null],
        aktionen: [knopf('Nächste Runde – ' + naechste + ' rät', () => { Game.wechseln(); vorbereiten(); }, null, { 'data-aktion': 'weiter' }),
          knopf('Stirnraten beenden', beenden, 'ghost', { 'data-aktion': 'beenden' })],
      });
    }

    function beenden() {
      UI.aufraeumen();
      ende({ klein: 'Danke fürs', gross: 'Mitraten', nochmalText: 'Noch einmal Stirnraten' });
    }

    vorbereiten();
  });

  /* ======================================================================
     Wer bin ich?
     ====================================================================== */

  const ART_TEXT = { fiktiv: 'Erfundene Figur', real: 'Echte Person', rolle: 'Gestalt oder Rolle' };

  route('werbinich', () => {
    const cfg = Game.daten.werbinich;
    const figuren = cfg.figuren.filter(Game.passtModus);
    if (!figuren.length) { leer(); return; }

    /** Verdecktes Feld, das nur die wissende Person kurz öffnet. */
    function verdeckt(figur, wissend, offen) {
      const el = h('div', { class: 'reveal', 'data-rolle': 'figur' });
      const zeichne = sichtbar => {
        el.classList.toggle('reveal--open', sichtbar);
        el.replaceChildren(...(sichtbar
          ? [h('span', { class: 'card__kicker' }, ART_TEXT[figur.art] || 'Figur'),
            h('p', { class: 'card__text', 'data-rolle': 'figur-name' }, figur.name),
            knopf('Verdecken', () => zeichne(false), 'ghost small', { 'data-aktion': 'verdecken' })]
          : [h('p', { class: 'text text--muted' }, 'Verdeckt. Nur ' + wissend + ' schaut hin.'),
            knopf('Figur zeigen', () => zeichne(true), 'ghost small', { 'data-aktion': 'zeigen' })]));
      };
      zeichne(!!offen);
      return el;
    }

    function neueFigur() {
      const rater = Game.dran();
      const wissend = Game.andere();
      const figur = Game.ziehen('werbinich', figuren);

      schritt('wbi-zuweisen', 'Wer bin ich?', {
        inhalt: [dranChip(rater + ' rät'),
          headline(rater + ', schau kurz weg', wissend + ' merkt sich die Figur'),
          verdeckt(figur, wissend),
          text('Wenn ' + wissend + ' die Figur kennt, verdeckt sie wieder und legt das Handy zwischen euch.')],
        aktionen: [knopf('Los geht’s', () => fragen(figur, rater, wissend), null, { 'data-aktion': 'weiter' }),
          lieberNicht(neueFigur, 'Lieber eine andere Figur')],
      });
    }

    function fragen(figur, rater, wissend) {
      const ideen = Game.mischen(cfg.fragen).slice(0, 3);
      schritt('wbi-fragen', 'Wer bin ich?', {
        inhalt: [dranChip(rater + ' fragt'),
          headline('Ganz ohne Zeitdruck', 'Wer bin ich?'),
          h('div', { class: 'card' },
            h('span', { class: 'card__kicker' }, 'So geht’s'),
            h('p', { class: 'card__note', style: 'color: var(--color-fg)' }, rater + ' stellt Fragen, die sich mit Ja oder Nein beantworten lassen. ' + wissend + ' antwortet ehrlich und darf kleine Hinweise geben.'),
            h('ul', { class: 'prose', style: 'padding-left: var(--space-4); list-style: disc' }, ideen.map(f => h('li', {}, f)))),
          verdeckt(figur, wissend)],
        aktionen: [knopf('Auflösen', () => aufloesen(figur, wissend), null, { 'data-aktion': 'weiter' }),
          lieberNicht(neueFigur, 'Lieber eine andere Figur')],
      });
    }

    function aufloesen(figur, wissend) {
      schritt('wbi-aufloesung', 'Wer bin ich?', {
        zentriert: true,
        inhalt: [bild('cat-werbinich', 'illustration illustration--small'),
          headline('Du warst', figur.name, { zentriert: true }),
          h('p', { class: 'text text--muted text--center' }, 'Welche Frage hat am meisten geholfen? Und was verbindet ihr beide mit dieser Figur?')],
        aktionen: [knopf('Nächste Figur – ' + wissend + ' rät', () => { Game.wechseln(); neueFigur(); }, null, { 'data-aktion': 'weiter' }),
          knopf('Beenden', () => ende({ klein: 'Danke fürs', gross: 'Rätseln' }), 'ghost', { 'data-aktion': 'beenden' })],
      });
    }

    neueFigur();
  });

  /* ======================================================================
     Heiraten, Küssen, Weg damit
     ====================================================================== */

  route('hku', () => {
    const cfg = Game.daten.hku;
    const sets = cfg.sets.filter(Game.passtModus);
    if (!sets.length) { leer(); return; }
    const RUNDE = 6;
    let nummer = 0;

    function neuesSet() {
      if (nummer >= RUNDE) { ende(); return; }
      const set = Game.ziehen('hku', sets);
      const wahl = [null, null, null];     // je Ding die gewählte Option
      fortschritt(nummer / RUNDE);

      const weiter = knopf('Weiter', sprechen, null, { 'data-aktion': 'weiter', disabled: true });
      const schalter = set.dinge.map((ding, i) => segment({
        label: ding, wert: null, abwaehlbar: true,
        optionen: cfg.optionen.map(o => ({ wert: o.id, text: o.name })),
        onChange: wert => {
          // Jede Option gibt es nur einmal: Wer sie neu vergibt, nimmt sie dem anderen Ding weg.
          wahl.forEach((w, j) => { if (j !== i && wert && w === wert) { wahl[j] = null; schalter[j].setze(null); } });
          wahl[i] = wert;
          weiter.disabled = wahl.some(w => !w);
        },
      }));

      schritt('hku', '', {
        inhalt: [dranChip(),
          headline('Heiraten, Küssen, Weg damit', set.thema),
          text(cfg.optionen.map(o => o.name + ' = ' + o.text).join(' · '), 'text text--muted text--small'),
          h('div', { class: 'assign' }, set.dinge.map((ding, i) => h('div', { class: 'assign__item' },
            h('span', { class: 'assign__name' }, ding), schalter[i])))],
        aktionen: [weiter, lieberNicht(neuesSet)],
      }).setAttribute('data-set', set.id);

      function sprechen() {
        const zeile = o => h('li', {},
          h('span', {}, set.dinge[wahl.indexOf(o.id)]),
          h('span', { class: 'list-plain__note' }, o.name));
        schritt('hku-gespraech', '', {
          inhalt: [dranChip(Game.dran() + ' hat gewählt'),
            headline(set.thema, 'Erzähl, warum'),
            h('ul', { class: 'list-plain' }, cfg.optionen.map(zeile)),
            text(Game.einsetzen('Was hat die Wahl leicht gemacht, was schwer? {andere}: Wie hättest du entschieden?'))],
          aktionen: [knopf('Weiter', () => { nummer += 1; Game.wechseln(); neuesSet(); }, null, { 'data-aktion': 'weiter' })],
        });
      }
    }

    neuesSet();
  });
})(window);
