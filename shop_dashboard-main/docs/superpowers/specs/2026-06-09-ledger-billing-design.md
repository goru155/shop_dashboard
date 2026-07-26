# Ledger Billing Design — Settlement-Based Current Bill

**Date:** 2026-06-09  
**Status:** Approved  
**Scope:** Section 1 (settlement logic) + Section 2 (integration)

---

## Problem

Invoice PDF uses the **most recent transaction date** to split "current" vs "previous" charges. This produces incorrect bills when billing activity spans multiple days. The billing table and PDF also duplicate balance logic inline.

## Goal

Calculate the customer's **current bill** as all activity **since the last time their running balance hit ₹0**, then:

```
Net Outstanding = Pending (₹0 at period start) + Current Purchases − Advance Payments
```

Advance overpayment (balance &lt; 0) does **not** count as settlement.

---

## Section 1 — Settlement & Bill Formula

### Algorithm: `computeBillBreakdown(entries)`

1. Filter to **active** entries (`status !== "closed"`).
2. Sort chronologically by `date.seconds`.
3. Walk entries, maintaining `runningBalance`:
   - `credit` → add `amount`
   - `advance` → subtract `amount`
4. Record **last index** where `runningBalance === 0` (settlement checkpoint).
5. **Current period** = all entries after that index (or entire ledger if never settled).
6. Compute:
   - `pendingBalance` = 0 (balance at last settlement)
   - `currentCharges` = sum of `credit` amounts in current period
   - `advanceApplied` = sum of `advance` amounts in current period
   - `netOutstanding` = `currentCharges - advanceApplied`
   - `currentCreditItems` = credit entries in current period (for PDF line items)

### Edge Cases

| Case | Behavior |
|------|----------|
| Never hit ₹0 | Entire active ledger = one open period |
| Advance overpays (balance &lt; 0) | Not a settlement; excess shows as advance balance |
| Full return (`status: "closed"`) | Excluded from calculation |
| Partial return | Reduced `amount` on active entry counts |

### Example

| Date | Entry | Running Balance |
|------|-------|-----------------|
| 1 Jun | Credit ₹1000 | 1000 |
| 5 Jun | Advance ₹1000 | **0 ← settlement** |
| 8 Jun | Credit ₹500 | 500 |
| 9 Jun | Advance ₹200 | 300 |

**Bill:** Pending ₹0 + Current ₹500 − Advance ₹200 = **Net ₹300**

---

## Section 2 — Integration Points

### `generatePDF()` (billing.html modal)

- Replace date-string split with `computeBillBreakdown(currentLedgerData)`.
- Render line items from `currentCreditItems` only.
- Totals section: Pending / Current Bill / Advance / Net Outstanding.

### Billing table (`app.js` ~L229–322)

- Replace inline `credit − advance` loop with `computeBillBreakdown`.
- `netOutstanding` drives Outstanding vs Paid tab placement (unchanged thresholds).

### Ledger modal (`showCustomerLedger`)

- Add summary row above table: Pending | Current | Advance | Net.

### Unchanged

- `generateFullLedgerPDF()` — full history export.
- Firestore schema — no new fields (Approach 1).

### Deferred (D backlog)

- Nested listener refactor
- Firestore transactions for stock/returns
- try/catch on async ops (add in implementation pass)

---

## Data Flow

```
Firestore ledger entries
        ↓
computeBillBreakdown()
        ↓
   ┌────┴────┬────────────┐
   ↓         ↓            ↓
Billing   PDF Invoice   Modal summary
 table
```

---

## Test Scenarios

| # | Scenario | Expected Net |
|---|----------|--------------|
| 1 | Credit ₹500, no payment | ₹500 |
| 2 | Credit ₹500, Advance ₹500 | ₹0 (settled) |
| 3 | After #2: Credit ₹300 | ₹300 |
| 4 | After #3: Advance ₹100 | ₹200 |
| 5 | Credit ₹500, Advance ₹700 | −₹200 advance balance |
| 6 | Partial return reduces credit | Lower current charges |

---

## Files Changed

- `shop-dash/public/app.js` — add `computeBillBreakdown`, update billing table, PDF, modal
