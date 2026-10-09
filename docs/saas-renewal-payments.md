In the superadmin dashboard, open Subscriptions and fill the SaaS receiving UPI account card with the real UPI ID and registered payee name. This saves the receiving account in the database. Alternatively, configure an initial receiving account on the Smart Society server:

```
SMARTSOCIETY_SAAS_UPI_ID=your-real-upi-id
SMARTSOCIETY_SAAS_PAYEE_NAME=your-registered-payee-name
```

The QR is generated locally. Admin submits the payment transaction reference; this is a claim, not proof of receipt. Superadmin checks the receiving account and verifies or rejects the record under Subscriptions. Only verification extends the assigned plan. Repeated verification is rejected. No payment account is invented by default. The society needs an active assigned plan before renewal.
