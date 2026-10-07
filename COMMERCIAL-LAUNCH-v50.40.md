# Brick City Manager – Commercial Launch v50.40

## Status

Commercial Launch ist technisch vorbereitet und öffentlich ausgerollt.

### Bereit
- Öffentliche Web-App / PWA
- Free / Collector / Pro-Preisstruktur
- Registrierung und Cloud-Synchronisation
- Impressum
- Datenschutz
- AGB
- Widerrufsbelehrung
- Checkout-Oberfläche mit Pflichtbestätigung
- Kaufbutton mit eindeutiger Formulierung „Zahlungspflichtig bestellen“
- Billing-Konfiguration ohne Secret Keys im Frontend
- Launch-Status in der App

### Noch vor echten Zahlungen
1. Stripe-Konto verbinden.
2. Produkte und vier Preise erstellen:
   - Collector monatlich 3,99 EUR
   - Collector jährlich 39,99 EUR
   - Pro monatlich 6,99 EUR
   - Pro jährlich 69,99 EUR
3. Payment Links in `billing-config.js` eintragen.
4. Stripe Webhook an ein serverseitiges Backend / Supabase Edge Function anbinden.
5. Tarifstatus serverseitig aus Stripe-Events setzen.
6. Rechtstexte vor endgültigem entgeltlichen Marktstart anwaltlich / fachlich prüfen.

## Sicherheitsregel
Keine Stripe Secret Keys in GitHub Pages oder JavaScript hinterlegen. Im Browser dürfen ausschließlich öffentliche Checkout-Links und Publishable Keys verwendet werden.

## Launch-KPI
Erste Zielmarke: 100 zahlende Kunden.
Nächste Zielmarke: 500 zahlende Kunden.
