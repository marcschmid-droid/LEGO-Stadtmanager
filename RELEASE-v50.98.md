# v50.98 — Registrierung und verlässliches Speichern

- Anmeldung und Registrierung mit dauerhafter Bestätigungsanzeige, Rückkehr zur Anmeldung, erneutem Linkversand und Passwort-Wiederherstellung.
- Manuelles Speichern wartet auf eine laufende automatische Cloud-Speicherung.
- Fehlgeschlagene Erstverbindung kann mit manuellem Synchronisieren erneut geladen werden. Versions- und Kontoschutz bleiben aktiv.
- Vollständige Setformulardaten werden gespeichert und gegen den Cloud-Stand geprüft. Fehlende Preise bleiben unbekannt; neue Sets erhalten ein Hinzufügedatum.
- Mobile Formulare scrollen im Inhaltsbereich. Abbrechen/Speichern bleiben im sichtbaren Bereich oberhalb der Bildschirmtastatur.
- Preisalarme fragen nur vorhandene Spalten ab. Eine eigene SELECT-Policy erlaubt angemeldeten Nutzern ausschließlich ihre eigenen Preisalarme.

Prüfung: Node-Regressionstests; automatisierte Chromium-/WebKit-Prüfung der Registrierung mit abgefangenen Testantworten und der Hochformat-/Tastaturhöhe. Diese Tests versenden keine echten Bestätigungsmails und ändern keine echten Sammlungen.

Die bestehende serverseitige E-Mail-Vorlage wird durch dieses Release nicht umkonfiguriert.
