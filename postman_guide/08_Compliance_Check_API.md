# 08: Compliance Check API

Send your **Signed XML** to ZATCA for validation. This is the final verification step before production.

---

## 🎯 Purpose

Let ZATCA's API validate your XML structure, signature, and QR code to ensure you are 100% compliant.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/compliance/check`

### Raw Body (JSON)

```json
{
  "commonName": "RADISSONGROUP",
  "invoiceSerialNumber": "RAD-SI-25-00000001"
}
```

---

## 🔄 How it Works

1.  **Retrieval**: The server finds the signed XML for the serial number provided.
2.  **Extraction**: It automatically extracts the Hash and UUID from the XML.
3.  **Validation**: It calls ZATCA with Basic Auth (Certificate + Secret).

---

## ✅ Results

- **PASS**: Your system is compliant!
- **REPORT**: A full JSON validation report is saved in your server's `tmp/` folder.
