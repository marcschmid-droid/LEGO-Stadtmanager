# Brick City Manager v50.47

## Available in the app

- Select several sets, update condition/storage/area/category and add tags in one operation. A local backup precedes batch changes.
- Compare two to four sets by dimensions, pieces, recorded price, condition, category and tags.
- Start an inventory with a fixed expected count; count boxes by set number, barcode or label QR URL, record found storage, review differences and export CSV. Inventory does not change owned quantities automatically.
- Record loans, due dates and returns. Open loans reduce available quantities.
- Use custom categories and searchable/filterable tags.
- Cloud writes check the loaded `updated_at` revision and stop on conflicts. Account-scoped local pending changes survive offline periods and reloads. Download both versions or explicitly choose a version; conflict resolution creates backups.

## Prepared, requires backend activation

`shared-collections-v547.sql` adds separate shared workspaces, owner/editor/viewer roles and revision-checked saves. Shared copies omit purchase prices, receipts and loan details. The SQL has not been executed against the live database; the UI reports unavailable backend tables.

`server-entitlements-v547.sql` is an optional Free limit enforcement migration after `billing-setup-v540.sql`. Activate it only after verified billing webhooks and server-side trials populate subscription periods. Existing over-limit collections remain editable. Checkout links, billing portal and actual payment lifecycle activation still require configuration and database/server access. Local trial state is deliberately not trusted by the proposed server trigger.

Older app versions do not send revision-conditional cloud writes. Users should refresh/reopen devices to load v50.47; unconditional writes from old clients cannot be prevented solely by the new client.

## Validation

Node syntax checks, jsdom integration checks (batch edits, comparison, inventory count/QR parsing, loan availability/returns, shared-copy privacy, conditional cloud writes/conflict preservation), existing workflows and mock wishlist sharing passed. PDF regression generated an eight-page portfolio, a 200-set compact portfolio and QR labels without runtime errors. Database RLS/real payment flows require staging tests when backend access is available.
