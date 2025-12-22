# 07: Sign Tax Exempt Invoice

Generate a signed XML for an exempt or zero-rated transaction.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/invoice/sign`

### Raw Body (JSON)

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceTypeCode": "388",
    "invoiceTypeCodeName": "0211010"
  },
  "supplier": {
    "registrationName": "Radisson Blu Hotel",
    "vatNumber": "301245987500003",
    "address": { "city": "Riyadh", "country": "SA" }
  },
  "customer": { "type": "B2C", "name": "Walk-in Guest" },
  "lineItems": [
    {
      "lineId": "1",
      "description": "Medical Service (Exempt)",
      "quantity": 1,
      "unitPrice": 500.0,
      "taxExclusiveAmount": 500.0,
      "vatPercent": 0,
      "vatAmount": 0.0,
      "taxCategory": "E"
    }
  ],
  "totals": {
    "lineExtensionTotal": 500.0,
    "taxExclusiveTotal": 500.0,
    "vatTotal": 0.0,
    "taxInclusiveTotal": 500.0,
    "payableAmount": 500.0
  }
}
```

---

> [!TIP]
> **Automation**: Even for Exempt invoices, the system handles the sequence automatically using the **`SI`** prefix.
