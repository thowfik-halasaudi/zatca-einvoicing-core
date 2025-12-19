# Step 2: Issue Compliance CSID

This guide explains how to perform the **Compliance CSID Issuance** (Step 2) independently. This is useful if you have already generated the CSR (Step 1) and now just need to exchange it for a certificate.

---

## 🎯 Purpose

Request a **Binary Security Token** and **API Secret** from ZATCA using an existing CSR file already stored on the server.

---

## 🚀 API Endpoint (Step 2 Only)

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/issue-csid`

### Headers

| Key            | Value              |
| :------------- | :----------------- |
| `Content-Type` | `application/json` |

### Raw Body (JSON)

You only need to provide the **unique identifier** (commonName) and the **OTP**. The server will automatically find the matching CSR file in the `onboarding_data` folder.

```json
{
  "commonName": "HILTONGROUP",
  "otp": "123456",
  "production": false
}
```

---

## 🔄 How it Works

1.  **Search**: The server looks for `onboarding_data/hiltongroup/egs-registration.csr`.
2.  **Issuance**: The server calls ZATCA's `/compliance` API with that CSR and your OTP.
3.  **Persistence**: The server saves the results back into the same folder.
    - `ccsid-certificate.pem` (The Certificate)
    - `ccsid-secret.txt` (The API Secret)

---

## ✅ Postman Success Response

```json
{
  "certificate": "-----BEGIN CERTIFICATE-----\n...",
  "secret": "xxxx",
  "requestId": "123456789",
  "message": "Compliance CSID issued and stored for HILTONGROUP."
}
```

---

## ⚠️ Important Considerations

- **Prerequisite**: You must have run **Step 1** (or the full onboard) at least once so that the CSR file exists on disk.
- **OTP Expiry**: ZATCA OTPs are valid for only **60 seconds**.
- **Folders**: If you change the `commonName`, the server will look in a different folder. Make sure the name matches exactly where your CSR is stored.
