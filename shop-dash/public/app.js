import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc,
  updateDoc, deleteDoc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAawUopX1lromd5nFeMPoogEXFzLZ7ZnXM",
  authDomain: "shopportal-f6630.firebaseapp.com",
  projectId: "shopportal-f6630"
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

/* CUSTOMER CACHE */
window._customersCache = [];

onSnapshot(collection(db, "customers"), snap => {
  window._customersCache = [];
  snap.forEach(d => {
    window._customersCache.push({ id: d.id, name: d.data().name });
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

/* ADD PRODUCT */
window.addProduct = async () => {
  await addDoc(collection(db, "inventory"), {
    name: pname.value,
    price: Number(pprice.value),
    stock: Number(pstock.value)
  });
};

/* =========================
    INVENTORY REALTIME + SEARCH
========================= */

const inventoryList = document.getElementById("inventoryList");
const productSearchInput = document.getElementById("productSearch");

let inventoryCache = [];

if (inventoryList) {

  onSnapshot(collection(db, "inventory"), snap => {

    inventoryCache = [];
    snap.forEach(d => {
      inventoryCache.push({ id: d.id, ...d.data() });
    });

    renderInventory(inventoryCache);
  });

  productSearchInput?.addEventListener("input", () => {
    const term = productSearchInput.value.toLowerCase();

    const filtered = inventoryCache.filter(p =>
      p.name.toLowerCase().includes(term)
    );

    renderInventory(filtered);
  });
}

function renderInventory(products) {

  let html = "";

  products.forEach(p => {

    html += `
      <tr>
        <td>${p.name}</td>
        <td>${p.price}</td>
        <td>${p.stock}</td>

        <td style="position:relative">
          <input type="text"
            class="custSearch"
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
          <label class="switch">
            <input type="checkbox" id="pay-${p.id}">
            <span class="slider"></span>
          </label>
          <button onclick="sellProduct('${p.id}', ${p.stock})">Sell</button>
        </td>

        <td>
          <button onclick="deleteProduct('${p.id}')">Remove</button>
        </td>
      </tr>`;
  });

  inventoryList.innerHTML = html;
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
window.sellProduct = async (id, stock) => {

  const qty = Number(document.getElementById("qty-" + id).value);
  const custInput = document.querySelector(`.custSearch[data-row='${id}']`);
  const customerId = custInput?.dataset.custId;

  if (!customerId) return alert("Select customer");

  if (qty <= 0) return alert("Invalid quantity");

  if (qty > stock) return alert("Not enough stock available");

  const paymentType = document.getElementById("pay-" + id).checked ? "credit" : "cash";

  const row = document.getElementById("qty-" + id).closest("tr");
  const productName = row.children[0].innerText;
  const price = Number(row.children[1].innerText);

  const itemTotal = qty * price;

  // 🔥 Update inventory first
  await updateDoc(doc(db, "inventory", id), {
    stock: stock - qty
  });

  // 🔥 If cash sale → no ledger entry
  if (paymentType === "cash") return;

  // 🔥 Credit sale → simple ledger entry
  const ledgerRef = collection(db, "customers", customerId, "ledger");

  await addDoc(ledgerRef, {
    productId: id,
    product: productName,
    qty: qty,
    amount: itemTotal,
    paymentType: "credit",
    date: new Date(),
    status: "active"
  });

};
/* =========================
    BILLING TABLE
========================= */

const billingTable = document.getElementById("billingTable");

if (billingTable) {

  onSnapshot(collection(db, "customers"), snap => {

    snap.forEach(cDoc => {

      const cust = cDoc.data();
      const ledgerRef = collection(db, "customers", cDoc.id, "ledger");

      onSnapshot(ledgerRef, ledgerSnap => {

        let total = 0;
      ledgerSnap.forEach(l => {

        const data = l.data();

        if (data.status === "closed") return;

        if (data.paymentType === "credit") {
          total += data.amount;
        }

        if (data.paymentType === "advance") {
          total -= data.amount;
        }

      });


        const rowId = "row-" + cDoc.id;
        const oldRow = document.getElementById(rowId);

        // 🔥 REMOVE ROW IF TOTAL 0
        if (total <= 0) {
          if (oldRow) oldRow.remove();
          return;
        }

        // const html = `
        //   <tr id="${rowId}">
        //     <td>${cust.name}</td>
        //     <td>₹ ${total}</td>
        //     <td>
        //       <button onclick="showCustomerLedger('${cDoc.id}','${cust.name}')">
        //         Details
        //       </button>
        //     </td>
        //   </tr>`;
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

    snap.forEach(d => {

      const r = d.data();
      const id = d.id;

      if (r.status === "closed") return;
      
      const formattedDate = new Date(r.date.seconds * 1000)
        .toLocaleDateString("en-GB");

      currentLedgerDocIds.push(id);

      // currentLedgerData.push({
      //   id,
      //   date: formattedDate,
      //   product: r.product,
      //   qty: r.qty,
      //   amount: r.amount,
      //   type: r.paymentType
      // });
      currentLedgerData.push({
        id,
        rawDate: r.date,   // 🔥 important
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

    document.getElementById("ledgerBody").innerHTML = rowsHTML;

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

let currentBillTotal = 0;
let previousBalance = 0;
currentLedgerData.sort((a, b) => a.rawDate.seconds - b.rawDate.seconds);
let lastAdvanceIndex = -1;

currentLedgerData.forEach((item, index) => {
  if (item.type === "advance") {
    lastAdvanceIndex = index;
  }
});

// Calculate previous balance (debt positive, advance negative)
currentLedgerData.slice(0, lastAdvanceIndex + 1).forEach((item) => {
  if (item.type === "credit") previousBalance += item.amount;
  if (item.type === "advance") previousBalance -= item.amount;
});

currentLedgerData
  .slice(lastAdvanceIndex + 1)
  .forEach((item) => {

  if (item.type === "credit") {

    currentBillTotal += item.amount;

    const rate = item.amount / item.qty;

    doc.text(item.date, 12, y);
    doc.text(item.product.substring(0, 25), 40, y);
    doc.text(String(item.qty), 120, y);
    doc.text("Rs " + rate.toFixed(2), 140, y);
    doc.text("Rs " + item.amount.toFixed(2), 165, y);

    y += 8;
  }

});

const netBalance = previousBalance + currentBillTotal;

  y += 10;

  // 🔷 TRANSPARENT TOTAL SECTION
  doc.line(110, y - 5, 195, y - 5);

doc.setFontSize(11);

doc.text("Current Bill:", 120, y);
doc.text("Rs " + currentBillTotal.toFixed(2), 165, y);

y += 8;

if (previousBalance > 0) {
  doc.text("Previous Debt:", 120, y);
  doc.text("Rs " + previousBalance.toFixed(2), 165, y);
  y += 8;
} else if (previousBalance < 0) {
  doc.text("Advance Balance Used:", 120, y);
  doc.text("Rs -" + Math.abs(previousBalance).toFixed(2), 165, y);
  y += 8;
}

doc.line(120, y - 2, 195, y - 2);

y += 8;

doc.setFontSize(13);

if (netBalance > 0) {
  doc.text("Net Outstanding:", 120, y);
  doc.text("Rs " + netBalance.toFixed(2), 165, y);
} else if (netBalance < 0) {
  doc.text("Advance Balance:", 120, y);
  doc.text("Rs " + Math.abs(netBalance).toFixed(2), 165, y);
} else {
  doc.text("Status:", 120, y);
  doc.text("Fully Settled", 165, y);
}
  y += 20;

  // 🔷 FOOTER
  doc.setFillColor(43, 104, 126);
  doc.rect(0, 280, 210, 15, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("Thank you for your business!", 70, 290);

  doc.save(currentCustomerName + "_Invoice.pdf");
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