# 02: Get Compliance CSID

In this step, you exchange your CSR for a **Compliance Certificate** using an OTP from the ZATCA portal.

---

## 🎯 Purpose

Obtain the **Binary Security Token** and **Secret** required to sign invoices and call ZATCA APIs.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/issue-csid`

### Raw Body (JSON)

```json
{
  "commonName": "RADISSONGROUP",
  "otp": "123345",
  "production": false
}
```

---

## ✅ Results

Files saved in `onboarding_data/radissongroup/`:

- `ccsid-certificate.pem`
- `ccsid-secret.txt`
