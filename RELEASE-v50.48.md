# Brick City Manager v50.48

## Customer improvements

- Set recognition checks loaded enrichment and the full local catalogue first. Concurrent identical lookups share a request, online calls have a deadline, and late responses cannot fill a changed form. Known set numbers and label QR links use the same flow. Unknown barcodes open manual entry without claiming a verified mapping.
- Collection rendering initially shows 36 cards, with more loaded in batches. Search resets the visible count; summaries and batch selection cover all matching sets. Hidden secondary panels wait until opened. Images are lazy, and versioned static assets use the service worker cache immediately. The app shell is cached for offline reopening.
- One actionable start guide replaces the overlapping welcome dialogs: add/scan/import, view the collection, and save a portable backup.
- Value details and cards show the recorded source, source date, condition and estimation status. Unknown dates and missing values are explicit; values are not represented as guaranteed sale or insurance amounts.
- Portable JSON backups include local receipt and exemplar image bytes and a SHA-256 checksum. Imports are validated and previewed, then create a current-state snapshot before replacement. New image IDs avoid overwriting previous images on failure. Legacy/local JSON points reuse available device images. Maximum portable image payload is 50 MB; import files are limited to 80 MB. Separate local snapshots are account scoped.
- An embedded, lazily loaded DejaVu Sans subset keeps PDF typography consistent across devices. PDF presets cover personal documentation, insurance documentation and sale. Selected-set export is available. Sale omits recorded purchase prices and seller details; receipts and locations are off by default. Insurance export identifies the document as an inventory record rather than a confirmed replacement-value appraisal.
- Shared collections are now activated in Supabase. Separate copies omit private prices, receipts and loan recipients. Owner/editor/viewer permissions and revision-conditional writes were verified with rollback fixtures; no test accounts or collections remain.

## Billing deployment and remaining activation

The billing Edge Function, subscription/customer/event tables and service-only secret access are deployed. A dedicated Stripe portal configuration supports invoices, payment methods, tariff updates and period-end cancellation. Seven lifecycle events are registered to the deployed webhook. The signing secret is encrypted in Supabase Vault; it is not committed. Live checks accepted a valid signature, rejected an invalid signature and rejected unsigned unauthenticated writes. Event duplication and out-of-order delivery were tested transactionally.

The deployed readiness check reports `ready: false`: `STRIPE_RESTRICTED_KEY` is not configured in Edge Function secrets. The Stripe connector cannot supply a restricted API key, and the Supabase connector cannot set project environment secrets. Set this key securely in Supabase, then complete sandbox checkout/renewal/failure/cancellation testing and verify tax settings before switching `BRICK_BILLING.serverEnabled` to true. No real payment has been initiated. The optional Free-limit trigger remains unactivated until server-side billing and trials are ready; existing local access remains while billing is pending.

## Validation

JavaScript syntax and jsdom integration checks cover local recognition, stale responses, portable image/checksum backups, previewed restoration, 500-set bounded rendering, batch/inventory/loans/conflicts and a disabled unconfigured checkout. Stripe SDK signature tests and pure billing-object mapping tests passed. Database RLS, editor conflict handling, event order/deduplication and secret access were checked using rolled-back fixtures. PDF portfolio, compact 200-set report, sale and insurance variants and labels were generated; cover and detail pages were visually inspected.
