# 01: CSR Generation

This is the **first step** in the ZATCA onboarding flow. You generate your digital identity locally.

---

## 🎯 Purpose

1.  **Generate a Private Key**: Used later for signing invoices.
2.  **Generate a CSR**: A request file you send to ZATCA to get your certificate.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/onboard`

### Raw Body (JSON)

```json
{
  "commonName": "RADISSONGROUP",
  "serialNumber": "1-Radisson|2-HMS|3-4b7a1c92-6f3d-4c2e-9a8f-1e9b2c7d5f44",
  "organizationIdentifier": "301245987500003",
  "organizationUnitName": "Radisson Blu Hotel Riyadh",
  "organizationName": "Radisson Group",
  "countryName": "SA",
  "invoiceType": "1100",
  "locationAddress": "Al Rashid St, Riyadh 13241, Saudi Arabia",
  "industryBusinessCategory": "Hospitality",
  "production": false
}
```

---

## ✅ Results

Files saved in `onboarding_data/radissongroup/`:

- `egs-signing-key.pem`
- `egs-registration.csr`
