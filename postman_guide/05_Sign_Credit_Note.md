# 05: Sign Credit Note (Refund)

Generate a signed XML for a refund. Requires `billingReferenceId` to the original invoice.

---

## 🚀 API Endpoint

**Method:** `POST`  
**URL:** `{{base_url}}/invoice/sign`

### Raw Body (JSON)

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceTypeCode": "381",
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
      "description": "Refund for Room Service",
      "quantity": 1,
      "unitPrice": 200.0,
      "taxExclusiveAmount": 200.0,
      "vatPercent": 15,
      "vatAmount": 30.0
    }
  ],
  "totals": {
    "lineExtensionTotal": 200.0,
    "taxExclusiveTotal": 200.0,
    "vatTotal": 30.0,
    "taxInclusiveTotal": 230.0,
    "payableAmount": 230.0
  }
}
```

---

> [!TIP]
> **Automation**: For Credit Notes, the system uses the **`RE`** prefix (e.g., `RAD-RE-25-00000001`).
