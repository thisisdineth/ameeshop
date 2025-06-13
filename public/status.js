// Firebase Imports
// FIX: Added 'set' to the import list to fix the saving error.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

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

// --- Global State ---
let isDirty = false; // Flag to track unsaved changes

// --- Database References ---
const purchasesRef = ref(db, 'custom_metadata/purchases');
const paymentsRef = ref(db, 'custom_metadata/payments');


// --- Dirty State Management ---
function setDirtyState(dirty) {
    isDirty = dirty;
    if (isDirty) {
        saveAllBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        saveAllBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        saveAllBtn.innerHTML = 'Save to Firebase*';
    } else {
        saveAllBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        saveAllBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
        saveAllBtn.innerHTML = 'Save to Firebase';
    }
}

// --- Generic Table Functions ---

function createGenericRow(fields) {
    const row = document.createElement('tr');
    row.dataset.id = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    fields.forEach(field => {
        const cell = document.createElement('td');
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
    
    // Add Delete Button
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell text-center';
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt text-red-500 hover:text-red-700"></i>';
    deleteBtn.title = "Delete row";
    deleteBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this row? This will be permanent after you save.')) {
            row.remove();
            setDirtyState(true);
        }
    };
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);

    return row;
}

function exportToCSV(filename, headers, tableBody) {
    let csvContent = "data:text/csv;charset=utf-8," + headers.map(h => `"${h}"`).join(',') + "\r\n";
    tableBody.querySelectorAll('tr').forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td:not(.actions-cell)')).map(cell => {
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
    row.dataset.id = `row_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    // Add Delete Button
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell text-center';
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt text-red-500 hover:text-red-700"></i>';
    deleteBtn.title = "Delete row";
    deleteBtn.onclick = () => {
         if (confirm('Are you sure you want to delete this row? This will be permanent after you save.')) {
            row.remove();
            calculatePurchases();
            setDirtyState(true);
        }
    };
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);
    return row;
}

function calculatePurchases() {
    const rows = Array.from(purchasesTableBody.querySelectorAll('tr'));
    let totalValueForDate = 0;
    let lastDate = null;

    rows.forEach((row, index) => {
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
        row.querySelectorAll('[data-field]').forEach(element => {
            const field = element.dataset.field;
            data[rowId][field] = element.tagName === 'INPUT' ? element.value : element.textContent;
        });
    });
    return set(ref(db, 'custom_metadata/purchases'), data);
}

function loadPurchasesData(data) {
    purchasesTableBody.innerHTML = '';
    if (data) {
        Object.keys(data).sort((a,b) => a.localeCompare(b)).forEach(rowId => {
            const rowData = data[rowId];
            const row = createPurchaseRow();
            row.dataset.id = rowId;
            Object.keys(rowData).forEach(field => {
                const element = row.querySelector(`[data-field="${field}"]`);
                if (element) {
                    if (element.tagName === 'INPUT') {
                        element.value = rowData[field];
                    } else {
                        element.textContent = rowData[field];
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
        row.querySelectorAll('[data-field]').forEach(element => {
            const field = element.dataset.field;
            data.cheque[rowId][field] = element.tagName === 'INPUT' ? element.value : element.textContent;
        });
    });
    cashOutTableBody.querySelectorAll('tr').forEach(row => {
        const rowId = row.dataset.id;
        data.cashOut[rowId] = {};
        row.querySelectorAll('[data-field]').forEach(element => {
            const field = element.dataset.field;
            data.cashOut[rowId][field] = element.tagName === 'INPUT' ? element.value : element.textContent;
        });
    });
    return set(ref(db, 'custom_metadata/payments'), data);
}

function loadPaymentsData(data) {
    chequeTableBody.innerHTML = '';
    cashOutTableBody.innerHTML = '';
    
    const chequeFields = ['chequeDate', 'customer', 'bank', 'amount', 'depositedDate', 'depositedAcc', 'note'];
    const cashOutFields = ['date', 'reason', 'amount', 'note'];

    if (data) {
        if (data.cheque) {
            Object.keys(data.cheque).sort((a,b) => a.localeCompare(b)).forEach(rowId => {
                const rowData = data.cheque[rowId];
                const row = createGenericRow(chequeFields);
                row.dataset.id = rowId;
                Object.keys(rowData).forEach(field => {
                    const element = row.querySelector(`[data-field="${field}"]`);
                    if (element) {
                        if (element.tagName === 'INPUT') {
                            element.value = rowData[field];
                        } else {
                            element.textContent = rowData[field];
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
                    const element = row.querySelector(`[data-field="${field}"]`);
                    if (element) {
                         if (element.tagName === 'INPUT') {
                            element.value = rowData[field];
                        } else {
                            element.textContent = rowData[field];
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
    purchasesTableBody.prepend(createPurchaseRow());
    setDirtyState(true);
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
    setDirtyState(true);
});


exportPurchasesBtn.addEventListener('click', () => {
    const headers = ["Date", "Estate", "Grade", "Bag weight", "Bags", "Total weight", "Auction Price", "Unit Price", "Value", "Total Value", "Paid mode", "Paid amount", "Payable Balance"];
    exportToCSV('purchases_log.csv', headers, purchasesTableBody);
});

addPaymentRowBtn.addEventListener('click', () => {
    chequeTableBody.prepend(createGenericRow(['chequeDate', 'customer', 'bank', 'amount', 'depositedDate', 'depositedAcc', 'note']));
    cashOutTableBody.prepend(createGenericRow(['date', 'reason', 'amount', 'note']));
    setDirtyState(true);
});

exportPaymentsBtn.addEventListener('click', () => {
    const chequeHeaders = ["Cheque date", "Customer", "Bank", "Amount", "Deposited date", "Deposited acc", "Note"];
    exportToCSV('cheque_details.csv', chequeHeaders, chequeTableBody);

    const cashOutHeaders = ["Date", "Reason", "Amount", "Note"];
    exportToCSV('cash_out.csv', cashOutHeaders, cashOutTableBody);
});


purchasesTableBody.addEventListener('input', () => {
    calculatePurchases();
    setDirtyState(true);
});
chequeTableBody.addEventListener('input', () => setDirtyState(true));
cashOutTableBody.addEventListener('input', () => setDirtyState(true));


saveAllBtn.addEventListener('click', () => {
    Promise.all([savePurchasesData(), savePaymentsData()])
        .then(() => {
            statusMessage.textContent = 'Saved to Firebase!';
            statusMessage.style.color = 'green';
            setDirtyState(false); // Reset dirty flag on successful save
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

window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    // Standard way to trigger the browser's confirmation dialog.
    e.preventDefault();
    // Required for some older browsers.
    e.returnValue = '';
  }
});


// --- Initial Load from Firebase ---
onValue(purchasesRef, (snapshot) => {
    loadPurchasesData(snapshot.val());
}, { once: true });

onValue(paymentsRef, (snapshot) => {
    loadPaymentsData(snapshot.val());
}, { once: true });
