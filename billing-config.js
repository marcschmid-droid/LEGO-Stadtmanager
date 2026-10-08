// Brick City Manager commercial billing configuration.
// Public configuration only. Never put Stripe secret keys in this file.
window.BRICK_BILLING = {
  mode: "commercial",
  serverEnabled: false, // Enable only after deployment and webhook/payment tests.
  currency: "EUR",
  collector: {
    monthly: { priceId: "price_1UNxuFBrfEi477jIEBvZcG9i", amount: 3.99, paymentLink: "" },
    yearly: { priceId: "price_1UNxuHBrfEi477jIT63hiLXg", amount: 39.99, paymentLink: "" }
  },
  pro: {
    monthly: { priceId: "price_1UNxuYBrfEi477jIz8Xy5YFw", amount: 6.99, paymentLink: "" },
    yearly: { priceId: "price_1UNxueBrfEi477jIC29gV93R", amount: 69.99, paymentLink: "" }
  },
  customerPortal: "",
  supportEmail: "Marcschmid@t-online.de"
};
