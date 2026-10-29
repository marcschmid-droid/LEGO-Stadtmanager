# Verwaltbare Freigaben und bereinigte Sammlungsanzeige

- „Sammlung teilen“ lädt die eigene Freigabe. Auswahl und Vorschau verändern sie noch nicht. Erst „Freigabe erstellen“ bzw. „Auswahl veröffentlichen“ speichert die öffentliche Auswahl.
- Aktualisierungen behalten denselben Link. Deaktivieren unterbindet neue Abrufe. Bereits kopierte Inhalte können nicht zurückgeholt werden. Alte Fragment-Momentaufnahmen bleiben lesbar und werden ausdrücklich als unveränderbar gekennzeichnet.
- Ein Link je Konto, höchstens zwölf ausgewählte Sets. Erlaubte Felder und Bildquellen werden im Browser und in der Datenbank geprüft. Besitzerverwaltung wird durch RLS geschützt; der öffentliche Zugriff benötigt einen zufälligen UUID-Link und gibt nur das öffentliche Payload zurück.
- Zwei ältere Reparatur-/Darstellungs-Skripte werden nicht mehr geladen. Die aktive Anzeige aktualisiert sich gebündelt bei Änderungen statt jede 1,2 Sekunden alle Datensätze zu serialisieren. Unveränderte Karten bleiben erhalten, auch beim Wechsel zwischen Ansichten. Einheitliche Kennzahlen zeigen fehlende Werte weiterhin als unbekannt.

Datenbankschema: `supabase/managed-showcase.sql` (bereits im verbundenen Projekt angewendet).
Live-SQL-Regression: `supabase/tests/managed-showcase.sql`, vollständig zurückgerollt; Besitzertrennung, Schutz zusätzlicher Felder, öffentlicher Einzelabruf, Aktualisierung und Deaktivierung bestanden.
Browserprüfungen verwenden ausschließlich abgefangene Dienste und Beispieldaten.
