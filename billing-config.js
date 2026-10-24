// Brick City Manager commercial billing configuration.
// Public configuration only. Never put Stripe secret keys in this file.
window.BRICK_BILLING = {
  mode: "commercial",
  serverEnabled: false, // Enable only after verified Stripe webhook, backend deployment, and end-to-end tests.
  currency: "EUR",
  basic: {
    monthly: { priceId: "price_1UU5XOBrfEi477jIihFj7jc5", amount: 3.99, paymentLink: "" },
    yearly: { priceId: "price_1UNxuHBrfEi477jIT63hiLXg", amount: 39.99, paymentLink: "" }
  },
  premium: {
    monthly: { priceId: "price_1UU5XkBrfEi477jIK6oXrC6E", amount: 6.99, paymentLink: "" },
    yearly: { priceId: "price_1UNxueBrfEi477jIC29gV93R", amount: 69.99, paymentLink: "" }
  },
  customerPortal: "",
  supportEmail: "Marcschmid@t-online.de"
};
