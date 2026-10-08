# Brick City Manager v50.44

## Implemented

- Existing v50.41–43 collector sort and deferred catalog loading retained.
- New panels render only when their tab is visible; collection/wishlist images decode asynchronously and load lazily.
- Five account-scoped local recovery points, automatic snapshots at most every 15 minutes during edits, manual snapshots, JSON export/import, validation and snapshot before restoration. These are local device backups, not an independent server backup service.
- Automatic cloud writes now show success/failure, copy state before sending, and scope completion status to the account initiating the write. Offline changes stay local; returning online retries synchronization.
- Set details explain that valuations are estimates and show condition, original-box information and source dates. Existing collector valuation remains unchanged.
- Batch set-number import (maximum 100 distinct numbers): catalog preview, repeated numbers as quantities, existing/unknown sets skipped, tariff limit enforced before applying, snapshot before import, unknown purchase prices left at zero.
- Existing central learning of unknown barcodes and missing-set series views retained.
- Up to ten named city-plan variants with save, compare, restore and delete. Instance placement maps included. Module occupancy, free modules, conflicting occupancy and insufficient assigned modules are reported.
- Wishlist compares existing ownership and known footprints with free connected module blocks. Unknown footprints are clearly labelled.
- Contextual first-use steps for collection, collector series and city planning.
- Subscription status loaded from existing Supabase `my_subscription` RPC; active/canceled server status reflected in the interface. Readiness checklist and customer-portal action provided.
- App assets and service-worker cache upgraded together to v50.44.

## Validation

- JavaScript syntax checks for app-v3.js, improvements-v544.js and service-worker.js.
- DOM integration run against current seed-data.js/app.js/app-v3.js and the new enhancement layer using jsdom.
- Import parser, duplicate quantities, existing-set skip, invalid backup rejection, backup account separation, plan save/restore, known wishlist footprint fit, canceled/active server entitlement and absent payment-link detection exercised.
- No JavaScript runtime errors during the DOM integration run.
- Browser visual testing could not run: the Chromium download was unavailable in this environment. No iPhone visual verification or live-payment test is claimed.

## Remaining external configuration / limits

`billing-config.js` still contains four empty payment links and an empty customerPortal. There is no deployed Stripe subscription webhook in this repository. Real checkout, renewal, failed payment, automatic entitlement fulfillment, cancellation and tax handling therefore remain unverified and are explicitly shown as incomplete. Local UI checks do not enforce tariff rights server-side. Server enforcement, authenticated Checkout and lifecycle webhooks must be completed before paid subscriptions can be described as ready. Consider Stripe Tax only with the appropriate tax registration and configuration.

City collision checks operate at module level. Precise geometric collision checks require model footprints and coordinates; no such precision is claimed. Market-value improvements provide transparency, not new verified transaction data or calibrated prices. No automatic conflict merge for simultaneous edits on multiple devices is introduced.
