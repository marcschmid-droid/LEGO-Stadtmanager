# Brick City Manager v50.46

Includes the prepared v50.44 and v50.45 improvements, rebased on the current main branch's automated catalog update.

## Eight additions

1. Recently edited sets on the home page, with timestamps recorded for set data and module-assignment changes.
2. Up to 20 named collection views combining search, city area and confirmed condition/box/sale filters. Views synchronize with account state. Active filters reset on account changes.
3. JPG/PNG photos per exemplar, stored in account-scoped local IndexedDB. Photos can be embedded alongside exemplar information in the PDF. Image bytes stay on the device; only metadata synchronizes.
4. A collection goal and monthly planning budget. Wishlist offers with known shipping are compared in A/B/C priority order; estimated market values are excluded. This is a planning budget, not transaction accounting.
5. Per-set construction stage/bag and instruction-page bookmark, synchronized in collection state and included in the PDF.
6. Undo for up to ten collection/wishlist/module changes in the current device session, scoped by account. Restores collection data and placement without changing account/subscription metadata. This is not distributed conflict resolution. Receipt-file deletions are not reversed.
7. PDF preflight panel listing missing purchase prices, unknown condition and sets without recorded receipts. Missing fields remain explicitly unknown in the export; exporting incomplete records remains possible.
8. PDF table of contents with internal page links and outline bookmarks for cover, inventory, each detail sheet, receipt sections and documentation notes. Contents pages are inserted after the cover, and destinations/page numbering adjust accordingly.

## Validation

Run `scripts/test_customer_tools.cjs` and `scripts/test_wishlist_sharing.cjs` with jsdom and fake-indexeddb available on NODE_PATH. PDF and QR libraries are vendored. Integration includes all current legacy layers, v50.44, v50.45 and v50.46. Added checks exercise undo/timestamps, saved-view controls, construction-progress controls, filters, preflight and budget calculations. PDF samples exercise local exemplar images and construction progress, contents links, outline destinations and long-name inventory pagination. Rasterized PDF samples were visually inspected. JavaScript syntax checks and git whitespace checks passed.

No live purchase, email delivery or production database migration is part of validation. Browser/iPhone layout is not claimed as visually verified in this environment.

## Activation boundaries

Client-side features, PDF export and QR labels are included in this publication. Public wishlist reservation still requires `wishlist-sharing-v545.sql` in Supabase. The database migration cannot be executed from the available environment. Real paid subscriptions still require payment links/customer portal, subscription lifecycle webhooks and server-side tariff enforcement. These unavailable functions remain explicitly marked as incomplete in the app.
