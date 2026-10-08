# Brick City Manager v50.45 - customer tools

## PDF collection portfolio (priority)

In Collection, open **Sammlung nutzen & dokumentieren → PDF-Sammlungsmappe**. Options: optional cover name, set detail sheets, photos, receipt appendix and storage locations.

The actual downloadable PDF contains a cover, inventory with quantities and recorded purchase prices/estimated values, optional per-set detail sheets, known purchase/exemplar information, condition, storage, missing parts, instruction links and local receipt images. It reports unavailable photos and receipts. Long text and exemplar lists continue onto additional pages; every page has a footer and page number. Prices remain explicitly labelled as estimates and recorded data, not verified sale/insurance values.

jsPDF and QR generation are bundled and loaded only when an export is requested. Photos are prepared with at most eight concurrent downloads and a four-second timeout per photo. The app does not require a PDF server or payment integration for PDF export.

## Other customer tools

- Official LEGO instructions linked by set number from the set details.
- QR storage labels exported as A4 PDF, 21 labels per page. Scanning opens that set in the app after login. Labels include set number, name and recorded storage location.
- Missing parts recorded in set details as `part; color; quantity`, with quantities applying to the complete recorded stock of that set. Aggregated shopping list exported as CSV; duplicate part/color entries are combined.
- Receipt JPG/PNG uploads up to 5 MB stored in account-scoped local IndexedDB. Metadata synchronizes with collection state; the receipt images themselves are device-local and may be missing on another device. Available receipt images can be embedded in the PDF appendix.
- Editable sales-description drafts, copy/download actions and completeness prompts. No marketplace publication is performed.
- Opt-in price alerts based on saved offer price + known shipping, matching condition and the user's limit. Existing estimated-market-value notices are named separately. The existing daily server worker now checks opted-in saved offers, escapes email text, and avoids re-emailing already recorded daily events.
- Build suggestions from owned, not-yet-built sets using known footprint and a rough time estimate (0.3 minutes per part). Unknown dimensions/time are excluded; no alternative-model or loose-parts inventory matching is claimed.
- Explicit wishlist sharing with minimal public data, public viewer, atomic gift reservation and token-based release. Sharing publishes only set number, name and priority; no storage, prices, receipts or collection data are included.
- Cross-origin authenticated cloud GET requests are excluded from the static service-worker cache.

## Validation

`NODE_PATH=/path/to/test/node_modules node scripts/test_customer_tools.cjs`

Test dependencies: `jsdom`, `fake-indexeddb`; jsPDF and QR code use the vendored files in this repository. Generated validation PDFs go to a temporary directory.

DOM integration checked the current seed, legacy app layers, v50.44 and v50.45 together with no JavaScript runtime errors. Checks included account-separated snapshots and receipt storage, import deduplication/limits, server entitlement states, offer shipping/condition handling, missing-part aggregation, CSV formula escaping, sales text, PDF photo/receipt embedding and QR generation. A sample portfolio produced seven pages; a stress-test overview with 200 long-named sets produced 17 pages. Representative corrected pages were rasterized and visually checked. PDF text extraction verified the first and last stress-test set numbers.

`NODE_PATH=/path/to/test/node_modules node scripts/test_wishlist_sharing.cjs`

Public viewer tested with a mock backend: safe literal rendering of HTML-like names, reservation, release and token cleanup. Server offer helper tested with six input cases. JavaScript/Python syntax checks and `git diff --check` passed.

## Activation requirements and unverified operations

- This local commit is not published. The previous automatic approval review blocked a push to `main`; no attempt to circumvent that block was made.
- Wishlist reservation requires applying `wishlist-sharing-v545.sql` to the existing Supabase project. No database connection is available here, so the migration and real multi-client reservation were not executed/tested. The UI does not return a share link if publishing fails.
- Email delivery still depends on the existing workflow's server-role and mail-provider configuration plus user opt-in. No emails were sent during tests. This is not a live retailer-price crawler.
- External photo embedding depends on the source permitting browser access. Missing photos are reported rather than fabricating them.
- Browser/iPhone visual testing was unavailable. Actual downloadable PDFs were generated and rendered through the same PDF builder, with DOM tests for the app controls.
- Paid subscriptions and server-side tariff enforcement remain pending as documented in v50.44.
