# Step 4: Compliance Check

This guide explains how to send your **Signed XML** to ZATCA for validation. This is a mandatory step before you can move to the production environment.

---

## 🎯 Purpose

The goal of this step is to:

1.  **Verify Compliance**: Let ZATCA's API validate your XML structure, signature, and QR code.
2.  **Ensure Readiness**: ZATCA requires successful compliance checks for different invoice types (Standard, Simplified) before issuing a Production CSID.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/check`

### Headers

| Key            | Value              |
| :------------- | :----------------- |
| `Content-Type` | `application/json` |

### Raw Body (JSON)

Use the same `commonName` and `invoiceSerialNumber` you used in Step 3.

```json
{
  "commonName": "RADISSONGROUP",
  "invoiceSerialNumber": "INV-2025-001"
}
```

---

## 🔄 How it Works

1.  **Security Tokens**: The server automatically loads your `ccsid-certificate.pem` and `ccsid-secret.txt`.
2.  **File Retrieval**: It looks for the signed XML in `tmp/radissongroup/INV-2025-001_signed.xml`.
3.  **Data Extraction**: It automatically extracts the **Invoice Hash** and **UUID** from the XML.
4.  **ZATCA API call**: It calls ZATCA with the Base64-encoded XML.

---

## ✅ Expected Response

If successful, ZATCA will return a validation report:

```json
{
  "validationResults": {
    "infoMessages": [],
    "warningMessages": [],
    "errorMessages": [],
    "status": "PASS"
  },
  "reportingStatus": "REPORTED",
  "message": "Compliance check completed for INV-2025-001."
}
```

> [!IMPORTANT]
> If `status` is **PASS**, your invoice is compliant! If there are **errorMessages**, read them carefully as they describe exactly what is wrong with the XML structure or signing.

---

**Next Step**: Once you have passed compliance, you can move to **Step 5: Production CSID & Reporting**!
