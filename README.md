# Monna

Ein ruhiges Kartenspiel für gute Freunde und Paare. Ein Handy wird reihum weitergegeben,
die Karte wird vorgelesen, geantwortet wird im Gespräch. Es gibt **keine Punkte, keine
Gewinner und keinen Ton**. Auf jeder Karte steht „Lieber nicht“.

Monna ist eine Progressive Web App aus HTML, CSS und Vanilla JavaScript: kein Framework,
kein Build-Schritt, kein CDN. Gestaltet für das iPhone im Hochformat (390 × 844),
benutzbar ab 320 px Breite.

## Starten

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Die App lädt ihre Inhalte per `fetch` aus `data/`,
deshalb braucht sie einen Webserver (ein Doppelklick auf `index.html` genügt nicht).
Auf dem iPhone lässt sie sich in Safari über „Zum Home-Bildschirm“ installieren und läuft
dann auch offline. Die Bewegungssensoren fürs Stirnraten gibt iOS nur über HTTPS frei.

## Aufbau

```
index.html      Gerüst, iOS-/PWA-Meta-Tags, Fortschrittsbalken
style.css       Schriften, Design-Tokens (CSS-Variablen), alle Bausteine
game.js         Monna.Game – Zustand, Kartenstapel ohne Wiederholung, Filter, Einstellungen
ui.js           Monna.UI   – Bausteine, Navigation, Screens, Kartenrunden
minigames.js    Minispiele, Stirnraten, Wer bin ich?, Heiraten/Küssen/Weg damit
data/           Inhalte als JSON
assets/         Grafiken unter festen Dateinamen
fonts/          Playfair Display und Inter als WOFF2, mit Lizenztexten
icons/          App-Icon (SVG und daraus erzeugte PNGs)
manifest.json   Web-App-Manifest
sw.js           Service Worker (Offline-Cache)
tools/          fetch_trivia.py, validate_data.py, make_icons.js
```

`game.js` kennt kein DOM, `ui.js` und `minigames.js` kennen keine Spielregeln jenseits
dessen, was sie anzeigen. Die drei Skripte werden in dieser Reihenfolge geladen.

## Spiele

| Bereich | Was passiert |
| --- | --- |
| Wissen | Multiple Choice mit vier Antworten. Nach dem Tipp erscheint nur die Auflösung unter „Wusstest du’s?“ – ohne richtig oder falsch. |
| Persönliche Fragen | Nach Modus und Stufe gefiltert, mit „X ist dran“. |
| Aufgaben | Kleine Dinge zum Tun, ein Teil davon mit Timer-Ring. |
| Bunt gemischt | Wissen, Fragen und Aufgaben im Wechsel. |
| Minispiele | Wort-Assoziation, Gedankengeschichte, Satzanfänge, Gefühlsrad, Rose/Dorn/Knospe, Spiegeln, Atem zu zweit, Zukunftsbild. |
| Stirnraten | Quergedrehte Ansicht, Begriff riesig. Neigen nach unten = erraten, nach oben = weiter; Tippen geht immer. Runde um Runde, bis jemand „Stirnraten beenden“ wählt. Am Rundenende steht nur die Zahl der erratenen Begriffe dieser Runde. |
| Wer bin ich? | Eine Figur wird verdeckt zugewiesen, dann Ja-Nein-Fragen ohne Zeitdruck. |
| Heiraten, Küssen, Weg damit | Drei Dinge den drei Optionen zuordnen, danach darüber sprechen. Im Modus Couple ohne reale Personen. |

Modi: **Couple**, **Friends**, **Party** (ausgegraut, „kommt bald“).
Stufen: Leicht, Mittel, Tief. Es gelten jeweils alle Karten bis zur gewählten Stufe.

## Design anpassen

Alle Farben, Schriften, Größen, Abstände und Radien stehen als CSS-Variablen in
Abschnitt 2 von `style.css` (`:root`). Das spätere Design tauscht dort Werte, zum Beispiel:

```css
--color-bg: #ffffff;   --color-fg: #111111;   --color-grey: #6e6e6e;
--font-serif: "Playfair Display", …;          --font-sans: "Inter", …;
--radius-m: 1.125rem;  --button-height: 3.5rem;  --space-5: 1.5rem;
```

Vorläufig: Weiß, Schwarz, ein Grau, zweizeilige Serifen-Überschriften (klein + groß),
schwarze Pillen-Buttons, Segment-Umschalter, dünner Fortschrittsbalken oben.

## Grafiken austauschen

Das aktuelle Set ist ein einheitliches Linien-Set (schwarze Kontur, eine hellgraue Fläche,
kleine Funkel-Akzente). Grafiken werden nur über feste Pfade geladen. Zum Austauschen
genügt es, die Datei unter **demselben Namen** zu ersetzen und in `sw.js` die `VERSION` zu erhöhen. An den Grafiken
hängt keine Logik; fehlt eine Datei, wird das Bild ausgeblendet.

| Pfad | Verwendung |
| --- | --- |
| `assets/hero-start.svg` | Startscreen |
| `assets/mode-couple.svg`, `mode-friends.svg`, `mode-party.svg` | Modus-Auswahl |
| `assets/cat-mix.svg`, `cat-wissen.svg`, `cat-fragen.svg`, `cat-aufgaben.svg`, `cat-minispiele.svg`, `cat-stirnraten.svg`, `cat-werbinich.svg`, `cat-hku.svg` | Kacheln im Menü |
| `assets/game-assoziation.svg`, `game-geschichte.svg`, `game-satzanfaenge.svg`, `game-gefuehlsrad.svg`, `game-rosedornknospe.svg`, `game-spiegeln.svg`, `game-atem.svg`, `game-zukunftsbild.svg` | Minispiele |
| `assets/story-weg.svg`, `story-haus.svg`, `story-tuer.svg` | Gedankengeschichten |
| `assets/end-danke.svg` | Abschluss einer Runde |
| `assets/empty-pause.svg` | Pause, leerer Stapel, Ladefehler |
| `assets/icon-back.svg`, `icon-close.svg`, `icon-info.svg`, `icon-pause.svg` | Icons der Kopfzeile |
| `assets/icon-check.svg`, `icon-next.svg`, `icon-skip.svg`, `icon-rotate.svg`, `icon-timer.svg` | Reserve, noch nicht verwendet |
| `assets/bg-texture.png` | Hintergrund-Textur (sehr feines Papierkorn), gekachelt |
| `icons/icon.svg` | App-Icon; danach `node tools/make_icons.js` |

Hinweise für den Designprozess:

- Illustrationen dürfen jedes Seitenverhältnis haben; sie werden mit `object-fit: contain`
  eingepasst. Die Höhen stehen in den Tokens (`--illustration-height`).
- `icon-*.svg` werden als **Maske** verwendet und in der Textfarbe eingefärbt. Sie sollten
  einfarbig sein; ihre eigene Farbe wird ignoriert.
- Andere Dateiformate (z. B. PNG) brauchen eine Zeile Anpassung in `bild()` in `ui.js`.

## Inhalte

Alle Texte liegen in `data/`. Gemeinsame Felder:

- `id` – eindeutig innerhalb der Datei
- `modus` – `couple`, `friends` oder `beide`
- `intensitaet` – `1` (leicht) bis `3` (tief), wo sinnvoll
- Platzhalter in Texten: `{dran}` = wer an der Reihe ist, `{andere}` = die andere Person

| Datei | Inhalt |
| --- | --- |
| `wissen.json` | 159 Fragen: `frage`, `richtig`, `falsch` (genau drei), `kategorie`, `schwierigkeit`, optional `info` |
| `persoenlich.json` | 105 Fragen: `text`, `thema` |
| `aufgaben.json` | 61 Aufgaben: `text`, optional `dauer` (Timer in Sekunden) |
| `minispiele.json` | 38 Satzanfänge, 54 Wörter, 3 Gedankengeschichten mit je 6 Schritten, 3 Zukunftsbilder, Gefühlsrad, Rose/Dorn/Knospe, Themen fürs Spiegeln, Atemrhythmus |
| `stirnraten.json` | 7 Kategorien mit je 40 Begriffen |
| `werbinich.json` | 83 Figuren: `name`, `art` (`fiktiv`, `real`, `rolle`) |
| `hku.json` | 54 Dreiersets: `thema`, `dinge`, `art` (`dinge`, `figuren`, `promis`) |

Prüfen:

```bash
python3 tools/validate_data.py
```

Das Skript prüft Pflichtfelder, erlaubte Werte, eindeutige IDs, genau eine richtige
Antwort je Wissensfrage, Platzhalter, die Mindestmenge je Modus und Stufe, die
Grafik-Pfade aus dem Code und die Offline-Liste in `sw.js`.

### Wissensfragen pflegen

```bash
python3 tools/fetch_trivia.py fetch    # abrufen, filtern, tools/trivia/kandidaten.json ergänzen
python3 tools/fetch_trivia.py liste    # unbearbeitete Kandidaten ansehen
python3 tools/fetch_trivia.py build    # data/wissen.json aus den Übersetzungen bauen
```

`fetch` holt Multiple-Choice-Fragen der Stufen leicht und mittel und sortiert automatisch
aus: US- und UK-lastige Fragen, Negativfragen, Sprach- und Abkürzungsfragen, sehr lange
Texte. In `kandidaten.json` werden `frage_de`, `richtig_de` und `falsch_de` von Hand
ausgefüllt und `uebernehmen` auf `true` gesetzt (`false` = aussortiert). Ein erneuter
Abruf überschreibt keine Übersetzungen.

## PWA und Offline

`sw.js` legt beim Installieren alle Dateien aus `ASSETS` in den Cache und liefert sie
danach zuerst aus dem Cache, während im Hintergrund aktualisiert wird. Bei jeder Änderung
`VERSION` erhöhen; neue Dateien in `ASSETS` eintragen (`validate_data.py` meldet fehlende).
Struktur von Manifest und Service Worker folgen dem Projekt `campingplatz`.

## Veröffentlichen

Monna besteht nur aus statischen Dateien und läuft auf jedem Webspace mit HTTPS. Mit
GitHub Pages: im Repository unter *Settings → Pages* als Quelle „Deploy from a branch“
wählen, den Branch und den Ordner `/ (root)` angeben. Für ein privates Repository
braucht Pages einen bezahlten GitHub-Plan; alternativ das Repository öffentlich stellen.
Erst über eine solche HTTPS-Adresse funktionieren Installation, Offline-Modus und das
Neigen beim Stirnraten. In eingebetteten Vorschauen (iframe) sind Service Worker und
Bewegungssensoren gesperrt; dort läuft das Spiel mit Tippen.

## Daten und Privatsphäre

- Antworten werden nie gespeichert. Texte aus den optionalen Schreibfeldern leben nur im
  Eingabefeld und sind beim nächsten Schritt weg.
- `localStorage` enthält einen Eintrag `monna.einstellungen` mit Modus und Stufe, die
  Namen nur, wenn „Namen auf diesem Gerät merken“ angehakt ist.
- Kein Tracking, keine externen Anfragen, keine Töne, keine Sprachausgabe.

## Quellen und Lizenzen

- **Wissensfragen:** [Open Trivia Database](https://opentdb.com), Lizenz
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Die Fragen wurden
  ausgewählt, ins Deutsche übersetzt und bearbeitet (teils andere falsche Antworten,
  ergänzte Kurzinfos). `data/wissen.json` und `tools/trivia/kandidaten.json` stehen
  deshalb ebenfalls unter CC BY-SA 4.0. Die Angabe steht auch im Über-Screen der App.
- **Schriften:** Playfair Display (© The Playfair Display Project Authors) und Inter
  (© The Inter Project Authors), beide unter der
  [SIL Open Font License 1.1](https://openfontlicense.org). Lizenztexte in `fonts/`.
  Eingebettet ist jeweils der lateinische Zeichensatz als variable Schrift.
- **Alle übrigen Inhalte, Code und Grafiken** wurden für Monna erstellt.

## Geprüft

Lokal mit `python3 -m http.server` und Chromium (Playwright) in 390 × 844 und 320 × 568,
Stirnraten zusätzlich in 844 × 390: Navigation, jede Kartenart, jedes Minispiel bis zum
Abschluss, Filter für alle Kombinationen aus Modus und Stufe, Kartenstapel ohne
Wiederholung, Timer, Neigen über simulierte `deviceorientation`-Ereignisse, verweigerte
Sensor-Freigabe, Offline-Start über den Service Worker. Kein horizontales Scrollen, keine
Konsolenfehler. **Nicht geprüft:** echtes iPhone (Sensor-Freigabe, Neigewinkel in der
Hand, Installation auf dem Home-Bildschirm).

## Annahmen

Entscheidungen, die im Auftrag offen waren:

1. **Rundenlänge:** Eine Kartenrunde hat 10 Karten (`RUNDENLAENGE` in `game.js`), der
   Fortschrittsbalken zeigt den Stand, danach kommt ein Dank-Screen. Wort-Assoziation
   läuft über 5 Wörter, Heiraten/Küssen/Weg damit über 6 Sets.
2. **„Bunt gemischt“** gibt es zusätzlich zu den genannten Kategorien, mit der Grafik
   `assets/cat-mix.svg`.
3. **„Lieber nicht“** zieht eine neue Karte für dieselbe Person, ohne Nachfrage und ohne
   den Fortschritt zu verändern. In geführten Übungen überspringt es den Schritt.
4. **Stufe als Obergrenze:** „Mittel“ enthält auch leichte Karten, „Tief“ alle.
5. **Wissen:** Auch hier steht „X ist dran“ (wer tippt); geraten wird gemeinsam. Der
   eigene Tipp wird neutral als „euer Tipp“ markiert, ohne Farbe für richtig oder falsch.
6. **Namen:** Leere Felder werden zu „Person 1“ und „Person 2“. Gemerkt werden Namen nur
   mit Haken.
7. **Kartentexte** sprechen die Person an, die dran ist, und nennen die andere beim
   Namen (`{andere}`), damit klar ist, wer gemeint ist.
8. **Schreibfelder** gibt es bei Wort-Assoziation, Satzanfängen und im letzten Schritt
   des Zukunftsbilds. Bei der Wort-Assoziation werden beide Wörter nur für den Vergleich
   im Arbeitsspeicher gehalten.
9. **Stirnraten:** Rundenzeit wählbar (60, 90, 120 Sekunden). Ausgelöst wird ab etwa
   35° Neigung, danach muss das Handy einmal gerade sein. Rückmeldung nur optisch
   (Bildschirm wird kurz schwarz bzw. grau). Der Bildschirm bleibt per Wake Lock an, wo
   der Browser das erlaubt. Die Ansicht wird per CSS gedreht, weil sich die Ausrichtung
   auf iOS nicht sperren lässt; im echten Querformat entfällt die Drehung.
10. **Heiraten, Küssen, Weg damit** heißt auch in der App so. Die Optionen sind bei
    Dingen erklärt (für immer behalten, ab und zu genießen, darauf verzichten). Couple
    bekommt Dinge und erfundene Figuren, Friends zusätzlich 12 Sets mit Prominenten.
11. **Gedankengeschichten:** Die Deutung am Ende ist freiwillig und als Spielerei
    formuliert, nicht als Test.
12. **Wissensfragen:** Die Kategorie Musik wurde abgerufen, aber nicht gesichtet (57
    Kandidaten stehen unbearbeitet in `kandidaten.json`). Fragen, bei denen die deutsche
    Formulierung die Antwort verraten hätte, wurden aussortiert.
13. **Icons** werden als Maske eingefärbt und sind damit einfarbig.
14. **Lizenz für Code und eigene Inhalte** ist noch nicht festgelegt; bis dahin gilt
    „alle Rechte vorbehalten“, mit Ausnahme der oben genannten CC-BY-SA-Dateien und der
    Schriften.
15. **Grafiken:** Die Illustrationen wurden nachträglich im vorläufigen Stil der App
    gezeichnet (Schwarz, Weiß, ein helles Grau). Ein späterer Designprozess kann sie
    Datei für Datei ersetzen.
