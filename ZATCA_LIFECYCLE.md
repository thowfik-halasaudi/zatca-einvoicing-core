# ZATCA Phase 2: The 7-Step Lifecycle

This document defines the complete technical process for ZATCA Phase 2 integration. There are no other mandatory steps or hidden APIs.

---

## 🏗️ Phase 1: Onboarding (Done Once)

_Performed when a new EGS (Electronic Generating System) or Device is registered._

1.  **Generate Private Key & CSR (Local)**: Create your company's unique digital identity and a Certificate Signing Request (CSR).
2.  **Get Compliance CSID (API)**: Submit your CSR and an OTP (from Fatoora Portal) to ZATCA to receive a temporary **Compliance Certificate**.
3.  **Run Compliance Check (API)**: Submit at least one signed sample invoice to ZATCA to prove your XML structure and signing logic are correct.
4.  **Get Production CSID (API)**: Exchange your validated compliance certificate for a permanent **Production Certificate** (CSID).

---

## 💸 Phase 2: Transactions (Done for Every Invoice)

_Performed daily for every sale or refund created in your system._

1.  **Generate Base XML (Local)**: Convert your internal sales data (from PMS/ERP) into a raw UBL 2.1 XML document.
2.  **Sign Invoice XML (Local)**: Use the **Fatoora CLI** to digitally sign the XML, calculate the invoice hash, and generate the mandatory QR code.
3.  **Report / Clearance (API)**: Submit the final signed XML to ZATCA's production server for legal filing (Reporting for Simplified, Clearance for Standard).

---

## summary

- **Security**: Handled by Steps 1, 2, and 4.
- **Validation**: Handled by Steps 3 and 5.
- **Legal Compliance**: Handled by Step 7.
