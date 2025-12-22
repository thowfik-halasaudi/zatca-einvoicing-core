# 06: Sign Debit Note (Adjustment)

Generate a signed XML for an additional charge. Requires `billingReferenceId`.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/invoice/sign`

### Raw Body (JSON)

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceTypeCode": "383",
    "invoiceTypeCodeName": "0211010",
    "billingReferenceId": "RAD-SI-25-00000001"
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
      "description": "Additional Cleaning Fee",
      "quantity": 1,
      "unitPrice": 50.0,
      "taxExclusiveAmount": 50.0,
      "vatPercent": 15,
      "vatAmount": 7.5
    }
  ],
  "totals": {
    "lineExtensionTotal": 50.0,
    "taxExclusiveTotal": 50.0,
    "vatTotal": 7.5,
    "taxInclusiveTotal": 57.5,
    "payableAmount": 57.5
  }
}
```

---

> [!TIP]
> **Automation**: For Debit Notes, the system uses the **`AD`** prefix (e.g., `RAD-AD-25-00000001`).
