# Lagetraining Admin

Kleines, in ArcGIS Experience Builder einbettbares Verwaltungsmodul für relationale Zuordnungen im virtuellen Lagetraining.

## Erste Funktion

**Fahrzeug → Heimatwache**

- Fahrzeuge aus `vehicles` laden
- Orte aus `locations` auf Feuerwachen filtern
- `locations.GlobalID` in `vehicles.home_location_id` speichern
- Änderungen mit den Rechten des angemeldeten ArcGIS-Benutzers ausführen

## Einrichtung

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `public/config.example.js` nach `public/config.js` kopieren.
3. In `public/config.js` eintragen:
   - ArcGIS-Portal-URL
   - OAuth-App-ID
   - REST-URL des `vehicles`-Layers
   - REST-URL des `locations`-Layers
   - tatsächliche Feldnamen
4. Anwendung starten:

   ```bash
   npm start
   ```

5. Cloudflare auf Port 3002 weiterleiten und die öffentliche URL als OAuth-Redirect-URI registrieren.

## Sicherheit

Die Anwendung enthält keine ArcGIS-Zugangsdaten. Sie verwendet ArcGIS OAuth und schreibt mit den Berechtigungen des angemeldeten Trainers. Die Feature-Layer-Sicht bleibt die maßgebliche Berechtigungsgrenze.

## Einbettung

Die Anwendung ist für eine Einbettung in Experience Builder vorgesehen. Der Server erlaubt Frames von `experience.arcgis.com` und `*.arcgis.com`.
