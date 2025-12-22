# 04: Sign B2B Standard Invoice

Generate a signed XML for a corporate booking (Standard Tax Invoice). Requires customer VAT and address.

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
    "invoiceTypeCodeName": "0111010"
  },
  "supplier": {
    "registrationName": "Radisson Blu Hotel",
    "vatNumber": "301245987500003",
    "address": { "city": "Riyadh", "country": "SA" }
  },
  "customer": {
    "type": "B2B",
    "registrationName": "Corporate Client LTD",
    "vatNumber": "399999999800003",
    "address": {
      "street": "King Fahad Rd",
      "buildingNumber": "1111",
      "district": "Olaya",
      "city": "Riyadh",
      "postalCode": "12222",
      "country": "SA"
    }
  },
  "lineItems": [
    {
      "lineId": "1",
      "description": "Meeting Room Rental",
      "quantity": 1,
      "unitPrice": 5000.0,
      "taxExclusiveAmount": 5000.0,
      "vatPercent": 15,
      "vatAmount": 750.0
    }
  ],
  "totals": {
    "lineExtensionTotal": 5000.0,
    "taxExclusiveTotal": 5000.0,
    "vatTotal": 750.0,
    "taxInclusiveTotal": 5750.0,
    "payableAmount": 5750.0
  }
}
```

---

> [!TIP]
> **Automation**: For Standard invoices, the system uses the **`SD`** prefix (e.g., `RAD-SD-25-00000001`).
