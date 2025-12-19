# Step 3: Invoice Signing (Digital Signature & QR)

This guide explains how to generate a ZATCA-compliant signed XML invoice using the **`fatoora` CLI** integrated into our NestJS service.

---

## 🎯 Purpose

The goal of this step is to:

1.  **Generate a Base XML**: Create a valid UBL 2.1 document for your transaction.
2.  **Digitally Sign**: Apply the XAdES signature using your **`egs-signing-key.pem`**.
3.  **Embed Certificate**: Inject the **`ccsid-certificate.pem`** into the XML.
4.  **Generate QR Code**: Create the mandatory Phase 2 QR code (containing 9 tags).

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/invoice/sign`

### Headers

| Key            | Value              |
| :------------- | :----------------- |
| `Content-Type` | `application/json` |

### Raw Body (JSON)

Copy this Radisson-themed payload for testing:

```json
{
  "egs": {
    "commonName": "RADISSONGROUP",
    "organizationName": "Radisson Group",
    "organizationUnitName": "Radisson Blu Hotel Riyadh",
    "vatNumber": "301245987500003",
    "crNumber": "1010010000",
    "countryCode": "SA",
    "invoiceType": "SIMPLIFIED",
    "production": false
  },

  "invoice": {
    "invoiceSerialNumber": "INV-2025-001",
    "uuid": "8d487816-70b8-4ade-a618-9d620b73814a",
    "issueDate": "2025-12-19",
    "issueTime": "15:20:00",
    "currency": "SAR",
    "invoiceCounterNumber": 1,
    "previousInvoiceHash": "NWZlY2ViOTZmOTk1YTRiMGNjM2YwOTUwZGYzMmM2YjQ5ZGEyN2IyOA==",
    "paymentMeansCode": "10",
    "deliveryDate": "2025-12-19"
  },

  "supplier": {
    "registrationName": "Radisson Blu Hotel Riyadh",
    "vatNumber": "301245987500003",
    "address": {
      "street": "Al Rashid St",
      "buildingNumber": "2322",
      "district": "Al-Murabba",
      "city": "Riyadh",
      "postalCode": "12211",
      "country": "SA"
    }
  },

  "customer": {
    "type": "B2C",
    "name": "Walk-in Guest",
    "vatNumber": null,
    "address": {
      "city": "Riyadh",
      "country": "SA"
    }
  },

  "lineItems": [
    {
      "lineId": "1",
      "type": "ROOM",
      "description": "Deluxe Room",
      "quantity": 1,
      "unitCode": "PCE",
      "unitPrice": 800.0,
      "taxExclusiveAmount": 800.0,
      "vatPercent": 15,
      "vatAmount": 120.0,
      "taxCategory": "S"
    },
    {
      "lineId": "2",
      "type": "SERVICE",
      "description": "Breakfast Buffet",
      "quantity": 2,
      "unitCode": "PCE",
      "unitPrice": 75.0,
      "taxExclusiveAmount": 150.0,
      "vatPercent": 15,
      "vatAmount": 22.5,
      "taxCategory": "S"
    },
    {
      "lineId": "3",
      "type": "SERVICE",
      "description": "Extra Bed",
      "quantity": 1,
      "unitCode": "PCE",
      "unitPrice": 100.0,
      "taxExclusiveAmount": 100.0,
      "vatPercent": 15,
      "vatAmount": 15.0,
      "taxCategory": "S"
    }
  ],

  "totals": {
    "lineExtensionTotal": 1050.0,
    "taxExclusiveTotal": 1050.0,
    "vatTotal": 157.5,
    "taxInclusiveTotal": 1207.5,
    "payableAmount": 1207.5
  }
}
```

---

> [!TIP]
> **Check your Console!** I have added detailed logging to the server. When you send this request, you will see the full **Base XML** and the final **Signed XML** printed in your terminal for debugging.

---

## 🔄 How it Works

1.  **Local Tokens**: The server looks for your signing key and certificate in `onboarding_data/radissongroup/`.
2.  **Base Generation**: It builds a "pure" UBL XML with your line items and totals.
3.  **CLI Signing**: It executes:
    `fatoora -sign -invoice in.xml -key key.pem -cert cert.pem`
4.  **Transformation**: The CLI automatically:
    - Calculates the SHA-256 hash.
    - Generates the Digital Signature.
    - Generates the Phase 2 QR Code.
    - Injects everything into the `UBLExtensions` block.

---

## ✅ Results

- **Postman Response**: You receive the full **`signedXml`** as a string.
- **Server Storage**: The signed file is organized in **`tmp/{{commonName}}/`** for validation.

**Next Step**: Use this signed XML for the **Step 4: Compliance Check**!
