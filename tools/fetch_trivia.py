#!/usr/bin/env python3
"""Wissensfragen aus der Open Trivia Database holen und für die Übersetzung vorbereiten.

Quelle:  https://opentdb.com  (Open Trivia Database)
Lizenz:  CC BY-SA 4.0  https://creativecommons.org/licenses/by-sa/4.0/

Ablauf
------
1. Abrufen und filtern (englische Rohfragen):

       python3 tools/fetch_trivia.py fetch

   Schreibt tools/trivia/kandidaten.json. Jeder Eintrag hat leere Felder
   "frage_de", "richtig_de", "falsch_de" und "uebernehmen": null.
   Ein erneuter Abruf ergänzt nur neue Fragen; vorhandene Übersetzungen bleiben.

2. Von Hand übersetzen: In kandidaten.json die deutschen Felder ausfüllen und
   "uebernehmen" auf true setzen (false = aussortiert, optional mit "notiz").

3. Spieldatei bauen:

       python3 tools/fetch_trivia.py build

   Schreibt data/wissen.json aus allen Einträgen mit "uebernehmen": true.

Das Skript braucht nur die Python-Standardbibliothek.
"""

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KANDIDATEN = ROOT / "tools" / "trivia" / "kandidaten.json"
WISSEN = ROOT / "data" / "wissen.json"

API = "https://opentdb.com/api.php"
TOKEN_API = "https://opentdb.com/api_token.php?command=request"
PAUSE = 5.5  # Die API erlaubt eine Anfrage alle fünf Sekunden.

# Kategorien der Open Trivia DB, die zu einem ruhigen Wissensspiel passen.
# Unterhaltung mit starkem US-Bezug (TV, Videospiele, Comics …) bleibt weg.
KATEGORIEN = {
    9: "Allgemeinwissen",
    17: "Natur & Wissenschaft",
    22: "Geografie",
    23: "Geschichte",
    25: "Kunst",
    27: "Tiere",
    20: "Mythologie",
    10: "Literatur",
    12: "Musik",
    19: "Mathematik",
}

# Fragen, die außerhalb der USA kaum jemand beantworten kann oder die sich
# schlecht übersetzen lassen, fliegen schon vor der Durchsicht raus.
US_LASTIG = re.compile(
    r"\b(U\.?S\.?A?\.?|United States|America(n|ns)?|state of|US state|"
    r"President|Congress|Senate|Super ?Bowl|NFL|NBA|MLB|NHL|NASCAR|"
    r"dollar bill|Civil War|Founding Father|Thanksgiving|Fahrenheit|"
    r"California|Texas|Florida|New York|Chicago|Washington|Hollywood|"
    r"British|UK|England|Scottish|Canadian|Australian)\b",
    re.IGNORECASE,
)
SCHLECHT = re.compile(
    r"(which of (these|the following)|\bnot\b|\bexcept\b|according to|"
    r"in the (video )?game|slang|spelled|spelling|acronym|stand for|"
    r"abbreviat|anagram|rhyme|in english)",
    re.IGNORECASE,
)
MAX_FRAGE = 130
MAX_ANTWORT = 40


def hole(url):
    req = urllib.request.Request(url, headers={"User-Agent": "trivia-fetch (python-urllib)"})
    with urllib.request.urlopen(req, timeout=30) as antwort:
        return json.load(antwort)


def entschluesseln(text):
    return urllib.parse.unquote(text).strip()


def frage_id(frage_en):
    return hashlib.sha1(frage_en.encode("utf-8")).hexdigest()[:10]


def brauchbar(frage, richtig, falsch):
    """Gibt (True, "") zurück oder (False, Grund)."""
    if len(frage) > MAX_FRAGE:
        return False, "Frage zu lang"
    if any(len(a) > MAX_ANTWORT for a in [richtig, *falsch]):
        return False, "Antwort zu lang"
    alles = " ".join([frage, richtig, *falsch])
    if US_LASTIG.search(alles):
        return False, "US-/UK-lastig"
    if SCHLECHT.search(frage):
        return False, "schlecht übersetzbar oder Negativfrage"
    if len({a.lower() for a in [richtig, *falsch]}) != 4:
        return False, "doppelte Antworten"
    return True, ""


def lade_kandidaten():
    if KANDIDATEN.exists():
        return json.loads(KANDIDATEN.read_text(encoding="utf-8"))
    return {
        "quelle": "Open Trivia Database (https://opentdb.com)",
        "lizenz": "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)",
        "fragen": [],
    }


def speichere(pfad, daten):
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cmd_fetch(args):
    daten = lade_kandidaten()
    bekannt = {f["id"] for f in daten["fragen"]}
    schwierigkeiten = set(args.schwierigkeit.split(","))

    token = hole(TOKEN_API).get("token", "")
    time.sleep(PAUSE)

    neu = verworfen = 0
    for kat_id, kat_name in KATEGORIEN.items():
        if args.kategorie and kat_id not in args.kategorie:
            continue
        menge = args.menge
        for _ in range(args.seiten):
            url = f"{API}?amount={menge}&category={kat_id}&type=multiple&encode=url3986&token={token}"
            try:
                antwort = hole(url)
            except urllib.error.HTTPError as fehler:
                if fehler.code == 429:
                    time.sleep(PAUSE * 2)
                    continue
                raise
            time.sleep(PAUSE)
            code = antwort.get("response_code")
            if code == 5:  # zu schnell gefragt
                time.sleep(PAUSE)
                continue
            if code in (1, 4):  # nicht (mehr) genug Fragen in dieser Kategorie
                if menge > 5:
                    menge //= 2
                    continue
                break
            if code != 0:
                print(f"  {kat_name}: Antwortcode {code}, überspringe", file=sys.stderr)
                break
            for roh in antwort["results"]:
                frage = entschluesseln(roh["question"])
                richtig = entschluesseln(roh["correct_answer"])
                falsch = [entschluesseln(a) for a in roh["incorrect_answers"]]
                fid = frage_id(frage)
                if fid in bekannt:
                    continue
                if roh["difficulty"] not in schwierigkeiten:
                    verworfen += 1
                    continue
                ok, _grund = brauchbar(frage, richtig, falsch)
                if not ok:
                    verworfen += 1
                    continue
                bekannt.add(fid)
                neu += 1
                daten["fragen"].append({
                    "id": fid,
                    "kategorie": kat_name,
                    "schwierigkeit": roh["difficulty"],
                    "frage_en": frage,
                    "richtig_en": richtig,
                    "falsch_en": falsch,
                    "frage_de": "",
                    "richtig_de": "",
                    "falsch_de": ["", "", ""],
                    "uebernehmen": None,
                })
        print(f"  {kat_name}: fertig")

    daten["fragen"].sort(key=lambda f: (f["kategorie"], f["id"]))
    speichere(KANDIDATEN, daten)
    print(f"{neu} neue Kandidaten, {verworfen} automatisch verworfen, "
          f"{len(daten['fragen'])} insgesamt in {KANDIDATEN.relative_to(ROOT)}")


SCHWIERIGKEIT_DE = {"easy": "leicht", "medium": "mittel", "hard": "schwer"}


def cmd_build(_args):
    daten = lade_kandidaten()
    karten = []
    for f in daten["fragen"]:
        if f.get("uebernehmen") is not True:
            continue
        if not f["frage_de"] or not f["richtig_de"] or not all(f["falsch_de"]):
            print(f"  {f['id']}: Übersetzung unvollständig, übersprungen", file=sys.stderr)
            continue
        karte = {
            "id": f"w-{f['id']}",
            "kategorie": f["kategorie"],
            "schwierigkeit": SCHWIERIGKEIT_DE[f["schwierigkeit"]],
            "modus": "beide",
            "frage": f["frage_de"],
            "richtig": f["richtig_de"],
            "falsch": f["falsch_de"],
        }
        if f.get("info_de"):
            karte["info"] = f["info_de"]
        karten.append(karte)
    karten.sort(key=lambda k: (k["kategorie"], k["id"]))
    speichere(WISSEN, {
        "quelle": "Open Trivia Database (https://opentdb.com), ins Deutsche übersetzt und bearbeitet",
        "lizenz": "CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)",
        "karten": karten,
    })
    print(f"{len(karten)} Wissensfragen nach {WISSEN.relative_to(ROOT)} geschrieben")


def cmd_liste(_args):
    """Kompakte Übersicht der noch nicht bearbeiteten Kandidaten."""
    for f in lade_kandidaten()["fragen"]:
        if f.get("uebernehmen") is None:
            print(f"{f['id']} [{f['kategorie']}/{f['schwierigkeit']}] {f['frage_en']} "
                  f"=> {f['richtig_en']} | {' ; '.join(f['falsch_en'])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="befehl", required=True)

    p_fetch = sub.add_parser("fetch", help="Fragen abrufen, filtern, Kandidatendatei ergänzen")
    p_fetch.add_argument("--menge", type=int, default=50, help="Fragen pro Anfrage (max. 50)")
    p_fetch.add_argument("--seiten", type=int, default=2, help="Anfragen pro Kategorie")
    p_fetch.add_argument("--schwierigkeit", default="easy,medium",
                         help="kommagetrennt: easy,medium,hard")
    p_fetch.add_argument("--kategorie", type=int, action="append",
                         help="nur diese Kategorie-ID der Open Trivia DB (mehrfach möglich)")
    p_fetch.set_defaults(func=cmd_fetch)

    p_build = sub.add_parser("build", help="data/wissen.json aus den Übersetzungen bauen")
    p_build.set_defaults(func=cmd_build)

    p_liste = sub.add_parser("liste", help="unbearbeitete Kandidaten kompakt ausgeben")
    p_liste.set_defaults(func=cmd_liste)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
