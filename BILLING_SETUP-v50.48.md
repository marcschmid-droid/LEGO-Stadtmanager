# Finish billing activation

Supabase project: LEGO Stadtmanager (`eeiokqujnpaxgncmcvsi`). Stripe account: Marc Schmid (live).

Already deployed: `billing` Edge Function, service-only customer ownership/event reconciliation, encrypted webhook signing secret, four server-selected recurring prices, and a portal configuration for invoices, payment methods, tariff changes and period-end cancellation.

1. Create a restricted Stripe API key in the account Dashboard. Use a separate sandbox for payment lifecycle testing. The function needs Customers read/write, Checkout Sessions write, Subscriptions read, Prices read, and Billing Portal sessions/configuration access. No transfers, payouts or account administration access is needed. Restrict the key as supported by the account.
2. Store it as `STRIPE_RESTRICTED_KEY` in Supabase Edge Function secrets. Do not paste keys into chat, repository files or browser configuration. The function uses Supabase's built-in server environment keys and the signing secret stored in Vault.
3. Confirm `GET /functions/v1/billing` reports ready. This checks configuration presence; it does not replace payment testing. Configure a separate sandbox's matching price IDs and webhook secret for sandbox deployment; the committed IDs are live prices.
4. Test checkout using verified application accounts, webhook replay/order, asynchronous success, renewal, failed payment, tariff changes and cancellation. Confirm client JSON/return URL changes never grant a tariff and that a customer cannot access another customer's portal.
5. Check tax treatment and applicable registrations before collecting real payments. Automatic Tax has not been enabled or assumed. Ensure Stripe's business terms URL is configured for Checkout's required terms consent.
6. Publish `BRICK_BILLING.serverEnabled: true` only after these tests. Then activate `server-entitlements-v547.sql` only when server-controlled trials are also in place. Never trust a client timestamp to grant a trial.

Webhook events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

The Supabase connector can deploy functions and migrations, but it cannot create a Stripe restricted key or set Edge Function environment secrets. Checkout remains disabled until activation is complete.
