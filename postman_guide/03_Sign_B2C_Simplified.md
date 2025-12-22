# 03: Sign B2C Simplified Invoice

Generate a signed XML for a standard walk-in guest (Simplified Tax Invoice).

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
      "description": "Room Service",
      "quantity": 1,
      "unitPrice": 1000.0,
      "taxExclusiveAmount": 1000.0,
      "vatPercent": 15,
      "vatAmount": 150.0
    }
  ],
  "totals": {
    "lineExtensionTotal": 1000.0,
    "taxExclusiveTotal": 1000.0,
    "vatTotal": 150.0,
    "taxInclusiveTotal": 1150.0,
    "payableAmount": 1150.0
  }
}
```

---

> [!TIP]
> **Automation**: The `invoiceSerialNumber` is automatically generated (e.g., `RAD-SI-25-00000001`).
