# Alltag und Synchronisierung – Stand 605

- Lokale Wiederherstellungspunkte rotieren mit maximal zwei Vollkopien. Bei Quota-Fehlern versucht derselbe atomare Schreibvorgang einen einzelnen aktuellen Punkt. Bei weiterem Fehler bleibt der bisherige Speicher erhalten und der bestätigte Dateiexport bleibt erforderlich.
- Die Konfliktansicht zeigt lokale und Cloud-Bestände getrennt nach verschiedenen Sets und Exemplaren. Die Statusleiste führt direkt zum Konflikt oder zur Speicherprüfung. Die Cloud-Übernahme liest weiter frisch und überschreibt keine Cloud-Daten.
- `release-version.json` ermöglicht eine Update-Meldung alle fünf Minuten sowie nach Rückkehr oder Wiederverbindung. Es gibt kein erzwungenes Neuladen. Offene Formulare blockieren das Neuladen; unbestätigte Änderungen erfordern einen Dateiexport mit expliziter Bestätigung. Frühere App-Versionen ohne diese Funktion müssen einmal manuell aktualisiert werden.
- Die Startseite zeigt bei fehlenden Werten den bewerteten Teilbetrag und seine Abdeckung. Teilweise bewertete Mehrfachbestände tragen nur mit tatsächlich bekannten Exemplarpreisen bei. Bei widersprüchlicher Exemplarzahl bleibt der betroffene Bestand aus der Teilsumme ausgeschlossen. Rendite bleibt bei Lücken offen.
- Die Bestandsanzeige nennt verschiedene Sets und die gesamte Exemplarzahl. Eine Liste fehlender Bewertungen öffnet den jeweiligen Exemplareditor; fehlende Exemplare oder Mengenwidersprüche öffnen das Setformular.
- Die Kontoseite priorisiert Anmeldung, Tarif und Synchronisierung. Sicherungen, gemeinsame Sammlungen und Löschfunktionen sind eingeklappt; vorhandene Formulare und Eventhandler bleiben erhalten.

Die Änderungen erfordern keine Datenbankänderung und verändern keine Zustandsangaben oder Tarife automatisch.

Validierung: Node-Regressionen für Teilwerte, Mengenwidersprüche, Einzelwerte und Quota-Rotation; Chromium/WebKit-Produktionsseiten mit künstlichen Konten prüfen Teilwerte, direkte Bearbeitung, Kontogruppierung, schmale Ansichten und Update-Meldung. Bestehende Anmelde-, Speicher- und Offline-Prüfungen laufen ebenfalls.
