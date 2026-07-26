# Code Issues Report - Shop Dashboard

Generated: 2026-04-12

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Hardcoded Credentials in Client-Side Code
**File:** `public/app.js` (lines 23-27)  
**Severity:** CRITICAL

```javascript
window.login = () => {
  signInWithEmailAndPassword(auth, "admin@shop.com", "admin@123")
    .then(() => location.href = "inventory.html")
    .catch(err => alert(err.message));
};
```

**Problem:**
- Email and password are exposed in plain text in client-side code
- Anyone can view page source and obtain admin credentials
- No real authentication barrier exists

**Impact:** Any user can gain admin access to the system

**Fix:** 
- Implement proper Firebase Authentication with user signup/login
- Store only admin UID in config, not credentials
- Use Firebase security rules to restrict admin operations

---

### 2. Hardcoded Admin PIN
**File:** `public/app.js` (lines 632, 752)  
**Severity:** CRITICAL

```javascript
if (pin !== "25464091") {
  alert("Invalid PIN. Return cancelled.");
  return;
}
```

**Problem:**
- Admin PIN for returns and product deletions is visible in source code
- Trivial to bypass by reading source or modifying JS in browser console

**Impact:** Any user can perform admin-only operations (returns, deletions)

**Fix:**
- Move sensitive operations to Firebase Cloud Functions
- Verify admin status server-side using Firebase Auth tokens
- Remove PIN checks from client code entirely

---

### 3. Firestore Rules Too Permissive (Currently Disabled)
**File:** `firestore.rules` (line 6)  
**Severity:** HIGH

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // ← Blocks ALL access
    }
  }
}
```

**Problem:**
- Rules currently block all read/write operations
- This is likely a placeholder but needs proper implementation
- No authentication-based access control defined

**Fix:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inventory/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /customers/{document=**} {
      allow read, write: if request.auth != null;
      match /ledger/{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

---

### 4. No Input Validation/Sanitization
**File:** `public/app.js` (multiple locations)  
**Severity:** HIGH

**Problem:**
- User input (product names, customer names) goes directly to database
- No sanitization or validation before storage
- Potential XSS vulnerability if data is rendered without escaping
- No length limits or format validation

**Examples:**
```javascript
// No validation before adding to database
await addDoc(collection(db, "inventory"), {
  name: pname.value,  // ← Raw user input
  price: Number(pprice.value),
  stock: Number(pstock.value)
});
```

**Fix:**
- Add client-side validation (length limits, allowed characters)
- Escape all data when rendering to DOM
- Add Firestore security rules with validation patterns
- Consider using a validation library

---

## 🟠 HIGH PRIORITY ISSUES

### 5. Memory Leak - Unsubscribed Listeners
**File:** `public/app.js` (lines 418-421)  
**Severity:** HIGH

```javascript
if (ledgerUnsubscribe) {
  ledgerUnsubscribe();
}
```

**Problem:**
- Only `ledgerUnsubscribe` is tracked and cleaned up
- Multiple `onSnapshot` listeners created for:
  - Inventory collection (line 85)
  - Customers collection (line 32)
  - Billing/ledger collections (line 229)
  - Nested ledger listeners inside forEach (line 236)
- None of these are cleaned up when navigating between pages

**Impact:**
- Duplicate event handlers accumulate over time
- Memory leaks in long-running sessions
- Performance degradation
- Potential for data inconsistencies

**Fix:**
- Track all unsubscribe functions
- Create a cleanup function called on page navigation
- Consider using a state management pattern

---

### 6. Race Condition in Stock Updates (TOCTOU Bug)
**File:** `public/app.js` (lines 199-201)  
**Severity:** HIGH

```javascript
await updateDoc(doc(db, "inventory", id), {
  stock: stock - qty  // ← Uses stale stock value
});
```

**Problem:**
- Reads stock value at time of page load
- Updates using that potentially stale value
- Two simultaneous sales can both read same stock and oversell
- Classic Time-Of-Check-To-Time-Of-Use (TOCTOU) vulnerability

**Scenario:**
1. Product has stock = 5
2. User A reads stock (5), User B reads stock (5)
3. User A sells 3 → stock becomes 2
4. User B sells 3 → stock becomes -2 (NEGATIVE STOCK!)

**Fix:** Use Firestore transactions
```javascript
await runTransaction(db, async (transaction) => {
  const docRef = doc(db, "inventory", id);
  const docSnap = await transaction.get(docRef);
  const newStock = docSnap.data().stock - qty;
  if (newStock < 0) throw new Error("Out of stock");
  transaction.update(docRef, { stock: newStock });
});
```

---

### 7. Nested Real-time Listeners - Performance Anti-pattern
**File:** `public/app.js` (lines 229-322)  
**Severity:** HIGH

```javascript
onSnapshot(collection(db, "customers"), snap => {
  snap.forEach(cDoc => {
    // ← Creates a NEW listener for EACH customer
    onSnapshot(collection(db, "customers", cDoc.id, "ledger"), ...
  });
});
```

**Problem:**
- Creates one listener per customer document
- With 100 customers = 100+ simultaneous real-time listeners
- Each listener maintains a separate WebSocket connection
- Firestore has listener limits (500 per connection)
- Will not scale; causes connection exhaustion

**Fix:**
- Restructure data to use collection group queries
- Fetch ledger data on-demand instead of real-time for all
- Use a single query that combines needed data
- Implement pagination for large customer lists

---

### 8. No Error Handling on Async Operations
**File:** `public/app.js` (multiple locations)  
**Severity:** MEDIUM-HIGH

**Problem:**
- Most async functions have no try/catch blocks
- Network failures will cause unhandled promise rejections
- User gets no feedback on failure
- Functions affected:
  - `addProduct()` (line 66)
  - `sellProduct()` (line 178)
  - `addCustomer()` (line 694)
  - `deleteProduct()` (line 748)
  - `deleteCustomer()` (line 742)
  - `processReturn()` (line 629)

**Fix:**
```javascript
window.addProduct = async () => {
  try {
    await addDoc(collection(db, "inventory"), { ... });
    alert("Product added successfully");
  } catch (err) {
    console.error("Add product failed:", err);
    alert("Failed to add product: " + err.message);
  }
};
```

---

## 🟡 CODE QUALITY ISSUES

### 9. Global Function Pollution
**File:** `public/app.js` (throughout)  
**Severity:** MEDIUM

**Problem:**
- All functions attached to `window` object:
  - `window.login`, `window.addProduct`, `window.sellProduct`
  - `window.addCustomer`, `window.deleteCustomer`
  - `window.showCustomerLedger`, `window.processReturn`
  - `window.generatePDF`, `window.addPayment`
- No modular structure or namespace isolation
- Hard to test, debug, or maintain
- Risk of naming collisions

**Fix:**
- Use ES6 modules with exports
- Create a module pattern or use a framework
- Keep only necessary functions in global scope

---

### 10. Inconsistent State Management
**File:** `public/app.js` (lines 30-37, 81)  
**Severity:** MEDIUM

```javascript
window._customersCache = [];
let inventoryCache = [];
```

**Problem:**
- Global caches for customers and inventory
- Multiple components read/write same state
- No single source of truth
- Cache can become stale
- No invalidation strategy

**Fix:**
- Use a proper state management solution
- Rely on Firestore real-time updates as single source
- Implement proper cache invalidation

---

### 11. Dead Code
**File:** `public/app.js` (lines 152-177, 773-881)  
**Severity:** LOW

**Problem:**
- Large blocks of commented-out code remain in file:
  - Old `sellProduct` implementation (lines 152-177)
  - Multiple versions of `generatePDF` (lines 773-881)
  - Old `processReturn` implementations
- Makes file harder to read and maintain
- Confusing for future developers

**Fix:**
- Remove commented-out code
- Use version control (git) for historical versions
- Document why alternative approaches were rejected

---

### 12. Magic Numbers/Strings
**File:** `public/app.js` (multiple locations)  
**Severity:** LOW

```javascript
if (total > 500)  // ← Why 500?
  ? 'style="background-color:#ffe5e5;color:#b30000;font-weight:bold;"'
  
if (pin !== "25464091")  // ← Why this PIN?

if (qtyToReturn < 1 || qtyToReturn > maxQty)  // ← Why 1?
```

**Problem:**
- Unexplained constants throughout code
- Hard to understand intent
- Difficult to change values later

**Fix:**
```javascript
const OUTSTANDING_HIGHLIGHT_THRESHOLD = 500;
const ADMIN_PIN = "25464091";  // Move to secure config
const MIN_QTY = 1;
```

---

### 13. No Loading States
**File:** `public/app.js` (multiple locations)  
**Severity:** LOW

**Problem:**
- No visual feedback during async operations
- Buttons remain clickable during operations
- User can click "Add Product" multiple times → creates duplicates
- No spinner or disabled state

**Fix:**
```javascript
window.addProduct = async () => {
  const btn = document.querySelector('button[onclick="addProduct()"]');
  btn.disabled = true;
  btn.textContent = "Adding...";
  
  try {
    await addDoc(...);
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Product";
  }
};
```

---

### 14. Poor Mobile UX for Tables
**File:** `public/inventory.html` (line 102), `public/billing.html`  
**Severity:** LOW

```css
table {
  width: 100%;
  min-width: 950px;  /* ← Forces horizontal scroll */
}
```

**Problem:**
- Tables have fixed minimum width of 950px
- Will always horizontal scroll on mobile devices
- No alternative card-based view for small screens
- Poor user experience on phones

**Fix:**
- Add responsive card view for mobile
- Use CSS grid/flexbox for mobile layouts
- Hide less important columns on small screens
- Consider sticky first column for row context

---

## 📋 SUMMARY BY SEVERITY

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 2 | Hardcoded credentials, Hardcoded PIN |
| HIGH | 5 | Firestore rules, No validation, Memory leaks, Race conditions, Nested listeners |
| MEDIUM | 3 | No error handling, Global pollution, State management |
| LOW | 4 | Dead code, Magic numbers, No loading states, Mobile UX |

---

## 🎯 RECOMMENDED FIX PRIORITY

1. **Immediate (Security):** Fix hardcoded credentials and PIN
2. **High Priority:** Implement proper Firestore security rules
3. **High Priority:** Fix race condition with transactions
4. **High Priority:** Clean up event listener management
5. **Medium Priority:** Add error handling to all async operations
6. **Medium Priority:** Refactor to ES6 modules
7. **Low Priority:** Remove dead code, add loading states

---

## 🔧 TECHNICAL DEBT ESTIMATE

- **Security fixes:** 4-6 hours
- **Architecture refactoring:** 8-12 hours  
- **Bug fixes:** 4-6 hours
- **UX improvements:** 4-6 hours

**Total estimated effort:** 20-30 hours

---

## 📚 REFERENCES

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Auth Best Practices](https://firebase.google.com/docs/auth/web/manage-users)
