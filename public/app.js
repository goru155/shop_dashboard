import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, getDoc, getDocs, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* FIREBASE CONFIG */
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: "AIzaSyAawUopX1lromd5nFeMPoogEXFzLZ7ZnXM",
  authDomain: "shopportal-f6630.firebaseapp.com",
  projectId: "shopportal-f6630",
  storageBucket: "shopportal-f6630.firebasestorage.app",
  messagingSenderId: "843668522089",
  appId: "1:843668522089:web:cfdd7548303ced6df04ef8",
  measurementId: "G-3P0EWBDSLW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let ledgerUnsubscribe = null;

/* LOGIN */
window.login = () => {
  signInWithEmailAndPassword(auth, "admin@shop.com", "admin@123")
    .then(() => location.href = "inventory.html")
    .catch(err => alert(err.message));
};

/* LOGOUT */
window.logout = () => {
  signOut(auth)
    .then(() => {
      location.href = "login.html";
    })
    .catch((err) => {
      alert("Logout failed: " + err.message);
    });
};

/* CUSTOMER CACHE */
window._customersCache = [];

async function getCustomerProfileByEmail(email) {
  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) return null;

  try {
    const snapshot = await getDocs(collection(db, "customers"));
    const match = snapshot.docs.find(docSnap => {
      const data = docSnap.data() || {};
      const savedEmail = String(data.email || '').trim().toLowerCase();
      const savedContact = String(data.contact || '').trim().toLowerCase();
      return savedEmail === targetEmail || savedContact === targetEmail;
    });

    return match ? match.data() : null;
  } catch (error) {
    console.warn("Customer profile lookup failed:", error);
    return null;
  }
}

onSnapshot(collection(db, "customers"), snap => {
  window._customersCache = [];
  snap.forEach(d => {
    const data = d.data() || {};
    window._customersCache.push({ id: d.id, name: data.name || data.email || 'Customer' });
  });
});

/* SEARCH SUGGESTIONS */
window.showCustomerSuggestions = function (inputEl) {
  const term = inputEl.value.toLowerCase();
  const rowId = inputEl.dataset.row;
  const box = document.getElementById("suggest-" + rowId);

  if (!term) { box.innerHTML = ""; return; }

  const matches = window._customersCache
    .filter(c => c.name.toLowerCase().includes(term))
    .slice(0, 5);

  box.innerHTML = matches.map(c => `
    <div onclick="selectCustomer('${rowId}','${c.id}','${c.name}')"
          style="background:white;border:1px solid #ddd;padding:6px;cursor:pointer">
      ${c.name}
    </div>`).join("");
};

window.selectCustomer = function (rowId, custId, custName) {
  const input = document.querySelector(`.custSearch[data-row='${rowId}']`);
  input.value = custName;
  input.dataset.custId = custId;
  document.getElementById("suggest-" + rowId).innerHTML = "";
};

/* CATEGORY MANAGEMENT & REALTIME LISTENERS */
window.categoriesCache = ["General"];

onSnapshot(collection(db, "categories"), snap => {
  const cats = new Set(["General"]);
  snap.forEach(d => {
    if (d.data().name) cats.add(d.data().name);
  });
  window.categoriesCache = Array.from(cats);
  updateCategoryDropdowns();
  if (typeof applyInventoryView === "function") {
    applyInventoryView();
  }
});

window.addCategory = async () => {
  const catInput = document.getElementById("newCatName");
  const catName = catInput?.value.trim();
  if (!catName) return alert("Please enter a category name");
  try {
    await addDoc(collection(db, "categories"), {
      name: catName,
      createdAt: new Date()
    });
    catInput.value = "";
  } catch (err) {
    alert("Error adding category: " + err.message);
  }
};

function updateCategoryDropdowns() {
  const pcategorySelect = document.getElementById("pcategory");
  const categoryFilterSelect = document.getElementById("categoryFilter");

  if (pcategorySelect) {
    const currVal = pcategorySelect.value;
    pcategorySelect.innerHTML = window.categoriesCache.map(c => `<option value="${c}">${c}</option>`).join("");
    if (window.categoriesCache.includes(currVal)) pcategorySelect.value = currVal;
  }

  if (categoryFilterSelect) {
    const currVal = categoryFilterSelect.value;
    categoryFilterSelect.innerHTML = `<option value="all">All Categories</option>` +
      window.categoriesCache.map(c => `<option value="${c}">${c}</option>`).join("");
    if (currVal && [...categoryFilterSelect.options].some(o => o.value === currVal)) {
      categoryFilterSelect.value = currVal;
    }
  }
}

/* ADD PRODUCT */
window.addProduct = async () => {
  const pnameEl = document.getElementById("pname");
  const ppriceEl = document.getElementById("pprice");
  const pstockEl = document.getElementById("pstock");
  const pcatEl = document.getElementById("pcategory");

  const name = pnameEl?.value.trim();
  const pcat = pcatEl?.value || "General";
  const price = Number(ppriceEl?.value) || 0;
  const stock = Number(pstockEl?.value) || 0;

  if (!name) return alert("Please enter product name");
  try {
    await addDoc(collection(db, "inventory"), {
      name: name,
      category: pcat,
      price: price,
      stock: stock,
      isVisible: true,
      lowStockThreshold: 5,
      createdAt: new Date()
    });
    if (pnameEl) pnameEl.value = "";
    if (ppriceEl) ppriceEl.value = "";
    if (pstockEl) pstockEl.value = "";
  } catch (err) {
    alert("Error adding product: " + err.message);
  }
};

/* SEED SAMPLE CATALOG */
window.seedSampleCatalog = async () => {
  const defaultItems = [
    { name: "Organic Red Bell Pepper (Capsicum)", category: "vegetables", price: 24, stock: 18, isVisible: true, lowStockThreshold: 5 },
    { name: "Pure Green Tea with Citrus Lemon", category: "beverages", price: 18.5, stock: 25, isVisible: true, lowStockThreshold: 5 },
    { name: "South African Meyer Yellow Lemons", category: "fruits", price: 12, stock: 14, isVisible: true, lowStockThreshold: 5 },
    { name: "Hass Fresh Creamy Avocados", category: "fruits", price: 16, stock: 9, isVisible: true, lowStockThreshold: 5 },
    { name: "Farm Fresh Free-Range Brown Eggs", category: "eggs", price: 9.5, stock: 30, isVisible: true, lowStockThreshold: 5 },
    { name: "Artisanal Sourdough Country Loaf", category: "baking", price: 8.5, stock: 6, isVisible: true, lowStockThreshold: 5 },
    { name: "Wild Alaskan Salmon Fillet", category: "seafood", price: 34, stock: 8, isVisible: true, lowStockThreshold: 5 },
    { name: "Organic Whole Alpine Milk", category: "dairy", price: 6.2, stock: 22, isVisible: true, lowStockThreshold: 5 },
    { name: "Dutch Aged Gouda Cheese Wedge", category: "cheese", price: 19.8, stock: 12, isVisible: true, lowStockThreshold: 5 },
    { name: "Grass-Fed Angus Beef Ribeye", category: "meat", price: 42, stock: 5, isVisible: true, lowStockThreshold: 5 }
  ];

  try {
    for (const item of defaultItems) {
      await addDoc(collection(db, "inventory"), {
        ...item,
        createdAt: new Date()
      });
    }
    const sampleCats = ["vegetables", "beverages", "fruits", "eggs", "baking", "seafood", "dairy", "cheese", "meat"];
    for (const cat of sampleCats) {
      await addDoc(collection(db, "categories"), { name: cat, createdAt: new Date() });
    }
    alert("Sample catalog seeded successfully!");
  } catch (err) {
    alert("Error seeding catalog: " + err.message);
  }
};

/* TOGGLE PRODUCT VISIBILITY (SHOW / HIDE) */
window.toggleProductVisibility = async (id, currentIsVisible) => {
  try {
    const nextStatus = currentIsVisible === false ? true : false;
    await updateDoc(doc(db, "inventory", id), {
      isVisible: nextStatus
    });
  } catch (err) {
    alert("Error updating visibility: " + err.message);
  }
};

/* UPDATE PRODUCT CATEGORY INLINE */
window.updateProductCategory = async (id, newCategory) => {
  try {
    await updateDoc(doc(db, "inventory", id), {
      category: newCategory
    });
  } catch (err) {
    alert("Error updating product category: " + err.message);
  }
};

/* =========================
    INVENTORY REALTIME + SEARCH & FILTER
========================= */

const inventoryList = document.getElementById("inventoryList");
const productSearchInput = document.getElementById("productSearch");
const categoryFilterInput = document.getElementById("categoryFilter");

let inventoryCache = [];

function normalizeProduct(data) {
  return {
    ...data,
    category: data.category || "General",
    isVisible: data.isVisible !== false,
    lowStockThreshold: data.lowStockThreshold ?? 5
  };
}

function getInventoryProduct(id) {
  return inventoryCache.find(p => p.id === id);
}

function applyInventoryView() {
  if (!inventoryList) return;
  let products = [...inventoryCache];

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("filter") === "lowstock") {
    products = products.filter(p => p.stock <= (p.lowStockThreshold ?? 5));
  }

  const term = productSearchInput?.value.toLowerCase().trim() || "";
  if (term) {
    products = products.filter(p => p.name.toLowerCase().includes(term));
  }

  const selectedCat = categoryFilterInput?.value || "all";
  if (selectedCat !== "all") {
    products = products.filter(p => (p.category || "General") === selectedCat);
  }

  renderInventory(products);
}

window.restockProduct = async (id, currentStock) => {
  const amountStr = prompt("Enter amount to restock:");
  if (!amountStr) return;

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount");
    return;
  }

  await updateDoc(doc(db, "inventory", id), {
    stock: currentStock + amount
  });
};

/* DELETE PRODUCT */
window.deleteProduct = async (id) => {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    await deleteDoc(doc(db, "inventory", id));
  } catch (err) {
    alert("Error deleting product: " + err.message);
  }
};

/* CLEAR / DELETE COMPLETE INVENTORY */
window.clearAllInventory = async () => {
  const confirmDelete = confirm("⚠️ Are you sure you want to completely DELETE ALL products in your inventory?\n\nThis will remove all items from the database and cannot be undone.");
  if (!confirmDelete) return;

  try {
    const snap = await getDocs(collection(db, "inventory"));
    if (snap.empty) {
      alert("Inventory is already empty.");
      return;
    }

    const total = snap.size;
    const deletePromises = snap.docs.map(docSnap => deleteDoc(doc(db, "inventory", docSnap.id)));
    await Promise.all(deletePromises);

    alert(`Successfully deleted all ${total} products from the inventory.`);
  } catch (err) {
    alert("Error deleting complete inventory: " + err.message);
  }
};

function renderSellControls(p) {
  return `
    <td style="position:relative">
      <input type="text"
        class="custSearch"
        placeholder="Search..."
        data-row="${p.id}"
        oninput="showCustomerSuggestions(this)">
      <div id="suggest-${p.id}"></div>
    </td>

    <td>
      <div class="qtyStepper">
        <button onclick="stepQty('${p.id}',-1)">−</button>
        <input id="qty-${p.id}" value="1">
        <button onclick="stepQty('${p.id}',1)">+</button>
      </div>
    </td>

    <td>
      <div style="display: inline-flex; align-items: center; gap: 4px;">
        <select id="pay-${p.id}">
          <option value="cash">💵 Cash</option>
          <option value="credit">📝 Credit</option>
        </select>
        <button onclick="sellProduct('${p.id}', ${p.stock})">Sell</button>
      </div>
    </td>`;
}

function renderInventory(products) {
  if (!inventoryList) return;

  if (!products || products.length === 0) {
    inventoryList.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 30px 10px; color: #666; font-size: 13px; text-align: center;">
          📦 No products found in the database.
          <br>
          <button type="button" onclick="seedSampleCatalog()" style="margin-top: 10px; padding: 6px 14px; background: #6b3fa0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
            ✨ Populate Sample Products (10 Items)
          </button>
        </td>
      </tr>
    `;
    return;
  }

  let html = "";

  products.forEach(p => {
    const threshold = p.lowStockThreshold ?? 5;
    const isLowStock = Number(p.stock) <= threshold;
    const rowClass = isLowStock ? "low-stock-row" : "";
    const isVisible = p.isVisible !== false;

    const currentCat = p.category || "General";
    const availableCats = Array.from(new Set([...window.categoriesCache, currentCat]));
    const catOptionsHTML = availableCats.map(c =>
      `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`
    ).join("");

    html += `
      <tr class="${rowClass}" data-product-id="${p.id}" style="${!isVisible ? 'opacity: 0.65; background: #fafafa;' : ''}">
        <td><strong>${p.name}</strong>${isLowStock ? ` <span class="low-stock-badge">Low</span>` : ""}</td>
        <td>
          <select onchange="updateProductCategory('${p.id}', this.value)">
            ${catOptionsHTML}
          </select>
        </td>
        <td>₹${p.price}</td>
        <td class="${isLowStock ? "low-stock-cell" : ""}"><span class="stock-value">${p.stock}</span></td>
        <td>
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <label class="switch" title="${isVisible ? 'Product is Visible to customers' : 'Product is Hidden from customers'}">
              <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleProductVisibility('${p.id}', ${isVisible})">
              <span class="slider"></span>
            </label>
            <span style="font-size: 11px; font-weight: 600; color: ${isVisible ? '#28a745' : '#888'};">
              ${isVisible ? 'Visible' : 'Hidden'}
            </span>
          </div>
        </td>
        <td><button onclick="restockProduct('${p.id}', ${p.stock})" style="background: #28a745;">Restock</button></td>
        ${renderSellControls(p)}
        <td>
          <button onclick="deleteProduct('${p.id}')" style="background: #dc3545;">Remove</button>
        </td>
      </tr>`;
  });

  inventoryList.innerHTML = html;
}

if (inventoryList) {
  onSnapshot(collection(db, "inventory"), snap => {
    inventoryCache = [];
    snap.forEach(d => {
      inventoryCache.push({ id: d.id, ...normalizeProduct(d.data()) });
    });
    applyInventoryView();
  }, (err) => {
    console.error("Error loading inventory:", err);
    inventoryList.innerHTML = `<tr><td colspan="10" style="padding: 20px; color: red;">Error loading inventory: ${err.message}</td></tr>`;
  });

  productSearchInput?.addEventListener("input", applyInventoryView);
  categoryFilterInput?.addEventListener("change", applyInventoryView);
}

/* SELL PRODUCT */
// window.sellProduct = async (id, stock) => {

//   const qty = Number(document.getElementById("qty-" + id).value);
//   const custInput = document.querySelector(`.custSearch[data-row='${id}']`);
//   const customerId = custInput?.dataset.custId;

//   if (!customerId) return alert("Select customer");

//   const paymentType = document.getElementById("pay-" + id).checked ? "credit" : "cash";

//   const row = document.getElementById("qty-" + id).closest("tr");
//   const productName = row.children[0].innerText;
//   const price = Number(row.children[1].innerText);

//   await updateDoc(doc(db, "inventory", id), {
//     stock: stock - qty
//   });

//   await addDoc(collection(db, "customers", customerId, "ledger"), {
//     product: productName,
//     qty: qty,
//     amount: qty * price,
//     paymentType,
//     date: new Date()
//   });
// };
window.stepQty = (id, delta) => {
  const el = document.getElementById("qty-" + id);
  if (el) {
    const val = Math.max(1, (parseInt(el.value) || 1) + delta);
    el.value = val;
  }
};

window.sellProduct = async (id, stock) => {

  const qty = Number(document.getElementById("qty-" + id).value);
  const custInput = document.querySelector(`.custSearch[data-row='${id}']`);
  const customerId = custInput?.dataset.custId;

  if (!customerId) return alert("Select customer");

  if (qty <= 0) return alert("Invalid quantity");

  if (qty > stock) return alert("Not enough stock available");

  const paymentType = document.getElementById("pay-" + id).value;

  const row = document.getElementById("qty-" + id).closest("tr");
  const productName = row.children[0].innerText;
  const price = Number(row.children[1].innerText);

  const itemTotal = qty * price;

  // 🔥 Update inventory first
  await updateDoc(doc(db, "inventory", id), {
    stock: stock - qty
  });

  // 🔥 Record ledger entry for both cash and credit sales
  const ledgerRef = collection(db, "customers", customerId, "ledger");

  await addDoc(ledgerRef, {
    productId: id,
    product: productName,
    qty: qty,
    amount: itemTotal,
    paymentType: paymentType, // "cash" or "credit"
    date: new Date(),
    status: "active"
  });

};
/* =========================
    LEDGER BILL CALCULATION
========================= */

function getEntryTimestamp(entry) {
  const d = entry.date || entry.rawDate;
  return d?.seconds ?? 0;
}

function getEntryPaymentType(entry) {
  return entry.paymentType || entry.type;
}

function computeBillBreakdown(entries, caller = "unknown") {
  const active = entries
    .filter(e => e.status !== "closed")
    .sort((a, b) => getEntryTimestamp(a) - getEntryTimestamp(b));

  let runningBalance = 0;
  let lastSettlementIndex = -1;
  const walkSteps = [];

  active.forEach((entry, index) => {
    const type = getEntryPaymentType(entry);
    const amount = Number(entry.amount) || 0;
    if (type === "credit") runningBalance += amount;
    else if (type === "advance") runningBalance -= amount;

    walkSteps.push({ index, type: type || "unknown", amount, runningBalance });

    if (runningBalance === 0) lastSettlementIndex = index;
  });

  const currentPeriod = lastSettlementIndex === -1
    ? active
    : active.slice(lastSettlementIndex + 1);

  let currentCharges = 0;
  let advanceApplied = 0;
  const currentCreditItems = [];

  currentPeriod.forEach(entry => {
    const type = getEntryPaymentType(entry);
    const amount = Number(entry.amount) || 0;
    if (type === "credit") {
      currentCharges += amount;
      currentCreditItems.push(entry);
    } else if (type === "advance") {
      advanceApplied += amount;
    }
  });

  const result = {
    pendingBalance: 0,
    currentCharges,
    advanceApplied,
    netOutstanding: currentCharges - advanceApplied,
    currentCreditItems,
    currentPeriod,
    hasEntries: active.length > 0,
    lastSettlementIndex,
    totalActiveEntries: active.length,
    currentPeriodSize: currentPeriod.length
  };

  // #region agent log
  fetch('http://127.0.0.1:7489/ingest/eeab04d1-0536-49e5-8079-220648491250',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'49c488'},body:JSON.stringify({sessionId:'49c488',location:'app.js:computeBillBreakdown',message:'bill breakdown computed',data:{caller,activeCount:active.length,lastSettlementIndex,walkSteps,result:{pendingBalance:result.pendingBalance,currentCharges:result.currentCharges,advanceApplied:result.advanceApplied,netOutstanding:result.netOutstanding,currentPeriodSize:result.currentPeriodSize,creditItemCount:result.currentCreditItems.length}},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
  // #endregion

  return result;
}

/* =========================
    BILLING TABLE
========================= */

const billingTable = document.getElementById("billingTable");
const paidBillsTable = document.getElementById("paidBillsTable");

if (billingTable) {

  onSnapshot(collection(db, "customers"), snap => {

    snap.forEach(cDoc => {

      const cust = cDoc.data();
      const ledgerRef = collection(db, "customers", cDoc.id, "ledger");

      onSnapshot(ledgerRef, ledgerSnap => {

        const entries = [];
        ledgerSnap.forEach(l => entries.push(l.data()));

        const { netOutstanding: total, hasEntries } = computeBillBreakdown(entries, `billing:${cDoc.id}`);

        const rowId = "row-" + cDoc.id;
        const paidRowId = "paid-row-" + cDoc.id;
        const oldRow = document.getElementById(rowId);
        const oldPaidRow = document.getElementById(paidRowId);

        // 🔥 Customer is cleared or has advance balance
        if (total <= 0) {
          // Remove from outstanding table
          if (oldRow) oldRow.remove();

          // Add to paid bills table if they have ledger entries
          if (hasEntries && paidBillsTable) {
            const statusText = total === 0
              ? "✅ Cleared"
              : "✅ Cleared (Advance: ₹ " + Math.abs(total) + ")";

            const paidHtml = `
              <tr id="${paidRowId}" style="background-color:#e6ffe6;">
                <td>${cust.name}</td>
                <td>${statusText}</td>
                <td>
                  <button onclick="showCustomerLedger('${cDoc.id}','${cust.name}')">
                    Details
                  </button>
                </td>
              </tr>`;

            if (oldPaidRow) {
              oldPaidRow.outerHTML = paidHtml;
            } else {
              paidBillsTable.innerHTML += paidHtml;
            }
          }
          return;
        }

        // 🔥 Customer has outstanding balance — show in outstanding table
        // Remove from paid table if they reappear with outstanding
        if (oldPaidRow) oldPaidRow.remove();

        const highlightStyle = total > 500 
          ? 'style="background-color:#ffe5e5;color:#b30000;font-weight:bold;"' 
          : '';

        const html = `
          <tr id="${rowId}" ${highlightStyle}>
            <td>${cust.name}</td>
            <td>₹ ${total}</td>
            <td>
              <button onclick="showCustomerLedger('${cDoc.id}','${cust.name}')">
                Details
              </button>
            </td>
          </tr>`;

        if (oldRow) {
          oldRow.outerHTML = html;
        } else {
          billingTable.innerHTML += html;
        }

      });
    });
  });
}

/* =========================
    LEDGER MODAL + PDF + RETURN + FILTER
========================= */

let currentLedgerData = [];
let currentLedgerDocIds = [];
let currentCustomerId = "";
let currentCustomerName = "";

// window.showCustomerLedger = async (custId, custName) => {

//   currentCustomerId = custId;
//   currentCustomerName = custName;

//   const ledgerRef = collection(db, "customers", custId, "ledger");

//   onSnapshot(ledgerRef, snap => {

//     currentLedgerData = [];
//     currentLedgerDocIds = [];

//     let rowsHTML = `
//       <div style="margin-bottom:10px">
//         Filter Type:
//         <select id="ledgerFilter" onchange="filterLedger()">
//           <option value="all">All</option>
//           <option value="cash">Cash</option>
//           <option value="credit">Credit</option>
//         </select>
//       </div>
//     `;

//     // rowsHTML += `
//     //   <table style="width:100%; border-collapse: collapse;">
//     //     <thead>
//     //       <tr style="background:#6b3fa0; color:#fff;">
//     //         <th style="padding:6px; border:1px solid #ddd;">Date</th>
//     //         <th style="padding:6px; border:1px solid #ddd;">Product</th>
//     //         <th style="padding:6px; border:1px solid #ddd;">Qty</th>
//     //         <th style="padding:6px; border:1px solid #ddd;">Amount</th>
//     //         <th style="padding:6px; border:1px solid #ddd;">Payment</th>
//     //         <th style="padding:6px; border:1px solid #ddd;">Return</th>
//     //       </tr>
//     //     </thead>
//     //     <tbody>
//     // `;

//     snap.forEach(d => {
//       const r = d.data();
//       const id = d.id;

//       const formattedDate = new Date(r.date.seconds * 1000).toLocaleDateString("en-GB");

//       currentLedgerDocIds.push(id);
//       currentLedgerData.push({
//         id,
//         date: formattedDate,
//         product: r.product,
//         qty: r.qty,
//         amount: r.amount,
//         type: r.paymentType
//       });

//       rowsHTML += `
//         <tr data-type="${r.paymentType}">
//           <td style="padding:6px; border:1px solid #ddd;">${formattedDate}</td>
//           <td style="padding:6px; border:1px solid #ddd;">${r.product}</td>
//           <td style="padding:6px; border:1px solid #ddd;">${r.qty}</td>
//           <td style="padding:6px; border:1px solid #ddd;">${r.amount}</td>
//           <td style="padding:6px; border:1px solid #ddd;">${r.paymentType}</td>
//           <td style="padding:6px; border:1px solid #ddd;">
//             ${r.qty > 0 ? `<button onclick="processReturn('${id}', ${r.qty}, '${r.product}')">Return</button>` : "N/A"}
//           </td>
//         </tr>
//       `;
//     });

//     // rowsHTML += `</tbody></table>`;

//     document.getElementById("ledgerBody").innerHTML = rowsHTML;

//     document.getElementById("modalCustomerName").innerText = custName + " Ledger";

//     document.getElementById("billModal").style.display = "block";
//   });
// };
window.showCustomerLedger = async (custId, custName) => {

  currentCustomerId = custId;
  currentCustomerName = custName;

  const ledgerRef = collection(db, "customers", custId, "ledger");

  // 🔴 Important: old listener remove karo
  if (ledgerUnsubscribe) {
    ledgerUnsubscribe();
  }

  ledgerUnsubscribe = onSnapshot(ledgerRef, snap => {

    currentLedgerData = [];
    currentLedgerDocIds = [];

    let rowsHTML = "";

    // Collect all active entries first
    const allEntries = [];
    snap.forEach(d => {
      const r = d.data();
      if (r.status === "closed") return;
      allEntries.push({ id: d.id, data: r });
    });

    // Sort by date (oldest first)
    allEntries.sort((a, b) => {
      const aTime = a.data.date?.seconds ?? 0;
      const bTime = b.data.date?.seconds ?? 0;
      return bTime - aTime;
    });

    // Build data arrays and HTML from sorted entries
    allEntries.forEach(({ id, data: r }) => {

      const formattedDate = new Date(r.date.seconds * 1000)
        .toLocaleDateString("en-GB");

      currentLedgerDocIds.push(id);

      currentLedgerData.push({
        id,
        rawDate: r.date,
        date: formattedDate,
        product: r.product,
        qty: r.qty,
        amount: r.amount,
        type: r.paymentType
      });

      rowsHTML += `
        <tr data-type="${r.paymentType}">
          <td>${formattedDate}</td>
          <td>${r.product}</td>
          <td>${r.qty}</td>
          <td>${r.amount}</td>
          <td>${r.paymentType}</td>
          <td>
            ${r.qty > 0 
              ? `<button onclick="processReturn('${id}', ${r.qty}, '${r.product}')">Return</button>` 
              : "N/A"}
          </td>
        </tr>
      `;
    });

    const breakdown = computeBillBreakdown(
      currentLedgerData.map(d => ({
        date: d.rawDate,
        paymentType: d.type,
        amount: d.amount,
        status: "active",
        qty: d.qty,
        product: d.product
      })),
      `modal:${custId}`
    );

    // #region agent log
    fetch('http://127.0.0.1:7489/ingest/eeab04d1-0536-49e5-8079-220648491250',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'49c488'},body:JSON.stringify({sessionId:'49c488',location:'app.js:showCustomerLedger',message:'modal row vs period mismatch check',data:{custId,displayedRowCount:currentLedgerData.length,currentPeriodSize:breakdown.currentPeriod.length,displayedTotal:currentLedgerData.reduce((s,d)=>{if(d.type==='credit')return s+d.amount;if(d.type==='advance')return s-d.amount;return s;},0),breakdownNet:breakdown.netOutstanding},timestamp:Date.now(),hypothesisId:'H8'})}).catch(()=>{});
    // #endregion

    const net = breakdown.netOutstanding;
    const adjustedBill = net > 0 ? net : 0;
    const advanceBalance = net < 0 ? Math.abs(net) : 0;

    const summaryHTML = `
        <tr style="background:#f3eef8;font-weight:bold;">
          <td colspan="3">Current Bill: ₹ ${adjustedBill.toFixed(2)}</td>
          <td colspan="3">Advance Balance: ₹ ${advanceBalance.toFixed(2)}</td>
        </tr>`;

    document.getElementById("ledgerBody").innerHTML = summaryHTML + rowsHTML;

    document.getElementById("modalCustomerName").innerText =
      custName + " Ledger";

    document.getElementById("billModal").style.display = "block";
  });
};

/* FILTER FUNCTION */
window.filterLedger = () => {
  const filterValue = document.getElementById("ledgerFilter").value;
  const rows = document.querySelectorAll("#ledgerBody tbody tr");

  rows.forEach(row => {
    const type = row.getAttribute("data-type");
    if (filterValue === "all" || type === filterValue) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
};

/* RETURN PROCESS */
// window.processReturn = async (ledgerId, maxQty, productName) => {

//   // 🔐 STEP 1: Admin PIN check
//   const pin = prompt("Enter Admin PIN to process return:");

//   if (pin !== "25464091") {
//     alert("Invalid PIN. Return cancelled.");
//     return;
//   }

//   // 📦 STEP 2: Quantity input
//   let qtyToReturn = prompt(`Enter quantity to return (max ${maxQty}):`, "1");

//   qtyToReturn = Number(qtyToReturn);

//   if (isNaN(qtyToReturn) || qtyToReturn < 1 || qtyToReturn > maxQty) {
//     alert("Invalid quantity");
//     return;
//   }

//   // 3️⃣ Get ledger doc
//   const ledgerDocRef = doc(db, "customers", currentCustomerId, "ledger", ledgerId);
//   const ledgerSnap = await getDoc(ledgerDocRef);

//   if (!ledgerSnap.exists()) {
//     alert("Ledger entry not found");
//     return;
//   }

//   const ledgerData = ledgerSnap.data();

//   // 4️⃣ Find inventory product
//   const inventorySnap = await getDocs(collection(db, "inventory"));
//   let inventoryDoc = null;

//   inventorySnap.forEach(docSnap => {
//     if (docSnap.data().name.trim().toLowerCase() === productName.trim().toLowerCase()) {
//       inventoryDoc = docSnap;
//     }
//   });

//   if (!inventoryDoc) {
//     alert("Product not found in inventory");
//     return;
//   }

//   // 5️⃣ Update stock
//   await updateDoc(doc(db, "inventory", inventoryDoc.id), {
//     stock: inventoryDoc.data().stock + qtyToReturn
//   });

//   // 6️⃣ Update ledger
//   if (ledgerData.qty === qtyToReturn) {
//     await deleteDoc(ledgerDocRef);
//   } else {
//     await updateDoc(ledgerDocRef, {
//       qty: ledgerData.qty - qtyToReturn,
//       amount: (ledgerData.amount / ledgerData.qty) * (ledgerData.qty - qtyToReturn)
//     });
//   }

//   alert(`Returned ${qtyToReturn} of ${productName} successfully!`);
// };
// window.processReturn = async (ledgerId, maxQty, productName) => {

//   const pin = prompt("Enter Admin PIN to process return:");

//   if (pin !== "25464091") {
//     alert("Invalid PIN. Return cancelled.");
//     return;
//   }

//   let qtyToReturn = prompt(`Enter quantity to return (max ${maxQty}):`, "1");
//   qtyToReturn = Number(qtyToReturn);

//   if (isNaN(qtyToReturn) || qtyToReturn < 1 || qtyToReturn > maxQty) {
//     alert("Invalid quantity");
//     return;
//   }

//   const ledgerDocRef = doc(db, "customers", currentCustomerId, "ledger", ledgerId);
//   const ledgerSnap = await getDoc(ledgerDocRef);

//   if (!ledgerSnap.exists()) {
//     alert("Ledger entry not found");
//     return;
//   }

//   const ledgerData = ledgerSnap.data();

//   // Update inventory
//   const inventorySnap = await getDocs(collection(db, "inventory"));
//   let inventoryDoc = null;

//   inventorySnap.forEach(docSnap => {
//     if (docSnap.data().name.trim().toLowerCase() === productName.trim().toLowerCase()) {
//       inventoryDoc = docSnap;
//     }
//   });

//   if (!inventoryDoc) {
//     alert("Product not found in inventory");
//     return;
//   }

//   await updateDoc(doc(db, "inventory", inventoryDoc.id), {
//     stock: inventoryDoc.data().stock + qtyToReturn
//   });

//   const ledgerRef = collection(db, "customers", currentCustomerId, "ledger");

//   const returnAmount = (ledgerData.amount / ledgerData.qty) * qtyToReturn;

//   // Instead of deleting, mark closed
//   await updateDoc(ledgerDocRef, { status: "closed" });

//   // Restore advance instead of deleting
//   await addDoc(ledgerRef, {
//     product: "Advance Restored (Return)",
//     qty: 0,
//     amount: returnAmount,
//     paymentType: "advance",
//     date: new Date(),
//     status: "active"
//   });

//   alert(`Returned ${qtyToReturn} of ${productName} successfully!`);
// };
window.processReturn = async (ledgerId, maxQty, productName) => {

  const pin = prompt("Enter Admin PIN to process return:");
  if (pin !== "25464091") {
    alert("Invalid PIN. Return cancelled.");
    return;
  }

  let qtyToReturn = prompt(`Enter quantity to return (max ${maxQty}):`, "1");
  qtyToReturn = Number(qtyToReturn);

  if (isNaN(qtyToReturn) || qtyToReturn < 1 || qtyToReturn > maxQty) {
    alert("Invalid quantity");
    return;
  }

  const ledgerDocRef = doc(db, "customers", currentCustomerId, "ledger", ledgerId);
  const ledgerSnap = await getDoc(ledgerDocRef);

  if (!ledgerSnap.exists()) {
    alert("Ledger entry not found");
    return;
  }

  const ledgerData = ledgerSnap.data();

  // 🔥 Only allow return for credit items
  if (ledgerData.paymentType !== "credit") {
    alert("Only sold items can be returned.");
    return;
  }

  // 🔥 Update inventory safely using productId
  if (ledgerData.productId) {
    const inventoryDocRef = doc(db, "inventory", ledgerData.productId);
    const invSnap = await getDoc(inventoryDocRef);

    if (invSnap.exists()) {
      await updateDoc(inventoryDocRef, {
        stock: invSnap.data().stock + qtyToReturn
      });
    }
  }

  const unitRate = ledgerData.amount / ledgerData.qty;
  const returnAmount = unitRate * qtyToReturn;

  // 🔥 Partial return support
  if (qtyToReturn === ledgerData.qty) {
    // Full return → close entry
    await updateDoc(ledgerDocRef, { status: "closed" });
  } else {
    // Partial return → reduce qty & amount
    await updateDoc(ledgerDocRef, {
      qty: ledgerData.qty - qtyToReturn,
      amount: ledgerData.amount - returnAmount
    });
  }

  alert(`Returned ${qtyToReturn} of ${productName} successfully!`);
};

/* =========================
   Adding CUSTOMERS LIST (CUSTOMERS PAGE)
========================= */
window.addCustomer = async function () {

  const nameInput = document.getElementById("cname");

  const name = nameInput.value.trim();

  if (!name) {
    alert("Enter customer name");
    return;
  }

  await addDoc(collection(db, "customers"), {
    name: name
  });

  nameInput.value = "";

};

/* =========================
   CUSTOMERS LIST (CUSTOMERS PAGE)
========================= */
const customersTable = document.getElementById("customersTable");

if (customersTable) {

  onSnapshot(collection(db, "customers"), snap => {

    let html = "";

    snap.forEach(d => {
      const c = d.data();

      html += `
        <tr>
          <td>${c.name}</td>
          <td>
            <button onclick="deleteCustomer('${d.id}')">Remove</button>
          </td>
        </tr>`;
    });

    customersTable.innerHTML = html;
  });

}

/* DELETE CUSTOMER */
window.deleteCustomer = async (id) => {
  if (!confirm("Delete this customer?")) return;
  await deleteDoc(doc(db, "customers", id));
};

/* DELETE PRODUCT (PIN PROTECTED) */
window.deleteProduct = async (id) => {

  const pin = prompt("Enter Admin PIN to delete product:");

  if (pin !== "25464091") {
    alert("Invalid PIN. Product not deleted.");
    return;
  }

  if (!confirm("Delete this product permanently?")) return;

  await deleteDoc(doc(db, "inventory", id));

  alert("Product deleted successfully");
};

/* QUANTITY STEPPER */
window.stepQty = (id, step) => {
  const qtyInput = document.getElementById("qty-" + id);
  let val = Number(qtyInput.value) + step;
  if (val < 1) val = 1;
  qtyInput.value = val;
};

//generate PDF from ledger
// window.generatePDF = function () {

//   if (!currentLedgerData || currentLedgerData.length === 0) {
//     alert("No data available to generate PDF.");
//     return;
//   }

//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   let y = 20;

//   // 🔷 HEADER
//   doc.setFillColor(43, 104, 126);
//   doc.rect(0, 0, 210, 30, "F");

//   doc.setTextColor(255, 255, 255);
//   doc.setFontSize(22);
//   doc.text("INVOICE", 15, 20);

//   doc.setFontSize(12);
//   doc.text("Gulati Traders", 150, 15);
//   doc.text("Shiamgir", 150, 20);
//   doc.text("Phone: xxx", 150, 25);

//   doc.setTextColor(0, 0, 0);

//   y = 40;

//   // 🔷 BILL INFO
//   doc.setFontSize(12);
//   doc.text("Invoice No: " + Math.floor(Math.random() * 100000), 15, y);
//   doc.text("Date: " + new Date().toLocaleDateString("en-GB"), 150, y);

//   y += 10;

//   doc.text("Bill To:", 15, y);
//   y += 6;
//   doc.text(currentCustomerName, 15, y);

//   y += 15;

//   // 🔷 TABLE HEADER BACKGROUND
//   doc.setFillColor(230, 230, 230);
//   doc.rect(10, y - 5, 190, 8, "F");

//   // 🔷 COLUMN HEADERS (Proper Spacing)
//   doc.setFontSize(11);
//   doc.text("Date", 12, y);
//   doc.text("Item", 40, y);
//   doc.text("Qty", 120, y);
//   doc.text("Rate", 140, y);
//   doc.text("Amount", 165, y);

//   y += 10;

//   let subtotal = 0;

//   // currentLedgerData.forEach((item) => {

//   //   const rate = item.amount / item.qty;
//   //   subtotal += item.amount;

//   //   doc.text(item.date, 12, y);
//   //   doc.text(item.product.substring(0, 25), 40, y); // prevent overflow
//   //   doc.text(String(item.qty), 120, y);
//   //   doc.text("Rs " + rate.toFixed(2), 140, y);
//   //   doc.text("Rs " + item.amount.toFixed(2), 165, y);

//   //   y += 8;
//   // });
//   currentLedgerData.forEach((item) => {

//   // Only show credit items
//   if (item.type !== "credit") return;

//   const rate = item.amount / item.qty;
//   subtotal += item.amount;

//   doc.text(item.date, 12, y);
//   doc.text(item.product.substring(0, 25), 40, y);
//   doc.text(String(item.qty), 120, y);
//   doc.text("Rs " + rate.toFixed(2), 140, y);
//   doc.text("Rs " + item.amount.toFixed(2), 165, y);

//   y += 8;
// });

//   y += 10;

//   // 🔷 TOTAL SECTION
//   doc.line(120, y - 5, 195, y - 5);

//   doc.setFontSize(13);
//   doc.text("Total:", 140, y);
//   doc.text("Rs " + subtotal.toFixed(2), 165, y);

//   y += 20;

//   // 🔷 FOOTER
//   doc.setFillColor(43, 104, 126);
//   doc.rect(0, 280, 210, 15, "F");

//   doc.setTextColor(255, 255, 255);
//   doc.setFontSize(10);
//   doc.text("Thank you for your business!", 70, 290);

//   doc.save(currentCustomerName + "_Invoice.pdf");
// };
// window.generatePDF = function () {

//   if (!currentLedgerData || currentLedgerData.length === 0) {
//     alert("No data available to generate PDF.");
//     return;
//   }

//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   let y = 20;

//   // 🔷 HEADER
//   doc.setFillColor(43, 104, 126);
//   doc.rect(0, 0, 210, 30, "F");

//   doc.setTextColor(255, 255, 255);
//   doc.setFontSize(22);
//   doc.text("INVOICE", 15, 20);

//   doc.setFontSize(12);
//   doc.text("Gulati Traders", 150, 15);
//   doc.text("Shiamgir", 150, 20);
//   doc.text("Phone: xxx", 150, 25);

//   doc.setTextColor(0, 0, 0);

//   y = 40;

//   doc.setFontSize(12);
//   doc.text("Invoice No: " + Math.floor(Math.random() * 100000), 15, y);
//   doc.text("Date: " + new Date().toLocaleDateString("en-GB"), 150, y);

//   y += 10;

//   doc.text("Bill To:", 15, y);
//   y += 6;
//   doc.text(currentCustomerName, 15, y);

//   y += 15;

//   // 🔷 TABLE HEADER
//   doc.setFillColor(230, 230, 230);
//   doc.rect(10, y - 5, 190, 8, "F");

//   doc.setFontSize(11);
//   doc.text("Date", 12, y);
//   doc.text("Item", 40, y);
//   doc.text("Qty", 120, y);
//   doc.text("Rate", 140, y);
//   doc.text("Amount", 165, y);

//   y += 10;

//   let creditTotal = 0;
//   let paymentTotal = 0;

//   // 🔥 Calculate totals properly
//   currentLedgerData.forEach((item) => {

//     if (item.type === "credit") {
//       creditTotal += item.amount;

//       const rate = item.amount / item.qty;

//       doc.text(item.date, 12, y);
//       doc.text(item.product.substring(0, 25), 40, y);
//       doc.text(String(item.qty), 120, y);
//       doc.text("Rs " + rate.toFixed(2), 140, y);
//       doc.text("Rs " + item.amount.toFixed(2), 165, y);

//       y += 8;
//     }

//     if (item.type === "payment") {
//       paymentTotal += item.amount;
//     }

//   });

//   const finalAmount = creditTotal - paymentTotal;

//   y += 10;

//   // 🔷 TOTAL SECTION
//   doc.line(120, y - 5, 195, y - 5);

//   doc.setFontSize(13);
//   doc.text("Total:", 140, y);
//   doc.text("Rs " + finalAmount.toFixed(2), 165, y);

//   y += 20;

//   // 🔷 FOOTER
//   doc.setFillColor(43, 104, 126);
//   doc.rect(0, 280, 210, 15, "F");

//   doc.setTextColor(255, 255, 255);
//   doc.setFontSize(10);
//   doc.text("Thank you for your business!", 70, 290);

//   doc.save(currentCustomerName + "_Invoice.pdf");
// };

window.generatePDF = function () {

  if (!currentLedgerData || currentLedgerData.length === 0) {
    alert("No data available to generate PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  // 🔷 HEADER
  doc.setFillColor(43, 104, 126);
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("INVOICE", 15, 20);

  doc.setFontSize(12);
  doc.text("Gulati Traders", 150, 15);
  doc.text("Shiamgir", 150, 20);
  doc.text("Phone: xxx", 150, 25);

  doc.setTextColor(0, 0, 0);

  y = 40;

  doc.setFontSize(12);
  doc.text("Invoice No: " + Math.floor(Math.random() * 100000), 15, y);
  doc.text("Date: " + new Date().toLocaleDateString("en-GB"), 150, y);

  y += 10;

  doc.text("Bill To:", 15, y);
  y += 6;
  doc.text(currentCustomerName, 15, y);

  y += 15;

  // 🔷 TABLE HEADER
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y - 5, 190, 8, "F");

  doc.setFontSize(11);
  doc.text("Date", 12, y);
  doc.text("Item", 40, y);
  doc.text("Qty", 120, y);
  doc.text("Rate", 140, y);
  doc.text("Amount", 165, y);

  y += 10;

  // let creditTotal = 0;
  // let paymentTotal = 0;

const breakdown = computeBillBreakdown(
  currentLedgerData.map(d => ({
    date: d.rawDate,
    paymentType: d.type,
    amount: d.amount,
    status: "active",
    qty: d.qty,
    product: d.product,
    dateLabel: d.date
  })),
  `pdf:${currentCustomerId}`
);

const { pendingBalance: previousBalance, currentCharges: currentBillTotal, advanceApplied: advanceCurrent, netOutstanding: netBalance, currentCreditItems } = breakdown;

currentCreditItems.forEach((item) => {
  const rate = item.qty > 0 ? item.amount / item.qty : 0;
  const dateStr = item.dateLabel
    || (item.date ? new Date(item.date.seconds * 1000).toLocaleDateString("en-GB") : "");

  doc.text(dateStr, 12, y);
  doc.text((item.product || "").substring(0, 25), 40, y);
  doc.text(String(item.qty), 120, y);
  doc.text("Rs " + rate.toFixed(2), 140, y);
  doc.text("Rs " + item.amount.toFixed(2), 165, y);

  y += 8;
});

y += 10;
doc.line(110, y - 5, 195, y - 5);
doc.setFontSize(11);

doc.text("Current Bill Total:", 120, y);
  doc.text("₹ " + currentBillTotal.toFixed(2), 165, y);
  y += 8;

  if (advanceCurrent > 0) {
    doc.text("Advance :", 120, y);
    doc.text("₹ -" + advanceCurrent.toFixed(2), 165, y);
    y += 8;
  }

  doc.line(120, y - 2, 195, y - 2);
  y += 8;
  doc.setFontSize(13);

  const adjustedBillPdf = netBalance > 0 ? netBalance : 0;
  const advanceBalancePdf = netBalance < 0 ? Math.abs(netBalance) : 0;

  doc.text("Current Bill:", 120, y);
  doc.text("₹ " + adjustedBillPdf.toFixed(2), 165, y);
  y += 8;

  doc.text("Advance Balance:", 120, y);
  doc.text("₹ " + advanceBalancePdf.toFixed(2), 165, y);
y += 20;
// 🔷 FOOTER
doc.setFillColor(43, 104, 126);
doc.rect(0, 280, 210, 15, "F");

doc.setTextColor(255, 255, 255);
doc.setFontSize(10);
doc.text("Thank you for your business!", 70, 290);

doc.save(currentCustomerName + "_Invoice.pdf");
};

window.generateFullLedgerPDF = function () {
  if (!currentLedgerData || currentLedgerData.length === 0) {
    alert("No data available to generate Ledger.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFillColor(43, 104, 126);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("FULL CUSTOMER LEDGER", 15, 20);
  doc.setFontSize(12);
  doc.text("Gulati Traders", 150, 15);
  doc.text("Shiamgir", 150, 20);
  doc.setTextColor(0, 0, 0);

  y = 40;
  doc.setFontSize(12);
  doc.text("Ledger For: " + currentCustomerName, 15, y);
  doc.text("Date: " + new Date().toLocaleDateString("en-GB"), 150, y);
  
  y += 15;
  
  // Table Header
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y - 5, 190, 8, "F");
  doc.setFontSize(11);
  doc.text("Date", 12, y);
  doc.text("Item / Description", 40, y);
  doc.text("Type", 110, y);
  doc.text("Qty", 140, y);
  doc.text("Amount", 165, y);
  y += 10;

  let totalOutstanding = 0;
  
  currentLedgerData.sort((a, b) => a.rawDate.seconds - b.rawDate.seconds);
  currentLedgerData.forEach((item) => {
    doc.text(item.date, 12, y);
    doc.text(item.product.substring(0, 25), 40, y);

    if (item.type === "credit") {
      doc.text("Purchase", 110, y);
      doc.text(String(item.qty), 140, y);
      doc.text("₹ " + item.amount.toFixed(2), 165, y);
      totalOutstanding += item.amount;
    } else {
      doc.text("Payment", 110, y);
      doc.text("-", 140, y);
      doc.setTextColor(0, 128, 0);
      doc.text("₹ -" + item.amount.toFixed(2), 165, y);
      doc.setTextColor(0, 0, 0);
      totalOutstanding -= item.amount;
    }
    y += 8;

    // Handle page breaks
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 10;
  doc.line(110, y - 5, 195, y - 5);
  doc.setFontSize(13);
  
  const adjustedBillLedger = totalOutstanding > 0 ? totalOutstanding : 0;
  const advanceBalanceLedger = totalOutstanding < 0 ? Math.abs(totalOutstanding) : 0;

  doc.text("Current Bill:", 120, y);
  doc.text("₹ " + adjustedBillLedger.toFixed(2), 165, y);
  y += 8;

  doc.text("Advance Balance:", 120, y);
  doc.text("₹ " + advanceBalanceLedger.toFixed(2), 165, y);

  doc.save(currentCustomerName + "_Full_Ledger.pdf");
};

// window.addPayment = async function () {

//   let amount = prompt("Enter payment amount:");

//   amount = Number(amount);

//   if (isNaN(amount) || amount <= 0) {
//     alert("Invalid amount");
//     return;
//   }

//   await addDoc(
//     collection(db, "customers", currentCustomerId, "ledger"),
//     {
//       product: "Payment",
//       qty: 0,
//       amount: amount,
//       paymentType: "payment",
//       date: new Date()
//     }
//   );

//   alert("Payment added successfully!");

// };
// window.addPayment = async function () {

//   const amountInput = prompt("Enter amount received from customer:");
//   const amount = Number(amountInput);

//   if (isNaN(amount) || amount <= 0) {
//     alert("Invalid amount");
//     return;
//   }

//   const ledgerRef = collection(db, "customers", currentCustomerId, "ledger");

//   // 🔥 Just add payment as advance entry
//   await addDoc(ledgerRef, {
//     product: "Payment Received",
//     qty: 0,
//     amount: amount,
//     paymentType: "advance",
//     date: new Date(),
//     status: "active"
//   });

//   alert("Payment added successfully!");

// };


window.addPayment = async function () {

  const amountInput = prompt("Enter amount received from customer:");
  const amount = Number(amountInput);

  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount");
    return;
  }

  const ledgerRef = collection(db, "customers", currentCustomerId, "ledger");

  await addDoc(ledgerRef, {
    product: "Payment Received",
    qty: 0,
    amount: amount,
    paymentType: "advance",
    date: new Date(),
    status: "active"
  });

  alert("Payment recorded successfully");

};
// Attach Add Payment button event
const paymentBtn = document.getElementById("addPaymentBtn");

if (paymentBtn) {
  paymentBtn.addEventListener("click", async () => {
    await window.addPayment();
  });
}

function normalizeCustomerName(name, email) {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim();

  if (trimmedName && trimmedName !== trimmedEmail && !trimmedName.includes('@')) {
    return trimmedName;
  }

  if (trimmedEmail) {
    const localPart = trimmedEmail.split('@')[0]?.trim();
    return localPart || 'Customer';
  }

  return trimmedName || 'Customer';
}

function normalizeOrderStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value || value === "new" || value === "pending") return "pending";
  return value;
}

function formatOrderStatus(status) {
  const value = normalizeOrderStatus(status);
  return value
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatOrderDate(value) {
  if (!value) return "N/A";

  if (value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleString();
}

function formatCurrency(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function getSessionOrders() {
  try {
    const raw = sessionStorage.getItem("shop_session_test_orders");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to read fallback session orders:", error);
    return [];
  }
}

function getOrderTime(order) {
  const source = order.timestamp || order.createdAt || order.updatedAt;

  if (source && typeof source.toDate === "function") {
    return source.toDate().getTime();
  }

  if (source && typeof source === "object" && source.seconds !== undefined) {
    return new Date(source.seconds * 1000).getTime();
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function mergeOrders(firestoreOrders = []) {
  const fallbackOrders = getSessionOrders();
  const merged = [...fallbackOrders, ...firestoreOrders];
  const deduped = new Map();

  merged.forEach(order => {
    const key = order.orderId || order.id || `${order.customer?.contact || "customer"}-${getOrderTime(order)}`;
    if (!deduped.has(key)) {
      deduped.set(key, {
        ...order,
        orderId: order.orderId || order.id || key,
        id: order.id || order.orderId || key,
        orderStatus: order.orderStatus || "new",
        customer: order.customer || {},
        items: Array.isArray(order.items) ? order.items : [],
        pricing: order.pricing || {}
      });
    }
  });

  return Array.from(deduped.values()).sort((a, b) => getOrderTime(b) - getOrderTime(a));
}

window.closeOrderModal = function () {
  const modal = document.getElementById("orderDetailsModal");
  if (modal) modal.style.display = "none";
};

async function getInventoryAvailabilityForOrder(order) {
  const entries = Array.isArray(order?.items) ? order.items : [];
  if (!entries.length) return true;

  const inventorySnap = await getDocs(collection(db, "inventory"));
  const inventoryMap = new Map();

  inventorySnap.forEach(docSnap => {
    const data = docSnap.data() || {};
    inventoryMap.set(docSnap.id, { id: docSnap.id, ...data });
    inventoryMap.set(String(data.name || '').trim().toLowerCase(), { id: docSnap.id, ...data });
  });

  for (const item of entries) {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;

    const inventoryItem = item.productId ? inventoryMap.get(item.productId) : null;
    const fallbackMatch = inventoryItem || inventoryMap.get(String(item.name || '').trim().toLowerCase());
    if (!fallbackMatch) continue;

    const currentStock = Number(fallbackMatch.stock || 0);
    if (currentStock < quantity) {
      return false;
    }
  }

  return true;
}

async function restoreInventoryForOrder(order) {
  if (!order || !Array.isArray(order.items) || !order.items.length) return;

  const inventorySnap = await getDocs(collection(db, "inventory"));
  const inventoryMap = new Map();

  inventorySnap.forEach(docSnap => {
    const data = docSnap.data() || {};
    inventoryMap.set(docSnap.id, { id: docSnap.id, ...data });
    inventoryMap.set(String(data.name || '').trim().toLowerCase(), { id: docSnap.id, ...data });
  });

  for (const item of order.items) {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;

    const inventoryItem = item.productId ? inventoryMap.get(item.productId) : null;
    const fallbackMatch = inventoryItem || inventoryMap.get(String(item.name || '').trim().toLowerCase());
    if (!fallbackMatch) continue;

    const inventoryRef = doc(db, "inventory", fallbackMatch.id);
    const snapshot = await getDoc(inventoryRef);
    if (!snapshot.exists()) continue;

    const currentStock = Number(snapshot.data()?.stock || 0);
    await updateDoc(inventoryRef, {
      stock: currentStock + quantity,
      updatedAt: new Date()
    });
  }
}

async function commitAcceptedOrderStock(order) {
  if (!order || !Array.isArray(order.items) || !order.items.length) return;

  const inventorySnap = await getDocs(collection(db, "inventory"));
  const inventoryMap = new Map();

  inventorySnap.forEach(docSnap => {
    const data = docSnap.data() || {};
    inventoryMap.set(docSnap.id, { id: docSnap.id, ...data });
    inventoryMap.set(String(data.name || '').trim().toLowerCase(), { id: docSnap.id, ...data });
  });

  for (const item of order.items) {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;

    const productId = item.productId || item.id;
    const inventoryEntry = productId ? inventoryMap.get(productId) : null;
    const fallbackEntry = inventoryEntry || inventoryMap.get(String(item.name || '').trim().toLowerCase());

    if (!fallbackEntry) continue;

    const inventoryRef = doc(db, "inventory", fallbackEntry.id);

    await runTransaction(db, async (transaction) => {
      const currentSnap = await transaction.get(inventoryRef);
      if (!currentSnap.exists()) return;

      const currentStock = Number(currentSnap.data()?.stock || 0);
      const nextStock = Math.max(0, currentStock - quantity);
      transaction.update(inventoryRef, {
        stock: nextStock,
        updatedAt: new Date()
      });
    });
  }
}

window.acceptOrder = async function (orderId) {
  const order = window.ordersCache.find(item => (item.orderId || item.id) === orderId);
  if (!order) return;

  try {
    const hasStockAvailable = await getInventoryAvailabilityForOrder(order);
    if (!hasStockAvailable) {
      alert("This order cannot be accepted because the inventory for one or more items has already been exhausted.");
      return;
    }

    if (order.items && Array.isArray(order.items)) {
      await commitAcceptedOrderStock(order);
    }

    const customer = order.customer || {};
    const customerName = normalizeCustomerName(customer.name, customer.email);
    const customerPhone = customer.contact || "";
    const customerEmail = customer.email || "";
    const customerAddress = customer.deliveryAddress || customer.address || "";

    const customerSnap = await getDocs(collection(db, "customers"));
    let targetCustomerId = null;

    customerSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const matchesPhone = customerPhone && data.contact === customerPhone;
      const matchesEmail = customerEmail && data.email === customerEmail;
      if (matchesPhone || matchesEmail) {
        targetCustomerId = docSnap.id;
      }
    });

    if (targetCustomerId) {
      await updateDoc(doc(db, "customers", targetCustomerId), {
        name: customerName,
        contact: customerPhone,
        email: customerEmail,
        address: customerAddress,
        updatedAt: new Date()
      });
    } else {
      await addDoc(collection(db, "customers"), {
        name: customerName,
        contact: customerPhone,
        email: customerEmail,
        address: customerAddress,
        createdAt: new Date(),
        source: "accepted_order"
      });
    }

    if (order.id) {
      await updateDoc(doc(db, "orders", order.id), {
        orderStatus: "accepted",
        acceptedAt: new Date(),
        acceptedBy: "admin"
      });
    }

    alert("Order accepted and inventory updated.");
  } catch (error) {
    console.error("Failed to accept order:", error);
    alert("Unable to accept this order right now.");
  }
};

window.rejectOrder = async function (orderId) {
  const order = window.ordersCache.find(item => (item.orderId || item.id) === orderId);
  if (!order) return;

  const orderLabel = order.orderId || order.id || "this order";
  const confirmed = window.confirm(
    `Mark ${orderLabel} as rejected? It will stay in Firestore with a rejected status and appear in the rejected log.`
  );
  if (!confirmed) return;

  try {
    if (order.id) {
      const currentStatus = normalizeOrderStatus(order.orderStatus);
      if (currentStatus === "accepted") {
        await restoreInventoryForOrder(order);
      }

      await updateDoc(doc(db, "orders", order.id), {
        orderStatus: "rejected",
        rejectedAt: new Date(),
        rejectedBy: "admin",
        updatedAt: new Date()
      });
      alert("Order marked as rejected and inventory restored if it had already been reduced.");
    } else {
      alert("This local order was only marked as rejected in the admin view.");
    }
  } catch (error) {
    console.error("Failed to reject order:", error);
    alert("Unable to update this order status to rejected.");
  }
};

window.removeOrder = function (orderId) {
  window.rejectOrder(orderId);
};

window.ordersCache = [];

window.showOrderDetails = function (orderId) {
  const order = window.ordersCache.find(item => (item.orderId || item.id) === orderId);

  if (!order) return;

  const modal = document.getElementById("orderDetailsModal");
  const content = document.getElementById("orderDetailsContent");
  if (!modal || !content) return;

  const statusLabel = formatOrderStatus(order.orderStatus);
  const itemRows = (order.items || []).map(item => `
    <tr>
      <td>${item.name || "Product"}</td>
      <td>${item.quantity || 0}</td>
      <td>${formatCurrency(item.unitPrice || 0)}</td>
      <td>${formatCurrency(item.itemTotal || 0)}</td>
    </tr>
  `).join("") || '<tr><td colspan="4">No items</td></tr>';

  const displayCustomerName = normalizeCustomerName(order.customer?.name, order.customer?.email);
  document.getElementById("orderModalTitle").textContent = `${order.orderId} • ${statusLabel}`;
  content.innerHTML = `
    <div class="details-grid">
      <div class="detail-box">
        <h4>Customer</h4>
        <div>${displayCustomerName}</div>
      </div>
      <div class="detail-box">
        <h4>Contact</h4>
        <div>${order.customer?.contact || "N/A"}</div>
      </div>
      <div class="detail-box">
        <h4>Placed</h4>
        <div>${formatOrderDate(order.timestamp || order.createdAt || order.updatedAt)}</div>
      </div>
      <div class="detail-box">
        <h4>Status</h4>
        <div>${statusLabel}</div>
      </div>
    </div>

    <div class="detail-box" style="margin-bottom: 16px;">
      <h4>Delivery Address</h4>
      <div>${order.customer?.deliveryAddress || "No address provided"}</div>
    </div>

    <table class="rows-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="amount-total">
      Total: ${formatCurrency(order.pricing?.grandTotal || 0)}
    </div>
  `;

  modal.style.display = "block";
};

function initOrdersPage() {
  const pendingTableBody = document.getElementById("pendingOrdersTableBody");
  const acceptedTableBody = document.getElementById("acceptedOrdersTableBody");
  const rejectedTableBody = document.getElementById("rejectedOrdersTableBody");
  const tabButtons = document.querySelectorAll(".tab-btn");

  if (!pendingTableBody || !acceptedTableBody || !rejectedTableBody) return;

  const switchTab = (targetId) => {
    const containers = document.querySelectorAll(".table-container");
    containers.forEach(container => {
      container.classList.toggle("active", container.id === targetId);
    });

    tabButtons.forEach(button => {
      button.classList.toggle("active", button.dataset.target === targetId);
    });
  };

  tabButtons.forEach(button => {
    button.addEventListener("click", () => switchTab(button.dataset.target));
  });

  const renderOrderRows = (orders, tableBody, statusFilter) => {
    const filteredOrders = orders.filter(order => normalizeOrderStatus(order.orderStatus) === statusFilter);

    if (filteredOrders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
            No ${statusFilter} orders in the log.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filteredOrders.map(order => {
      const status = formatOrderStatus(order.orderStatus);
      const displayCustomerName = normalizeCustomerName(order.customer?.name, order.customer?.email);
      const statusColor = {
        "Pending": "#e0f2fe",
        "Accepted": "#dcfce7",
        "Rejected": "#fee2e2"
      };

      const textColor = {
        "Pending": "#075985",
        "Accepted": "#166534",
        "Rejected": "#991b1b"
      };

      const style = `background:${statusColor[status] || '#e2e8f0'}; color:${textColor[status] || '#334155'};`;
      const orderKey = order.orderId || order.id;
      const isAccepted = normalizeOrderStatus(order.orderStatus) === "accepted";
      const isRejected = normalizeOrderStatus(order.orderStatus) === "rejected";

      return `
        <tr>
          <td>${orderKey}</td>
          <td>${displayCustomerName}</td>
          <td>${order.customer?.contact || "N/A"}</td>
          <td>${formatOrderDate(order.timestamp || order.createdAt || order.updatedAt)}</td>
          <td><span class="status-pill" style="${style}">${status}</span></td>
          <td>${formatCurrency(order.pricing?.grandTotal || 0)}</td>
          <td>
            <button class="action-btn" onclick="showOrderDetails('${orderKey}')">View</button>
            ${statusFilter === "pending" ? `
              <button class="action-btn" onclick="acceptOrder('${orderKey}')" ${isAccepted ? 'disabled' : ''}>Accept</button>
              <button class="action-btn delete" onclick="rejectOrder('${orderKey}')" ${isRejected ? 'disabled' : ''}>Reject</button>
            ` : ""}
          </td>
        </tr>
      `;
    }).join("");
  };

  const renderOrders = (orders) => {
    window.ordersCache = orders;
    renderOrderRows(orders, pendingTableBody, "pending");
    renderOrderRows(orders, acceptedTableBody, "accepted");
    renderOrderRows(orders, rejectedTableBody, "rejected");
  };

  const normalizeExistingOrderNames = async (orders) => {
    const updates = orders
      .filter(order => !!order.id && String(order.customer?.email || '').trim())
      .map(async order => {
        try {
          const matchingCustomer = await getCustomerProfileByEmail(order.customer?.email || '');
          const customerName = matchingCustomer?.name || normalizeCustomerName(order.customer?.name, order.customer?.email);
          const currentName = String(order.customer?.name || '').trim();

          if (!matchingCustomer && currentName === customerName) return;
          if (matchingCustomer && currentName === customerName) return;

          await updateDoc(doc(db, 'orders', order.id), {
            customer: {
              ...(order.customer || {}),
              name: customerName
            },
            updatedAt: new Date()
          });
        } catch (error) {
          console.warn('Order customer name sync skipped:', error);
        }
      });

    if (updates.length) {
      await Promise.allSettled(updates);
    }
  };

  renderOrders(mergeOrders([]));

  onSnapshot(collection(db, "orders"), async (snapshot) => {
    const firestoreOrders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    await normalizeExistingOrderNames(firestoreOrders);
    renderOrders(mergeOrders(firestoreOrders));
  }, (error) => {
    console.error("Orders snapshot failed:", error);
    renderOrders(mergeOrders([]));
  });
}

if (document.getElementById("pendingOrdersTableBody")) {
  initOrdersPage();
}