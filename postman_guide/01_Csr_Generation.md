# Step 1: Generate Keys & CSR

This guide explains how to generate the **Private Key** and **CSR** (Step 1 of the ZATCA workflow).

---

## 🎯 Purpose

The goal of this step is to:

1.  **Generate a Private Key**: Used for signing your invoices.
2.  **Generate a CSR**: Used to request your certificate from ZATCA.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/onboard`

> [!NOTE]
> In our implementation, this endpoint is shared with Step 2. You can generate just the CSR by providing an OTP, or if you only need the CSR for local testing, the same logic applies.

### Headers

| Key            | Value              |
| :------------- | :----------------- |
| `Content-Type` | `application/json` |

### Raw Body (JSON)

```json
{
  "commonName": "HILTONGROUP",
  "serialNumber": "1-Hilton|2-HMS|3-4b7a1c92-6f3d-4c2e-9a8f-1e9b2c7d5f44",
  "organizationIdentifier": "302567894600003",
  "organizationUnitName": "Hilton Riyadh Hotel and Residences",
  "organizationName": "Hilton Worldwide Saudi Arabia",
  "countryName": "SA",
  "invoiceType": "1100",
  "locationAddress": "Eastern Ring Rd, Riyadh 13241, Saudi Arabia",
  "industryBusinessCategory": "Hospitality",
  "production": false
}
```

---

## ✅ Results

The server saves the following files in `onboarding_data/[commonName]/`:

- `egs-signing-key.pem` (EC secp256k1 private key)
- `egs-registration.csr` (ZATCA compliant CSR)
- `onboarding-config.properties` (Input configuration)
