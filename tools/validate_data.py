#!/usr/bin/env python3
"""Prüft die Spielinhalte in data/ und die Grafik-Pfade.

    python3 tools/validate_data.py

Geprüft werden Pflichtfelder, erlaubte Werte (modus, intensitaet …), eindeutige
IDs, genau eine richtige Antwort je Wissensfrage, Platzhalter in Texten sowie
die festen Grafik- und Offline-Pfade. Endet mit Code 1, wenn Fehler gefunden
werden. Braucht nur die Python-Standardbibliothek.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

MODI = {"couple", "friends", "beide"}
INTENSITAETEN = {1, 2, 3}
PLATZHALTER = {"{dran}", "{andere}"}

fehler = []
hinweise = []


def melde(datei, wo, text):
    fehler.append(f"{datei}: {wo}: {text}")


def lade(name):
    pfad = DATA / name
    try:
        return json.loads(pfad.read_text(encoding="utf-8"))
    except FileNotFoundError:
        melde(name, "-", "Datei fehlt")
    except json.JSONDecodeError as e:
        melde(name, "-", f"kein gültiges JSON ({e})")
    return None


def text_ok(wert):
    return isinstance(wert, str) and wert.strip() == wert and len(wert) > 0


def pruefe_liste(datei, liste, pflicht, pruefer=None, schluessel="id"):
    """Gemeinsame Prüfungen: Liste, Pflichtfelder, eindeutige IDs, modus, intensitaet, Platzhalter."""
    if not isinstance(liste, list) or not liste:
        melde(datei, "-", "Liste fehlt oder ist leer")
        return []
    gesehen = set()
    for i, eintrag in enumerate(liste):
        wo = f"Eintrag {i + 1}"
        if not isinstance(eintrag, dict):
            melde(datei, wo, "ist kein Objekt")
            continue
        wo = str(eintrag.get(schluessel, wo))
        for feld in pflicht:
            if feld not in eintrag:
                melde(datei, wo, f"Pflichtfeld '{feld}' fehlt")
            elif feld not in ("intensitaet", "dauer") and isinstance(eintrag[feld], str) and not text_ok(eintrag[feld]):
                melde(datei, wo, f"Feld '{feld}' ist leer oder hat Leerzeichen am Rand")
        kennung = eintrag.get(schluessel)
        if kennung in gesehen:
            melde(datei, wo, f"'{schluessel}' kommt doppelt vor")
        gesehen.add(kennung)
        if "modus" in eintrag and eintrag["modus"] not in MODI:
            melde(datei, wo, f"modus '{eintrag['modus']}' ist nicht erlaubt ({', '.join(sorted(MODI))})")
        if "intensitaet" in eintrag and eintrag["intensitaet"] not in INTENSITAETEN:
            melde(datei, wo, "intensitaet muss 1, 2 oder 3 sein")
        for feld in ("text", "frage"):
            for p in re.findall(r"\{[^}]*\}", str(eintrag.get(feld, ""))):
                if p not in PLATZHALTER:
                    melde(datei, wo, f"unbekannter Platzhalter {p}")
        if pruefer:
            pruefer(wo, eintrag)
    return liste


def abdeckung(datei, liste, minimum, was):
    """Jeder Modus soll auf jeder Stufe genug Karten haben."""
    for modus in ("couple", "friends"):
        for stufe in (1, 2, 3):
            n = sum(1 for k in liste if isinstance(k, dict)
                    and k.get("modus", "beide") in ("beide", modus) and k.get("intensitaet", 1) <= stufe)
            if n < minimum:
                melde(datei, f"{modus}/Stufe {stufe}", f"nur {n} {was} (mindestens {minimum})")


# ---- Wissen -----------------------------------------------------------------

def pruefe_wissen():
    d = lade("wissen.json")
    if d is None:
        return
    for feld in ("quelle", "lizenz"):
        if not text_ok(d.get(feld, "")):
            melde("wissen.json", "-", f"Angabe '{feld}' fehlt (Pflicht wegen CC BY-SA)")

    def karte(wo, k):
        falsch = k.get("falsch")
        if not isinstance(falsch, list) or len(falsch) != 3 or not all(text_ok(a) for a in falsch):
            melde("wissen.json", wo, "'falsch' muss genau drei nicht leere Antworten enthalten")
            return
        alle = [str(k.get("richtig", "")).casefold()] + [a.casefold() for a in falsch]
        if len(set(alle)) != 4:
            melde("wissen.json", wo, "Antworten doppelt: es muss genau eine richtige und drei andere geben")
        if k.get("schwierigkeit") not in ("leicht", "mittel", "schwer"):
            melde("wissen.json", wo, "schwierigkeit muss leicht, mittel oder schwer sein")

    karten = pruefe_liste("wissen.json", d.get("karten"), ["id", "kategorie", "modus", "frage", "richtig", "falsch"], karte)
    fragen = [k.get("frage") for k in karten if isinstance(k, dict)]
    if len(set(fragen)) != len(fragen):
        melde("wissen.json", "-", "eine Frage kommt doppelt vor")
    return len(karten)


# ---- Persönliche Fragen und Aufgaben ------------------------------------------

def pruefe_persoenlich():
    d = lade("persoenlich.json")
    if d is None:
        return
    karten = pruefe_liste("persoenlich.json", d.get("karten"), ["id", "text", "modus", "intensitaet"])
    texte = [k.get("text") for k in karten if isinstance(k, dict)]
    if len(set(texte)) != len(texte):
        melde("persoenlich.json", "-", "ein Text kommt doppelt vor")
    abdeckung("persoenlich.json", karten, 20, "Fragen")
    return len(karten)


def pruefe_aufgaben():
    d = lade("aufgaben.json")
    if d is None:
        return

    def karte(wo, k):
        if "dauer" in k and not (isinstance(k["dauer"], int) and 10 <= k["dauer"] <= 600):
            melde("aufgaben.json", wo, "dauer muss eine ganze Zahl zwischen 10 und 600 Sekunden sein")

    karten = pruefe_liste("aufgaben.json", d.get("karten"), ["id", "text", "modus", "intensitaet"], karte)
    abdeckung("aufgaben.json", karten, 15, "Aufgaben")
    if not any(isinstance(k, dict) and "dauer" in k for k in karten):
        melde("aufgaben.json", "-", "keine Aufgabe mit Timer")
    return len(karten)


# ---- Minispiele ---------------------------------------------------------------

def pruefe_minispiele():
    d = lade("minispiele.json")
    if d is None:
        return
    name = "minispiele.json"
    saetze = pruefe_liste(name + " satzanfaenge", d.get("satzanfaenge"), ["id", "text", "modus", "intensitaet"])
    abdeckung(name + " satzanfaenge", saetze, 8, "Satzanfänge")

    asso = d.get("assoziation", {})
    if not isinstance(asso.get("sekunden"), int):
        melde(name, "assoziation", "'sekunden' fehlt")
    pruefe_liste(name + " assoziation", asso.get("woerter"), ["id", "wort", "modus"])

    def geschichte(wo, g):
        schritte = g.get("schritte")
        if not isinstance(schritte, list) or len(schritte) < 4:
            melde(name, wo, "eine Geschichte braucht mindestens vier Schritte")
            return
        for i, s in enumerate(schritte):
            for feld in ("stichwort", "text", "deutung"):
                if not text_ok(s.get(feld, "")):
                    melde(name, f"{wo} Schritt {i + 1}", f"'{feld}' fehlt")

    geschichten = pruefe_liste(name + " geschichten", d.get("geschichten"), ["id", "titel", "bild", "text", "schritte"], geschichte)
    for g in geschichten:
        if isinstance(g, dict) and not (ROOT / "assets" / f"{g.get('bild')}.svg").exists():
            melde(name, str(g.get("id")), f"Grafik assets/{g.get('bild')}.svg fehlt")

    def zukunft(wo, z):
        schritte = z.get("schritte")
        if not isinstance(schritte, list) or len(schritte) < 3 or not all(text_ok(s) for s in schritte):
            melde(name, wo, "'schritte' muss mindestens drei Texte enthalten")

    bilder = pruefe_liste(name + " zukunftsbild", d.get("zukunftsbild"), ["id", "modus", "titel", "text", "schritte"], zukunft)
    for modus in ("couple", "friends"):
        if not any(isinstance(z, dict) and z.get("modus") in ("beide", modus) for z in bilder):
            melde(name, "zukunftsbild", f"kein Zukunftsbild für den Modus {modus}")

    rad = d.get("gefuehlsrad", {})
    gefuehle = rad.get("gefuehle")
    if not isinstance(gefuehle, list) or len(gefuehle) < 4:
        melde(name, "gefuehlsrad", "mindestens vier Gefühle nötig")
    else:
        for g in gefuehle:
            if not text_ok(g.get("name", "")) or not isinstance(g.get("feiner"), list) or len(g["feiner"]) < 3:
                melde(name, f"gefuehlsrad {g.get('name')}", "braucht 'name' und mindestens drei feinere Gefühle")
    if not rad.get("impulse"):
        melde(name, "gefuehlsrad", "'impulse' fehlt")

    teile = d.get("rosedornknospe", {}).get("teile")
    if not isinstance(teile, list) or [t.get("id") for t in teile] != ["rose", "dorn", "knospe"]:
        melde(name, "rosedornknospe", "erwartet werden genau die Teile rose, dorn, knospe")
    else:
        for t in teile:
            if not t.get("fragen") or not text_ok(t.get("titel", "")):
                melde(name, f"rosedornknospe {t.get('id')}", "'titel' oder 'fragen' fehlt")

    spiegeln = d.get("spiegeln", {})
    if not isinstance(spiegeln.get("sekunden"), int):
        melde(name, "spiegeln", "'sekunden' fehlt")
    themen = pruefe_liste(name + " spiegeln", spiegeln.get("themen"), ["id", "text", "modus", "intensitaet"])
    abdeckung(name + " spiegeln", themen, 3, "Themen")

    atem = d.get("atem", {})
    for feld in ("einatmen", "ausatmen", "atemzuege"):
        if not (isinstance(atem.get(feld), int) and atem[feld] > 0):
            melde(name, "atem", f"'{feld}' muss eine positive ganze Zahl sein")
    return len(saetze)


# ---- Stirnraten, Wer bin ich, HKU ---------------------------------------------

def pruefe_stirnraten():
    d = lade("stirnraten.json")
    if d is None:
        return
    sekunden = d.get("sekunden")
    if not isinstance(sekunden, list) or not sekunden or not all(isinstance(s, int) and s > 0 for s in sekunden):
        melde("stirnraten.json", "-", "'sekunden' muss eine Liste positiver ganzer Zahlen sein")
    anzahl = 0

    def kategorie(wo, k):
        nonlocal anzahl
        begriffe = k.get("begriffe")
        if not isinstance(begriffe, list) or len(begriffe) < 20:
            melde("stirnraten.json", wo, "mindestens 20 Begriffe je Kategorie")
            return
        anzahl += len(begriffe)
        if not all(text_ok(b) for b in begriffe):
            melde("stirnraten.json", wo, "leerer Begriff oder Leerzeichen am Rand")
        doppelt = {b for b in begriffe if begriffe.count(b) > 1}
        if doppelt:
            melde("stirnraten.json", wo, f"doppelte Begriffe: {', '.join(sorted(doppelt))}")

    kats = pruefe_liste("stirnraten.json", d.get("kategorien"), ["id", "name", "modus", "begriffe"], kategorie)
    for modus in ("couple", "friends"):
        if not any(isinstance(k, dict) and k.get("modus") in ("beide", modus) for k in kats):
            melde("stirnraten.json", "-", f"keine Kategorie für den Modus {modus}")
    return anzahl


def pruefe_werbinich():
    d = lade("werbinich.json")
    if d is None:
        return

    def figur(wo, f):
        if f.get("art") not in ("fiktiv", "real", "rolle"):
            melde("werbinich.json", wo, "art muss fiktiv, real oder rolle sein")

    figuren = pruefe_liste("werbinich.json", d.get("figuren"), ["id", "name", "art", "modus"], figur)
    namen = [f.get("name") for f in figuren if isinstance(f, dict)]
    if len(set(namen)) != len(namen):
        melde("werbinich.json", "-", "eine Figur kommt doppelt vor")
    if not d.get("fragen"):
        melde("werbinich.json", "-", "'fragen' (Beispielfragen) fehlt")
    return len(figuren)


def pruefe_hku():
    d = lade("hku.json")
    if d is None:
        return
    optionen = d.get("optionen")
    if not isinstance(optionen, list) or len(optionen) != 3 or not all(text_ok(o.get("id", "")) and text_ok(o.get("name", "")) for o in optionen):
        melde("hku.json", "-", "'optionen' muss genau drei Einträge mit id und name haben")

    def satz(wo, s):
        dinge = s.get("dinge")
        if not isinstance(dinge, list) or len(dinge) != 3 or len(set(dinge)) != 3 or not all(text_ok(x) for x in dinge):
            melde("hku.json", wo, "'dinge' muss genau drei verschiedene Einträge haben")
        if s.get("art") not in ("dinge", "figuren", "promis"):
            melde("hku.json", wo, "art muss dinge, figuren oder promis sein")
        if s.get("art") == "promis" and s.get("modus") != "friends":
            melde("hku.json", wo, "Sets mit realen Personen sind nur im Modus friends erlaubt")

    sets = pruefe_liste("hku.json", d.get("sets"), ["id", "thema", "art", "modus", "dinge"], satz)
    for modus in ("couple", "friends"):
        n = sum(1 for s in sets if isinstance(s, dict) and s.get("modus") in ("beide", modus))
        if n < 30:
            melde("hku.json", modus, f"nur {n} Sets (mindestens 30)")
    return len(sets)


# ---- Grafiken und Offline-Liste ------------------------------------------------

def pruefe_dateien():
    """Jede im Code verwendete Grafik muss unter ihrem festen Pfad existieren."""
    code = "".join((ROOT / f).read_text(encoding="utf-8") for f in ("game.js", "ui.js", "minigames.js"))
    namen = set(re.findall(r"bild\('([a-z0-9-]+)'", code)) | set(re.findall(r"bild: '([a-z0-9-]+)'", code))
    namen |= {"icon-" + n for n in re.findall(r"(?:icon|iconKnopf)\('([a-z0-9-]+)'", code)}
    for n in sorted(namen):
        if not (ROOT / "assets" / f"{n}.svg").exists():
            melde("assets", n, f"assets/{n}.svg wird im Code verwendet, fehlt aber")
    if not (ROOT / "assets" / "bg-texture.png").exists():
        melde("assets", "bg-texture", "assets/bg-texture.png fehlt")

    sw = ROOT / "sw.js"
    if not sw.exists():
        hinweise.append("sw.js noch nicht vorhanden – Offline-Liste nicht geprüft")
        return len(namen)
    block = re.search(r"const ASSETS = \[(.*?)\];", sw.read_text(encoding="utf-8"), re.S)
    if not block:
        melde("sw.js", "-", "Liste ASSETS nicht gefunden")
        return len(namen)
    gelistet = {p for p in re.findall(r"'([^']+)'", block.group(1)) if p != "./"}
    for pfad in sorted(gelistet):
        if not (ROOT / pfad).exists():
            melde("sw.js", pfad, "steht in der Offline-Liste, existiert aber nicht")
    noetig = [p for ordner, muster in (("assets", "*"), ("data", "*.json"), ("fonts", "*.woff2"), ("icons", "*"))
              for p in sorted((ROOT / ordner).glob(muster))]
    noetig += [ROOT / f for f in ("index.html", "style.css", "game.js", "ui.js", "minigames.js", "manifest.json")]
    for p in noetig:
        rel = p.relative_to(ROOT).as_posix()
        if rel not in gelistet:
            melde("sw.js", rel, "fehlt in der Offline-Liste ASSETS")
    return len(namen)


def main():
    zahlen = {
        "Wissensfragen": pruefe_wissen(),
        "Persönliche Fragen": pruefe_persoenlich(),
        "Aufgaben": pruefe_aufgaben(),
        "Satzanfänge": pruefe_minispiele(),
        "Stirnraten-Begriffe": pruefe_stirnraten(),
        "Figuren (Wer bin ich?)": pruefe_werbinich(),
        "Dreiersets (HKU)": pruefe_hku(),
        "Grafiken im Code": pruefe_dateien(),
    }
    for name, n in zahlen.items():
        print(f"  {name:<24} {n if n is not None else '–'}")
    for h in hinweise:
        print("Hinweis:", h)
    if fehler:
        print(f"\n{len(fehler)} Fehler:")
        for f in fehler:
            print("  ✗", f)
        sys.exit(1)
    print("\nAlles in Ordnung.")


if __name__ == "__main__":
    main()
