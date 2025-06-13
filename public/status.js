// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- Firebase Configuration ---
// IMPORTANT: This uses the config you previously provided.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- DOM Elements ---
const purchasesTableBody = document.getElementById('purchases-table-body');
const chequeTableBody = document.getElementById('cheque-table-body');
const cashOutTableBody = document.getElementById('cash-out-table-body');

const addPurchaseRowBtn = document.getElementById('addPurchaseRowBtn');
const sortPurchasesBtn = document.getElementById('sortPurchasesBtn');
const exportPurchasesBtn = document.getElementById('exportPurchasesBtn');
const addPaymentRowBtn = document.getElementById('addPaymentRowBtn');
const exportPaymentsBtn = document.getElementById('exportPaymentsBtn');
const saveAllBtn = document.getElementById('saveAllBtn');
const statusMessage = document.getElementById('statusMessage');


// --- Database References ---
const purchasesRef = ref(db, 'custom_metadata/purchases');
const paymentsRef = ref(db, 'custom_metadata/payments');

// --- Generic Table Functions ---

function createGenericRow(fields) {
    const row = document.createElement('tr');
    // FIX: Generate a Firebase-safe random ID
    row.dataset.id = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    fields.forEach(field => {
        const cell = document.createElement('td');
        // CHANGE: Check if field is a date field
        if (field.toLowerCase().includes('date')) {
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'w-full bg-transparent p-1';
            input.dataset.field = field;
            cell.appendChild(input);
        } else {
            cell.contentEditable = true;
            cell.dataset.field = field;
            if (field.toLowerCase().includes('amount') || field.toLowerCase().includes('price')) {
                cell.align = 'right';
            }
        }
        row.appendChild(cell);
    });
    return row;
}

function exportToCSV(filename, headers, tableBody) {
    let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h}"`).join(',') + "\r\n";
    tableBody.querySelectorAll('tr').forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td')).map(cell => {
             const input = cell.querySelector('input');
             const content = input ? input.value : cell.textContent;
            return `"${content.replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += rowData + "\r\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Purchases Table Logic ---

function createPurchaseRow() {
    const row = document.createElement('tr');
    // FIX: Generate a Firebase-safe random ID
    row.dataset.id = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    // CHANGE: Removed the "month" column
    row.innerHTML = `
        <td><input type="date" class="w-full bg-transparent p-1" data-field="date"></td>
        <td contenteditable="true" data-field="estate"></td>
        <td contenteditable="true" data-field="grade"></td>
        <td contenteditable="true" data-field="bagWeight" align="right"></td>
        <td contenteditable="true" data-field="bags" align="right"></td>
        <td class="calculated" data-field="totalWeight" align="right">0.00</td>
        <td contenteditable="true" data-field="auctionPrice" align="right"></td>
        <td contenteditable="true" data-field="unitPrice" align="right"></td>
        <td class="calculated" data-field="value" align="right">0.00</td>
        <td class="calculated" data-field="totalValue" align="right">0.00</td>
        <td contenteditable="true" data-field="paidMode"></td>
        <td contenteditable="true" data-field="paidAmount" align="right"></td>
        <td class="calculated" data-field="payableBalance" align="right">0.00</td>
    `;
    return row;
}

function calculatePurchases() {
    const rows = Array.from(purchasesTableBody.querySelectorAll('tr'));
    let totalValueForDate = 0;
    let lastDate = null;

    rows.forEach((row, index) => {
        // CHANGE: Get date from input value
        const currentDate = row.querySelector('[data-field="date"]').value.trim();
        if (lastDate !== null && currentDate !== lastDate && lastDate !== '') {
            const prevRow = rows[index-1];
            prevRow.querySelector('[data-field="totalValue"]').textContent = totalValueForDate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            const paidAmount = parseFloat(prevRow.querySelector('[data-field="paidAmount"]').textContent.replace(/,/g, '')) || 0;
            const payableBalance = totalValueForDate - paidAmount;
            prevRow.querySelector('[data-field="payableBalance"]').textContent = payableBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            totalValueForDate = 0;
        }

        const bagWeight = parseFloat(row.querySelector('[data-field="bagWeight"]').textContent) || 0;
        const bags = parseInt(row.querySelector('[data-field="bags"]').textContent) || 0;
        const unitPrice = parseFloat(row.querySelector('[data-field="unitPrice"]').textContent) || 0;
        
        const totalWeight = bagWeight * bags;
        const value = totalWeight * unitPrice;
        totalValueForDate += value;

        row.querySelector('[data-field="totalWeight"]').textContent = totalWeight.toFixed(2);
        row.querySelector('[data-field="value"]').textContent = value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        row.querySelector('[data-field="totalValue"]').textContent = '';
        row.querySelector('[data-field="payableBalance"]').textContent = '';

        lastDate = currentDate || lastDate;
    });
    
    if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        lastRow.querySelector('[data-field="totalValue"]').textContent = totalValueForDate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const paidAmount = parseFloat(lastRow.querySelector('[data-field="paidAmount"]').textContent.replace(/,/g, '')) || 0;
        const payableBalance = totalValueForDate - paidAmount;
        lastRow.querySelector('[data-field="payableBalance"]').textContent = payableBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}

function savePurchasesData() {
    const data = {};
    purchasesTableBody.querySelectorAll('tr').forEach(row => {
        const rowId = row.dataset.id;
        data[rowId] = {};
        // CHANGE: Query all fields, not just contenteditable
        row.querySelectorAll('[data-field]').forEach(cell => {
            const field = cell.dataset.field;
            // Handle both inputs and contenteditable tds
            const isInput = cell.tagName === 'INPUT' || cell.querySelector('input');
            data[rowId][field] = isInput ? (cell.value || cell.querySelector('input').value) : cell.textContent;
        });
    });
    return update(purchasesRef, data);
}

function loadPurchasesData(data) {
    purchasesTableBody.innerHTML = '';
    if (data) {
        // FIX: Sort by the key (which is timestamp based) to maintain order
        Object.keys(data).sort((a,b) => a.localeCompare(b)).forEach(rowId => {
            const rowData = data[rowId];
            const row = createPurchaseRow();
            row.dataset.id = rowId;
            Object.keys(rowData).forEach(field => {
                const cell = row.querySelector(`[data-field="${field}"]`);
                if (cell) {
                    // Handle both inputs and contenteditable tds
                    if (cell.tagName === 'INPUT') {
                        cell.value = rowData[field];
                    } else {
                        cell.textContent = rowData[field];
                    }
                }
            });
            purchasesTableBody.appendChild(row);
        });
    }
    if (purchasesTableBody.children.length === 0) {
        purchasesTableBody.appendChild(createPurchaseRow());
    }
    calculatePurchases();
}

// --- Payments Table Logic (Cheque & Cash Out) ---

function savePaymentsData() {
    const data = { cheque: {}, cashOut: {} };
    chequeTableBody.querySelectorAll('tr').forEach(row => {
        const rowId = row.dataset.id;
        data.cheque[rowId] = {};
        row.querySelectorAll('[data-field]').forEach(cell => {
            const field = cell.dataset.field;
            const isInput = cell.tagName === 'INPUT' || cell.querySelector('input');
            data.cheque[rowId][field] = isInput ? (cell.value || cell.querySelector('input').value) : cell.textContent;
        });
    });
    cashOutTableBody.querySelectorAll('tr').forEach(row => {
        const rowId = row.dataset.id;
        data.cashOut[rowId] = {};
        row.querySelectorAll('[data-field]').forEach(cell => {
            const field = cell.dataset.field;
             const isInput = cell.tagName === 'INPUT' || cell.querySelector('input');
            data.cashOut[rowId][field] = isInput ? (cell.value || cell.querySelector('input').value) : cell.textContent;
        });
    });
    return update(paymentsRef, data);
}

function loadPaymentsData(data) {
    chequeTableBody.innerHTML = '';
    cashOutTableBody.innerHTML = '';
    
    const dateFields = ['chequeDate', 'depositedDate', 'date'];
    const chequeFields = ['chequeDate', 'customer', 'bank', 'amount', 'depositedDate', 'depositedAcc', 'note'];
    const cashOutFields = ['date', 'reason', 'amount', 'note'];

    if (data) {
        if (data.cheque) {
            Object.keys(data.cheque).sort((a,b) => a.localeCompare(b)).forEach(rowId => {
                const rowData = data.cheque[rowId];
                const row = createGenericRow(chequeFields);
                row.dataset.id = rowId;
                Object.keys(rowData).forEach(field => {
                    const cellElement = row.querySelector(`[data-field="${field}"]`);
                    if (cellElement) {
                        const isInput = cellElement.tagName === 'INPUT' || cellElement.querySelector('input');
                        if (isInput) {
                            (cellElement.value || cellElement.querySelector('input')).value = rowData[field];
                        } else {
                            cellElement.textContent = rowData[field];
                        }
                    }
                });
                chequeTableBody.appendChild(row);
            });
        }
        if (data.cashOut) {
             Object.keys(data.cashOut).sort((a,b) => a.localeCompare(b)).forEach(rowId => {
                const rowData = data.cashOut[rowId];
                const row = createGenericRow(cashOutFields);
                row.dataset.id = rowId;
                Object.keys(rowData).forEach(field => {
                    const cellElement = row.querySelector(`[data-field="${field}"]`);
                    if (cellElement) {
                         const isInput = cellElement.tagName === 'INPUT' || cellElement.querySelector('input');
                         if (isInput) {
                            (cellElement.value || cellElement.querySelector('input')).value = rowData[field];
                        } else {
                            cellElement.textContent = rowData[field];
                        }
                    }
                });
                cashOutTableBody.appendChild(row);
            });
        }
    }
    if (chequeTableBody.children.length === 0) {
        chequeTableBody.appendChild(createGenericRow(chequeFields));
    }
     if (cashOutTableBody.children.length === 0) {
        cashOutTableBody.appendChild(createGenericRow(cashOutFields));
    }
}


// --- Event Listeners ---
addPurchaseRowBtn.addEventListener('click', () => {
    // CHANGE: Add new row to the top using prepend
    purchasesTableBody.prepend(createPurchaseRow());
});

sortPurchasesBtn.addEventListener('click', () => {
    const rows = Array.from(purchasesTableBody.children);
    const groups = [];
    let currentGroup = [];

    rows.forEach(row => {
        currentGroup.push(row);
        const date = row.querySelector('[data-field="date"]').value.trim();
        const totalValue = row.querySelector('[data-field="totalValue"]').textContent.trim();
        if (date !== '' && totalValue !== '') {
            groups.push(currentGroup);
            currentGroup = [];
        }
    });
    if(currentGroup.length > 0) groups.push(currentGroup);

    groups.sort((a, b) => {
        const dateA_text = a[0].querySelector('[data-field="date"]').value.trim();
        const dateB_text = b[0].querySelector('[data-field="date"]').value.trim();
        if (!dateA_text) return 1;
        if (!dateB_text) return -1;
        return new Date(dateA_text) - new Date(dateB_text);
    });

    purchasesTableBody.innerHTML = '';
    groups.forEach(group => {
        group.forEach(row => purchasesTableBody.appendChild(row));
    });

    calculatePurchases();
});


exportPurchasesBtn.addEventListener('click', () => {
    // CHANGE: Removed "Month" from headers
    const headers = ["Date", "Estate", "Grade", "Bag weight", "Bags", "Total weight", "Auction Price", "Unit Price", "Value", "Total Value", "Paid mode", "Paid amount", "Payable Balance"];
    exportToCSV('purchases_log.csv', headers, purchasesTableBody);
});

addPaymentRowBtn.addEventListener('click', () => {
    chequeTableBody.prepend(createGenericRow(['chequeDate', 'customer', 'bank', 'amount', 'depositedDate', 'depositedAcc', 'note']));
    cashOutTableBody.prepend(createGenericRow(['date', 'reason', 'amount', 'note']));
});

exportPaymentsBtn.addEventListener('click', () => {
    const chequeHeaders = ["Cheque date", "Customer", "Bank", "Amount", "Deposited date", "Deposited acc", "Note"];
    exportToCSV('cheque_details.csv', chequeHeaders, chequeTableBody);

    const cashOutHeaders = ["Date", "Reason", "Amount", "Note"];
    exportToCSV('cash_out.csv', cashOutHeaders, cashOutTableBody);
});


purchasesTableBody.addEventListener('input', calculatePurchases);

saveAllBtn.addEventListener('click', () => {
    Promise.all([savePurchasesData(), savePaymentsData()])
        .then(() => {
            statusMessage.textContent = 'Saved to Firebase!';
            statusMessage.style.color = 'green';
            setTimeout(() => { statusMessage.textContent = '' }, 3000);
        })
        .catch(err => {
            statusMessage.textContent = 'Error saving. See console.';
            statusMessage.style.color = 'red';
            console.error(err);
             setTimeout(() => { 
                statusMessage.textContent = '';
                statusMessage.style.color = '';
            }, 3000);
        });
});


// --- Initial Load from Firebase ---
onValue(purchasesRef, (snapshot) => {
    loadPurchasesData(snapshot.val());
}, { once: true });

onValue(paymentsRef, (snapshot) => {
    loadPaymentsData(snapshot.val());
}, { once: true });
