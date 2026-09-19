*[English](README.md) | [Deutsch](README.de.md)*

# Mercy SF Web-Dashboard

Eine Oberfläche im Browser für [Mercy SF](https://mercysf.app). Sie startet für
dich die offizielle `mercy-cli`, einen Prozess je Charakter, und zeigt, was
jeder davon tut: Level, Gold, Pilze, die Zähler für Arena und Verlies, das
legendäre Verlies, den Höllenaufzug, den Weltboss, die vier Klassen-Verliese der
Class World, welche Events laufen und ob die gelernten Kampfmodelle angekommen
sind.

Am Bot selbst ändert sie nichts. Alles läuft über die CLI, und die Anzeigen für
Ausrüstung, Gilde, Taverne und Post kommen über
[sf-api](https://github.com/the-marenga/sf-api) von the-marenga aus dem Spiel.

> **Auf eigene Gefahr.** Automatisiertes Spielen verstößt in der Regel gegen die
> Nutzungsbedingungen von Shakes & Fidget, und ein Konto kann dafür gesperrt
> werden, ob die Automatisierung über dieses Dashboard läuft oder direkt über
> die CLI. Dieses Dashboard ist außerdem in Entwicklung und wird Fehler haben.

---

## Installieren

Auf einem frischen Debian- oder Ubuntu-Server, als root:

```bash
curl -fsSL https://raw.githubusercontent.com/SenseiIssei/MercySF_Dashboard/main/install.sh | bash
```

Das ist die ganze Installation. Das Skript holt, was es braucht (Node.js, Rust
für die sf-api-Brücke, Werkzeuge zum Bauen, die Mercy-SF-CLI), legt ein
selbstsigniertes Zertifikat an und startet zwei Dienste.

Wenn es durch ist, öffne:

```
https://<IP-deines-Servers>:8080
```

Der Browser warnt wegen des selbstsignierten Zertifikats. Das ist so gewollt,
bestätige es und geh weiter.

Das Skript ein zweites Mal laufen zu lassen, aktualisiert nur den Code:
Accounts, Passwörter, Zertifikat und Statistiken bleiben, wie sie sind.

## Einrichten

**1. Zugang anlegen.** Die erste Seite fragt nach Benutzername und Passwort.
Denk sie dir jetzt aus: damit meldest du dich an *diesem Dashboard* an. Es ist
nicht dein Spiel-Konto.

Danach bekommst du zwei Schlüssel zu sehen, genau einmal. Die zwölf Wörter
setzen dein Passwort zurück, falls du es vergisst, und einen anderen Weg zurück
gibt es nicht. Leg sie an einen sicheren Ort.

**2. Spiel-Login hinzufügen.** Unter *Account-Verwaltung* trägst du deinen
Shakes-&-Fidget-Benutzernamen und das Passwort ein. Das Dashboard meldet sich
einmal an und findet jeden Charakter dieses Logins. Aus jedem wird ein Profil,
das du einzeln starten kannst.

Das Passwort wird verschlüsselt auf deinem Server abgelegt, damit spätere
Starts ohne Tippen auskommen. Es kommt nie in den Browser und steht nirgends im
Klartext.

**3. Charakter starten.** Auf Start daneben drücken. Die Übersicht füllt sich
innerhalb einer Minute mit echten Daten.

Mehr ist es nicht. Alles Weitere ist freiwillig.

---

## Freiwillig

### Mehrere Server

Ein Dashboard kann Accounts auf mehreren Maschinen fahren. Jede weitere bekommt
einen kleinen Knoten-Agenten ohne eigene Oberfläche:

```bash
curl -fsSL https://raw.githubusercontent.com/SenseiIssei/MercySF_Dashboard/main/install.sh | bash -s -- --node
```

Er zeigt einen Kopplungscode, fünfzehn Minuten gültig. Den trägst du im
Dashboard unter *Knoten* zusammen mit der Adresse der Maschine ein, danach
lassen sich Accounts dorthin verschieben.

### Randomizer

Entscheidet selbst, wann welcher Account spielt: zufällige Zeiten, Verteilung
auf deine Maschinen nach Priorität, ein VPN-Profil je Account. Standardmäßig
aus.

### Gelernte Kampfmodelle

Supporter-Lizenzen bekommen Kampfmodelle, die aus echten Kämpfen gelernt
wurden. Die Karte *Gelernte Modelle* sagt, ob sie angekommen sind, und die
Einstellung *Gelerntes Kampfmodell anwenden* entscheidet, ob ein Charakter sie
benutzt. Ohne Lizenz läuft der Bot auf den schlichten Algorithmen und sagt das
auch.

---

## Was der Betrieb kostet

Gemessen an einer laufenden Installation mit dreizehn Charakteren:

| | |
|---|---|
| Dashboard-Server | 130 MB, im Leerlauf unter 1 % eines Kerns |
| sf-api-Brücke | 14 MB |
| je Charakter | rund 15 MB, ein eigener CLI-Prozess |
| dreizehn Charaktere | zusammen rund 360 MB |

Ein kleiner VPS oder ein Raspberry Pi 4 trägt eine Handvoll Charaktere bequem.
Rechne mit etwa 150 MB plus 15 MB je Charakter.

Die Seiten hören auf zu fragen, solange der Tab im Hintergrund liegt. Ein
Telefon, das offen in der Tasche steckt, kostet also nichts.

---

## Sprache

Die Oberfläche gibt es auf Deutsch, Englisch, Tschechisch, Spanisch,
Französisch, Italienisch, Japanisch, Polnisch, Russisch und Chinesisch. Oben
rechts auswählen, die Wahl hängt an deinem Zugang.

Die Namen und Erklärungen der einzelnen Bot-Einstellungen gibt es auf Deutsch
und Englisch. In jeder anderen Sprache fällt diese Seite auf Englisch zurück.

## Wenn etwas klemmt

* **Die Seite hat kein Aussehen, oder eine Karte sagt, die CLI sei zu alt.** Die
  installierte CLI ist älter als das Dashboard erwartet. In der Seitenleiste
  unter *MercySF CLI* aktualisieren.
* **Ein Charakter startet nicht.** Prüfe, ob das Passwort hinterlegt ist, die
  *Account-Verwaltung* zeigt das je Login.
* **Ausrüstung, Gilde, Taverne und Post bleiben leer.** Die kommen von der
  sf-api-Brücke. `systemctl status mercy-sfapi-bridge` sagt, ob sie läuft.
* **Eine Karte sagt, der laufende Bot halte die Sitzung.** Ein Charakter kann
  nur einmal gleichzeitig eingeloggt sein. Die Karte versucht es von selbst noch
  einmal, der Knopf erzwingt es.

Fehler und Warnungen aller Charaktere sammeln sich oben rechts hinter der
Glocke.

---

## Herkunft und Lizenz

Dies ist ein Fork von
[MercySF_Dashboard von dandulox](https://github.com/dandulox/MercySF_Dashboard),
der ursprünglichen Arbeit, auf der das hier aufbaut. Die Ausrüstungsdaten laufen
über [sf-api](https://github.com/the-marenga/sf-api) von the-marenga. Der Bot
selbst ist [Mercy SF](https://mercysf.app).

Lizenziert unter der AGPL-3.0, wie das Original. Siehe [LICENSE](LICENSE).
