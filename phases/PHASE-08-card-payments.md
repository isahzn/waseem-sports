# PHASE 08 — BANK TRANSFER AUTOMATION

Build a complete **bank-transfer automation prototype** as Phase 8.

## OBJECTIVE

Create a secure transfer workflow where a user can enter:

* Sender/payment method details using **sandbox/test credentials only**
* Recipient name
* Recipient bank
* Recipient account number
* Transfer amount
* Currency
* Optional transfer reference

The system should validate everything, calculate the final transfer amount, show a complete confirmation screen, require **explicit user approval**, execute the transfer through a **mock/sandbox banking provider**, verify the result, and record the transaction.

Do NOT connect to a real bank account.
Do NOT collect real banking passwords, PINs, OTPs, CVVs, or card numbers.
Do NOT bypass bank authentication or security controls.
Do NOT make autonomous real-money transfers.

The architecture must be designed so a legitimate bank/payment API can be connected later.

---

# 1. ARCHITECTURE

Build the system around these layers:

```text
Frontend
    ↓
Transfer API
    ↓
Validation
    ↓
Risk / security checks
    ↓
Approval
    ↓
Payment Provider Abstraction
    ↓
Mock/Sandbox Provider
    ↓
Transaction Verification
    ↓
Database + Audit Log
    ↓
Notifications
```

Use a provider interface such as:

```ts
interface PaymentProvider {
  createTransfer(input: TransferInput): Promise<TransferResult>
  getTransferStatus(id: string): Promise<TransferStatus>
  cancelTransfer?(id: string): Promise<void>
}
```

Then implement:

```text
MockBankProvider
```

The rest of the application must not depend directly on the mock provider.

---

# 2. TRANSFER FORM

Create a professional transfer interface.

Fields:

### Sender

* Test/sandbox payment method
* Provider
* Sandbox account identifier

Never display or store sensitive credentials after authentication.

### Recipient

* Full name
* Bank
* Account number
* Optional branch
* Optional phone/email

### Transfer

* Amount
* Currency
* Reference
* Optional description

Validate:

* amount > 0
* maximum transfer amount
* valid currency
* valid account format
* required recipient information
* duplicate transfer attempts

---

# 3. CONFIRMATION STEP

NEVER execute immediately after the form is submitted.

Show a confirmation screen:

```text
Transfer amount
Recipient
Bank
Account
Reference
Fees
Total
```

Then require an explicit action:

```text
CONFIRM TRANSFER
```

The transfer must not execute merely because an AI agent decided it should.

---

# 4. IDEMPOTENCY

This is critical.

Every transfer request must receive an idempotency key.

If the user clicks:

```text
Confirm Transfer
Confirm Transfer
Confirm Transfer
```

three times, the system must not create three transfers.

Example:

```text
idempotency_key
    ↓
check existing transaction
    ↓
already processed?
    ├── YES → return existing transaction
    └── NO  → create transaction
```

Add database constraints where appropriate.

---

# 5. TRANSACTION STATES

Implement a proper state machine:

```text
DRAFT
↓
PENDING_APPROVAL
↓
APPROVED
↓
PROCESSING
↓
COMPLETED
```

And failure states:

```text
FAILED
CANCELLED
EXPIRED
```

Never simply assume that an API response means the money moved successfully.

---

# 6. VERIFICATION

After submitting the transfer:

1. Store the provider transaction ID.
2. Query the provider for status.
3. Verify the final state.
4. Update our database.
5. Show the result to the user.

Example:

```text
Transfer submitted
      ↓
Provider transaction ID
      ↓
Check status
      ↓
COMPLETED
      ↓
Save result
      ↓
Notify user
```

---

# 7. MOCK BANK

Build a realistic mock banking provider.

It should simulate:

### Successful transfer

```text
SUCCESS
```

### Failed transfer

```text
INSUFFICIENT_FUNDS
INVALID_ACCOUNT
BANK_UNAVAILABLE
TRANSFER_LIMIT
```

### Delayed transfer

```text
PROCESSING
```

The mock provider should allow testing all of these states.

Create a small sandbox balance, for example:

```text
Available balance: LKR 500,000
```

The balance should decrease only when the mock transfer successfully completes.

---

# 8. SECURITY

Implement:

* server-side validation
* authentication
* authorization
* rate limiting
* CSRF protection where applicable
* encrypted secrets
* environment variables
* audit logging
* input sanitization
* no sensitive data in logs
* no card CVV/PIN storage
* no bank passwords stored
* no OTP interception
* no credential scraping
* no browser automation against real banking websites

Use fake credentials for development.

Example:

```env
PAYMENT_PROVIDER=mock
MOCK_BANK_ENABLED=true
```

Never put real credentials in source code.

---

# 9. DATABASE

Create appropriate tables/models for:

### transfers

```text
id
user_id
recipient_name
bank
account_reference
amount
currency
fee
total
reference
status
provider
provider_transaction_id
idempotency_key
created_at
updated_at
completed_at
```

### audit_logs

```text
id
user_id
action
transfer_id
timestamp
metadata
```

Do not store raw payment credentials.

---

# 10. ADMIN / TRANSACTION HISTORY

Create a transaction history page.

Display:

```text
Date
Recipient
Amount
Currency
Status
Provider transaction ID
Reference
```

Allow the user to open a transaction and see its timeline:

```text
14:20  Transfer created
14:20  Approval received
14:21  Submitted to provider
14:21  Processing
14:21  Completed
```

---

# 11. AI AUTOMATION

If an AI agent is included, it may help with:

* interpreting natural-language transfer requests
* extracting recipient information
* detecting missing information
* explaining errors
* preparing a transfer

Example:

> “Send LKR 25,000 to Ahmed's account for the website deposit.”

The AI can convert this into a proposed transfer.

But the AI must NEVER independently execute the transfer.

Required flow:

```text
User request
↓
AI parses request
↓
System validates
↓
User sees exact transfer
↓
User explicitly confirms
↓
Transfer executes
```

The AI must not be able to bypass the confirmation step.

---

# 12. API DESIGN

Create clean endpoints such as:

```text
POST /api/transfers/validate
POST /api/transfers
GET  /api/transfers/:id
GET  /api/transfers/:id/status
GET  /api/transfers
```

`POST /api/transfers` must require explicit confirmation and an idempotency key.

Do not expose provider secrets to the browser.

---

# 13. ERROR HANDLING

Handle:

* network timeout
* provider unavailable
* duplicate request
* invalid recipient
* insufficient balance
* transfer limit
* database failure
* provider processing state
* unknown provider response

Never tell the user that money was transferred unless the provider state confirms it.

---

# 14. UI

Make the interface feel like a real financial product:

* clean
* minimal
* responsive
* professional
* obvious transfer status
* strong confirmation step
* no unnecessary animations

Important actions should be visually obvious.

Include:

1. New Transfer
2. Confirmation
3. Processing
4. Success
5. Failed
6. Transaction History
7. Transaction Details

---

# 15. TESTING

Create automated tests for:

* successful transfer
* failed transfer
* duplicate request
* double-click confirmation
* insufficient balance
* invalid account
* provider timeout
* provider unavailable
* processing → completed
* processing → failed
* unauthorized user
* invalid amount
* invalid currency
* idempotency

Especially test that **one confirmed request can never accidentally create two transfers**.

---

# 16. REAL PROVIDER PREPARATION

Do not integrate a real bank yet.

Instead, make the provider layer replaceable:

```text
PaymentProvider
      │
      ├── MockBankProvider
      │
      └── FutureRealBankProvider
```

When a legitimate bank/payment provider API is available, only the provider implementation should need substantial changes.

Do not design around scraping or automating a bank's website.

---

# 17. DELIVERABLE

When finished, provide:

1. Complete working transfer prototype
2. Mock bank provider
3. Database schema
4. API routes
5. Frontend
6. Authentication
7. Transaction history
8. Audit logs
9. Idempotency protection
10. Automated tests
11. `.env.example`
12. Setup instructions
13. Explanation of exactly where a legitimate payment/bank API would be connected

Before finishing, run the complete test suite and manually test:

```text
Create transfer
→ Confirm
→ Process
→ Verify
→ Complete
→ View transaction
```

Also test the same confirmation button being clicked multiple times and prove that only one transaction is created.

Do not use real money or real banking credentials during this phase.

---

## Execution record — 2026-10-08 (built, then PROVEN LIVE against prod DB)

Migrations `0004`/`0005` pushed to the live project with the owner's DB password (`supabase migration list` showed remote at 0001–0003; push applied exactly the two new files, exit 0). Live proof `.tmp/liveproof/run.mjs` against `NODE_ENV=production node server.js` + real database: **25/25** — anon refused (401), create → 201 `pending_approval` with server-computed fee/total (1500+50=1550), duplicate create returns the same row with exactly 1 row per idempotency key, **triple CONFIRM executes once** (same id, one `completed` timeline event, provider tx assigned), invalid account → `failed` with `INVALID_ACCOUNT` (money never moved), HOLD → `processing` → verify → `completed`, history/detail/timeline all list the rows, wrong-key confirm → 409, disabled image-search spends no quota, live import (row + provenance + storage bytes + rights-gate 400) — then full cleanup, DB asserts 0 transfers / 0 quota / 0 cache afterwards.

**Real bug the proof caught and fixed:** when the provider returned PROCESSING, confirm tried a `processing→processing` “transition” to save the provider tx id — correctly rejected by the state machine, so the id was silently dropped and the transfer could never verify. Fix (`service.ts`): status moves `approved→processing` *before* the provider call (replay-safe), and the tx id is recorded via a `touch()` column-update that never goes through the state machine; provider-declined `last_error` now carries `CODE: message`. Rebuilt, re-proven 25/25, gates re-run (typecheck 0 · lint 0 errors · build 0).

## Superseded plan (pre-2026-10-08 card-payments spec — kept for history)

The original Phase 08 required D3 (Sri Lanka card provider) + verified provider
docs before starting, and forbade inventing an API. On 2026-10-08 the owner
replaced it with the mock bank-transfer prototype above: sandbox only, no real
provider, `MockBankProvider` behind the `PaymentProvider` seam. D3 stays open
for a future real provider; nothing in this prototype connects to one.
