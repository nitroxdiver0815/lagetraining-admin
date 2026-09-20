# Lagetraining Admin

In ArcGIS Experience Builder einbettbares Verwaltungsmodul für relationale Zuordnungen im virtuellen Lagetraining.

## Stammdatenfunktion

### Fahrzeug → Heimatwache

Startseite:

```text
/
```

- Fahrzeuge aus `vehicles` laden
- Feuerwachen aus `locations` laden
- `locations.GlobalID` in `vehicles.home_location_id` speichern

## Szenarioverwaltung

Die Werkzeuge besitzen getrennte URLs und können einzeln in die Ansichten eines Abschnitts-Widgets eingebettet werden.

| Ansicht | URL |
|---|---|
| Orte | `/scenario-orte.html` |
| AAO / Alarmierung | `/scenario-aao.html` |
| Fahrzeuge | `/scenario-fahrzeuge.html` |

Optional kann ein Szenario übergeben werden:

```text
/scenario-orte.html?scenario_id=<GlobalID>
/scenario-aao.html?scenario_id=<GlobalID>
/scenario-fahrzeuge.html?scenario_id=<GlobalID>
```

Ohne URL-Parameter wird das Szenario innerhalb des jeweiligen Werkzeugs ausgewählt.

### Orte

Schreibt und löscht Zuordnungen in `scenario_locations`:

- Szenario
- vorhandener Ort
- Rolle
- Reihenfolge
- primärer Ort
- Hinweise

### AAO / Alarmierung

Erstellt oder aktualisiert den Datensatz in `scenario_dispatch` und verbindet ihn über `initial_abek_id` mit der `GlobalID` des Datensatzes im separaten `abek_catalog`. In der Auswahlliste erscheinen nur Datensätze mit `is_active = 1`.

Die Sprechgruppen werden aus der eigenständigen Tabelle `radio_talkgroups` (Tabellen-ID 0) geladen. Angezeigt werden `talkgroup_name` und optional `display_name`; nach der Auswahl wird `short_dial` automatisch übernommen. Es werden nur Datensätze mit `is_active = 1` geladen und nach `display_order` sortiert.

Als eindeutige technische Kennung genügt die von ArcGIS automatisch gepflegte `GlobalID`. Ein zusätzliches Feld `talkgroup_id` wird von der Anwendung nicht verwendet und ist nicht erforderlich. In `scenario_dispatch` werden derzeit `talkgroup_name` und `talkgroup_short_dial` gespeichert.

### Fahrzeuge

Schreibt und löscht Zuordnungen in `scenario_vehicles`:

- Szenario
- vorhandenes Fahrzeug
- Startwache
- Besatzung
- Alarmierungsreihenfolge
- primäres Fahrzeug
- Hinweise

## Lokale Einrichtung

```bash
npm install
npm start
```

Anschließend: `http://localhost:3002`

## Konfiguration

Die Datei `public/config.js` enthält:

- ArcGIS-Portal-URL
- OAuth-App-ID
- Trainer-Feature-Service
- ABEK-Feature-Service
- Sprechgruppen-Feature-Service
- Layer-IDs und Feldnamen

## Sicherheit

Die Anwendung enthält keine ArcGIS-Zugangsdaten. Sie verwendet ArcGIS OAuth und schreibt mit den Berechtigungen des angemeldeten Trainers. Die Feature-Layer-Sicht bleibt die maßgebliche Berechtigungsgrenze.

## Einbettung

Der Server erlaubt Frames von `experience.arcgis.com` und `*.arcgis.com`. Für den Betrieb in Experience Builder ist eine öffentlich erreichbare HTTPS-Adresse erforderlich.
