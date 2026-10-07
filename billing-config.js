// Brick City Manager commercial billing configuration.
// Public configuration only. Never put Stripe secret keys in this file.
window.BRICK_BILLING = {
  mode: "commercial",
  currency: "EUR",
  collector: {
    monthly: { amount: 3.99, paymentLink: "" },
    yearly: { amount: 39.99, paymentLink: "" }
  },
  pro: {
    monthly: { amount: 6.99, paymentLink: "" },
    yearly: { amount: 69.99, paymentLink: "" }
  },
  customerPortal: "",
  supportEmail: "Marcschmid@t-online.de"
};
