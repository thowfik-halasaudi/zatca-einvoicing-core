# Postman Collection: All ZATCA Scenarios

This guide provides pre-calculated JSON payloads for all major ZATCA Phase 2 scenarios. Use these payloads with the **`POST /invoice/sign`** endpoint.

---

## 1. Simplified Tax Invoice (Standard B2C)

**Type:** 388 | **Code:** 0211010  
Standard 15% VAT for a walk-in guest.

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceSerialNumber": "INV-S-001",
    "invoiceCounterNumber": 1,
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

## 2. Standard Tax Invoice (B2B)

**Type:** 388 | **Code:** 0111010  
Required for business customers. Includes mandatory Customer VAT and Address.

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceSerialNumber": "INV-B-001",
    "invoiceCounterNumber": 2,
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

## 3. Simplified Credit Note (Refund)

**Type:** 381 | **Code:** 0211010  
Used for refunding a previously issued invoice. Requires `billingReferenceId`.

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceSerialNumber": "CR-001",
    "invoiceCounterNumber": 3,
    "invoiceTypeCode": "381",
    "invoiceTypeCodeName": "0211010",
    "billingReferenceId": "INV-S-001"
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

## 4. Simplified Debit Note (Adjustment)

**Type:** 383 | **Code:** 0211010  
Used for increasing the amount of a previously issued invoice.

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceSerialNumber": "DB-001",
    "invoiceCounterNumber": 4,
    "invoiceTypeCode": "383",
    "invoiceTypeCodeName": "0211010",
    "billingReferenceId": "INV-S-001"
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

## 5. Tax Exempt / Zero Rated (SIMPLIFIED)

**Type:** 388 | **Code:** 0211010  
Use `vatPercent: 0` and update `taxCategory` (e.g., `E` for Exempt, `Z` for Zero-Rated).

```json
{
  "egs": { "commonName": "RADISSONGROUP", "vatNumber": "301245987500003" },
  "invoice": {
    "invoiceSerialNumber": "INV-EX-001",
    "invoiceCounterNumber": 5,
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
