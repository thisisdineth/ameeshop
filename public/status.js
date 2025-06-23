import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get, off } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
    authDomain: "ecommerceapp-dab53.firebaseapp.com",
    databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ecommerceapp-dab53",
    storageBucket: "ecommerceapp-dab53.appspot.com",
    messagingSenderId: "429988301014",
    appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- DOM Elements ---
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
const adminUnlockContainer = document.getElementById('admin-unlock-container');
const unlockAdminBtn = document.getElementById('unlockAdminBtn');
const adminPasswordInput = document.getElementById('adminPassword');

// Purchases Elements (Dynamic)
const purchasesTab = document.getElementById('purchases-tab');
const purchaseTableNameInput = document.getElementById('purchaseTableName');
const purchaseSuggestionsContainer = document.getElementById('purchaseSuggestionsContainer');
const loadPurchaseTableBtn = document.getElementById('loadPurchaseTableBtn');
const purchasesContentWrapper = document.getElementById('purchases-content-wrapper');
const currentPurchaseTableInfo = document.getElementById('current-purchase-table-info');
const showAddPurchaseFormBtn = document.getElementById('showAddPurchaseFormBtn');
const addPurchaseFormContainer = document.getElementById('addPurchaseFormContainer');
const addPurchaseForm = document.getElementById('addPurchaseForm');
const purchaseFormTitle = document.getElementById('purchaseFormTitle');
const purchaseFormSubmitBtn = document.getElementById('purchaseFormSubmitBtn');
const purchasesTableBody = document.getElementById('purchasesTableBody');
const exportPurchasesBtn = document.getElementById('exportPurchasesBtn');
const deletePurchaseTableBtn = document.getElementById('deletePurchaseTableBtn'); // <-- NEW ELEMENT

// Cheques Elements (Simple/Fixed)
const chequesTab = document.getElementById('cheques-tab');
const showAddChequeFormBtn = document.getElementById('showAddChequeFormBtn');
const addChequeFormContainer = document.getElementById('addChequeFormContainer');
const addChequeForm = document.getElementById('addChequeForm');
const chequeFormTitle = document.getElementById('chequeFormTitle');
const chequeFormSubmitBtn = document.getElementById('chequeFormSubmitBtn');
const chequeTableBody = document.getElementById('chequeTableBody');
const exportChequesBtn = document.getElementById('exportChequesBtn');

// Cash Log Elements (Simple/Fixed)
const showAddCashFormBtn = document.getElementById('showAddCashFormBtn');
const addCashFormContainer = document.getElementById('addCashFormContainer');
const addCashForm = document.getElementById('addCashForm');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashFormSubmitBtn = document.getElementById('cashFormSubmitBtn');
const cashOutTableBody = document.getElementById('cashOutTableBody');
const exportCashBtn = document.getElementById('exportCashBtn');

// --- Global State for Purchases only ---
let activePurchasesRef = null;
let activePurchaseTableName = null;
let purchaseTableListener = null;
let purchaseTableNames = [];

// --- Database References ---
const chequesRef = ref(db, 'financials/cheques'); // Fixed path for cheques
const cashLogRef = ref(db, 'financials/cashLog'); // Fixed path for cash

// --- Admin Unlock ---
unlockAdminBtn.addEventListener('click', () => {
    if (adminPasswordInput.value === 'Ameelocal@2000') {
        adminUnlockContainer.classList.add('hidden');
        purchasesTab.classList.remove('locked-section');
        chequesTab.classList.remove('locked-section');
    } else {
        alert('Incorrect Password!');
    }
});

// --- Tab Management ---
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.add('hidden'));
        button.classList.add('active');
        const selectedTabId = `${button.dataset.tab}-tab`;
        document.getElementById(selectedTabId).classList.remove('hidden');

        const selectedTab = button.dataset.tab;
        const isUnlocked = !purchasesTab.classList.contains('locked-section');

        if (selectedTab === 'cash') {
            adminUnlockContainer.classList.add('hidden');
        } else {
            if (!isUnlocked) {
                adminUnlockContainer.classList.remove('hidden');
            }
        }
    });
});

// --- Generic Form Management ---
function resetForm(form, titleElement, submitBtn, defaultTitle) {
    form.reset();
    form.querySelector('input[type="hidden"]').value = '';
    titleElement.textContent = defaultTitle;
    submitBtn.innerHTML = `<i class="fas fa-check fa-fw"></i> Save Record`;
}

function toggleForm(formContainer, button, defaultText, resetOptions) {
    const isHidden = formContainer.classList.contains('hidden');
    if (isHidden) {
        formContainer.classList.remove('hidden');
        button.innerHTML = `<i class="fas fa-times fa-fw"></i> Cancel`;
        button.classList.replace('btn-primary', 'btn-warning');
    } else {
        formContainer.classList.add('hidden');
        button.innerHTML = `<i class="fas fa-plus fa-fw"></i> ${defaultText}`;
        button.classList.replace('btn-warning', 'btn-primary');
        if (resetOptions) {
            resetForm(resetOptions.form, resetOptions.titleElement, resetOptions.submitBtn, resetOptions.defaultTitle);
        }
    }
}

showAddPurchaseFormBtn.addEventListener('click', () => toggleForm(addPurchaseFormContainer, showAddPurchaseFormBtn, 'Add Purchase/Payment', { form: addPurchaseForm, titleElement: purchaseFormTitle, submitBtn: purchaseFormSubmitBtn, defaultTitle: 'Add New Purchase Record' }));
showAddChequeFormBtn.addEventListener('click', () => toggleForm(addChequeFormContainer, showAddChequeFormBtn, 'Add Cheque Details', { form: addChequeForm, titleElement: chequeFormTitle, submitBtn: chequeFormSubmitBtn, defaultTitle: 'Add New Cheque Record' }));
showAddCashFormBtn.addEventListener('click', () => toggleForm(addCashFormContainer, showAddCashFormBtn, 'Add Cash Out Entry', { form: addCashForm, titleElement: cashFormTitle, submitBtn: cashFormSubmitBtn, defaultTitle: 'Add New Cash Out Record' }));


// --- Custom Autocomplete for Purchases only ---
function showSuggestions(inputValue, availableNames, containerElement, inputElement) {
    containerElement.innerHTML = '';
    if (!inputValue && document.activeElement !== inputElement) {
        containerElement.style.display = 'none';
        return;
    }
    const filteredNames = availableNames.filter(name => name.toLowerCase().includes(inputValue.toLowerCase()));
    if (filteredNames.length > 0) {
        filteredNames.forEach(name => {
            const item = document.createElement('div');
            item.classList.add('suggestion-item');
            item.textContent = name;
            item.addEventListener('click', () => {
                inputElement.value = name;
                containerElement.style.display = 'none';
            });
            containerElement.appendChild(item);
        });
        containerElement.style.display = 'block';
    } else {
        containerElement.style.display = 'none';
    }
}

purchaseTableNameInput.addEventListener('focus', () => showSuggestions(purchaseTableNameInput.value, purchaseTableNames, purchaseSuggestionsContainer, purchaseTableNameInput));
purchaseTableNameInput.addEventListener('input', () => showSuggestions(purchaseTableNameInput.value, purchaseTableNames, purchaseSuggestionsContainer, purchaseTableNameInput));

document.addEventListener('click', (e) => {
    if (!e.target.closest('.suggestions-wrapper')) {
        purchaseSuggestionsContainer.style.display = 'none';
    }
});


// --- Table Name Suggestions Data Loading for Purchases only ---
function loadTableSuggestions(type) {
    const tableNamesTypeRef = ref(db, `financials/tableNames/${type}`);
    onValue(tableNamesTypeRef, (snapshot) => {
        const names = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (type === 'purchases') {
            purchaseTableNames = names;
        }
    });
}
loadTableSuggestions('purchases');


// --- Core Table Loading and Creation Logic for Purchases only ---
async function loadOrCreateTable(type) {
    if (type !== 'purchases') return false; 

    const tableName = purchaseTableNameInput.value.trim();
    if (!tableName) {
        alert('Please enter or select a table name.');
        return false;
    }

    const tableNamesListRef = ref(db, `financials/tableNames/purchases`);
    const snapshot = await get(tableNamesListRef);
    const existingNames = snapshot.val() ? Object.values(snapshot.val()) : [];
    if (!existingNames.includes(tableName)) {
        push(tableNamesListRef, tableName);
    }

    if (purchaseTableListener && activePurchasesRef) {
        off(activePurchasesRef, 'value', purchaseTableListener);
    }
    
    activePurchasesRef = ref(db, `financials/tables/purchases/${tableName}`);
    activePurchaseTableName = tableName;
    purchaseTableListener = onValue(activePurchasesRef, renderPurchasesTable);

    currentPurchaseTableInfo.innerHTML = `Currently managing: <span class="table-name">${tableName}</span>`;
    purchasesContentWrapper.classList.remove('hidden');
    purchaseSuggestionsContainer.style.display = 'none';

    return true;
}

loadPurchaseTableBtn.addEventListener('click', () => loadOrCreateTable('purchases'));

// --- [NEW] Delete Table Logic for Purchases ---
deletePurchaseTableBtn.addEventListener('click', async () => {
    if (!activePurchaseTableName || !activePurchasesRef) {
        alert('No active table selected to delete.');
        return;
    }

    const confirmation = confirm(`Are you sure you want to permanently delete the table '${activePurchaseTableName}' and all its data? This action cannot be undone.`);

    if (confirmation) {
        try {
            // 1. Remove the table data
            await remove(activePurchasesRef);

            // 2. Find and remove the table name from the list
            const tableNamesListRef = ref(db, 'financials/tableNames/purchases');
            const snapshot = await get(tableNamesListRef);
            const tableNamesData = snapshot.val();
            if (tableNamesData) {
                const keyToDelete = Object.keys(tableNamesData).find(key => tableNamesData[key] === activePurchaseTableName);
                if (keyToDelete) {
                    await remove(ref(db, `financials/tableNames/purchases/${keyToDelete}`));
                }
            }

            // 3. Reset the UI
            alert(`Table '${activePurchaseTableName}' has been deleted successfully.`);
            
            // Detach listener
             if (purchaseTableListener && activePurchasesRef) {
                off(activePurchasesRef, 'value', purchaseTableListener);
            }
            
            // Hide table content and clear inputs/state
            purchasesContentWrapper.classList.add('hidden');
            purchaseTableNameInput.value = '';
            currentPurchaseTableInfo.innerHTML = '';
            purchasesTableBody.innerHTML = '';
            
            // Reset state variables
            activePurchasesRef = null;
            activePurchaseTableName = null;
            purchaseTableListener = null;

            // Refresh the suggestions list
            loadTableSuggestions('purchases');

        } catch (error) {
            console.error("Error deleting table: ", error);
            alert('Failed to delete the table. See console for details.');
        }
    }
});


// --- Form Submission Logic ---
addPurchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tableName = purchaseTableNameInput.value.trim();
    if (tableName !== activePurchaseTableName) {
        const success = await loadOrCreateTable('purchases');
        if (!success) return;
    }
    if (!activePurchasesRef) {
        alert('A table must be loaded before saving data.');
        return;
    }
    const editId = document.getElementById('purchaseEditId').value;
    const formData = {
        date: document.getElementById('purchaseDate').value, estate: document.getElementById('purchaseEstate').value, grade: document.getElementById('purchaseGrade').value,
        bagWeight: parseFloat(document.getElementById('purchaseBagWeight').value) || 0, bags: parseInt(document.getElementById('purchaseBags').value) || 0,
        auctionPrice: parseFloat(document.getElementById('purchaseAuctionPrice').value) || 0, unitPrice: parseFloat(document.getElementById('purchaseUnitPrice').value) || 0,
        paidMode: document.getElementById('purchasePaidMode').value, paidAmount: parseFloat(document.getElementById('purchasePaidAmount').value) || 0,
    };
    const dbRef = editId ? ref(db, `${activePurchasesRef.path}/${editId}`) : push(activePurchasesRef);
    set(dbRef, formData)
        .then(() => { toggleForm(addPurchaseFormContainer, showAddPurchaseFormBtn, 'Add Purchase/Payment', { form: addPurchaseForm, titleElement: purchaseFormTitle, submitBtn: purchaseFormSubmitBtn, defaultTitle: 'Add New Purchase Record' }); })
        .catch(error => console.error("Error saving purchase: ", error));
});

// Simple submit for Cheques
addChequeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('chequeEditId').value;
    const formData = {
        chequeDate: document.getElementById('chequeDate').value, amount: parseFloat(document.getElementById('chequeAmount').value) || 0, customer: document.getElementById('chequeCustomer').value,
        bank: document.getElementById('chequeBank').value, depositedDate: document.getElementById('chequeDepositedDate').value, depositedAcc: document.getElementById('chequeDepositedAcc').value, note: document.getElementById('chequeNote').value,
    };
    const dbRef = editId ? ref(db, `financials/cheques/${editId}`) : push(chequesRef);
    set(dbRef, formData)
        .then(() => { toggleForm(addChequeFormContainer, showAddChequeFormBtn, 'Add Cheque Details', { form: addChequeForm, titleElement: chequeFormTitle, submitBtn: chequeFormSubmitBtn, defaultTitle: 'Add New Cheque Record' }); })
        .catch(error => console.error("Error saving cheque: ", error));
});

// Simple submit for Cash
addCashForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('cashEditId').value;
    const formData = { date: document.getElementById('cashDate').value, reason: document.getElementById('cashReason').value, amount: parseFloat(document.getElementById('cashAmount').value) || 0, note: document.getElementById('cashNote').value, };
    const dbRef = editId ? ref(db, `financials/cashLog/${id}`) : push(cashLogRef);
    set(dbRef, formData)
        .then(() => { toggleForm(addCashFormContainer, showAddCashFormBtn, 'Add Cash Out Entry', { form: addCashForm, titleElement: cashFormTitle, submitBtn: cashFormSubmitBtn, defaultTitle: 'Add New Cash Out Record' }); })
        .catch(error => console.error("Error saving cash log: ", error));
});


// --- Data Loading & Table Rendering ---
function renderPurchasesTable(snapshot) {
    purchasesTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
        purchasesTableBody.innerHTML = `<tr><td colspan="15" class="text-center text-muted">No purchase records found in this table. Add a record to get started.</td></tr>`;
        return;
    }
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    records.sort((a, b) => new Date(a.date) - new Date(b.date));
    const groupedByDate = records.reduce((acc, record) => {
        const date = record.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(record);
        return acc;
    }, {});
    const dateGroups = Object.values(groupedByDate);
    dateGroups.reverse();
    let lastMonth = null;
    dateGroups.forEach(group => {
        const groupRowCount = group.length;
        let groupTotalValue = 0;
        group.forEach(r => {
            const totalWeight = (r.bagWeight || 0) * (r.bags || 0);
            groupTotalValue += totalWeight * (r.unitPrice || 0);
        });
        const paymentInfo = group[group.length - 1];
        const groupPaidAmount = paymentInfo.paidAmount || 0;
        const groupPayableBalance = groupTotalValue - groupPaidAmount;
        group.forEach((record, index) => {
            const tr = document.createElement('tr');
            const totalWeight = (record.bagWeight || 0) * (record.bags || 0);
            const value = totalWeight * (record.unitPrice || 0);
            const currentMonth = new Date(record.date).toLocaleString('default', { month: 'short' });
            let summaryCells = '';
            if (index === 0) {
                summaryCells = `<td rowspan="${groupRowCount}">${currentMonth !== lastMonth ? currentMonth : ''}</td><td rowspan="${groupRowCount}">${record.date}</td>`;
            }
            let paymentCells = '';
            if (index === 0) {
                paymentCells = `<td class="text-right font-weight-bold" rowspan="${groupRowCount}">${groupTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td rowspan="${groupRowCount}">${paymentInfo.paidMode || ''}</td><td class="text-right font-weight-bold text-danger" rowspan="${groupRowCount}">${groupPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td class="text-right font-weight-bold" rowspan="${groupRowCount}">${groupPayableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>`;
            }
            tr.innerHTML = `${summaryCells}<td>${record.estate || ''}</td><td>${record.grade || ''}</td><td class="text-right">${(record.bagWeight || 0).toFixed(2)}</td><td class="text-right">${record.bags || 0}</td><td class="text-right">${totalWeight.toFixed(2)}</td><td class="text-right">${(record.auctionPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td class="text-right">${(record.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td class="text-right text-success">${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>${paymentCells}<td class="text-center actions"><button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="purchase"><i class="fas fa-pencil-alt"></i></button><button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="purchase"><i class="fas fa-trash-alt"></i></button></td>`;
            purchasesTableBody.appendChild(tr);
            if (index === 0) lastMonth = currentMonth;
        });
    });
}

function renderChequesTable(snapshot) {
    chequeTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) { chequeTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No cheque records found.</td></tr>'; return; }
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    records.sort((a, b) => new Date(b.chequeDate) - new Date(a.chequeDate));
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${record.chequeDate}</td> <td>${record.customer}</td> <td>${record.bank}</td><td class="text-right">${(record.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>${record.depositedDate || 'N/A'}</td> <td>${record.depositedAcc || 'N/A'}</td> <td>${record.note || ''}</td><td class="text-center actions"><button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="cheque"><i class="fas fa-pencil-alt"></i></button><button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="cheque"><i class="fas fa-trash-alt"></i></button></td>`;
        chequeTableBody.appendChild(tr);
    });
}
onValue(chequesRef, renderChequesTable); 

function renderCashTable(snapshot) {
    cashOutTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) { cashOutTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No cash out records.</td></tr>'; return; }
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    records.sort((a,b) => new Date(b.date) - new Date(a.date));
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${record.date}</td> <td>${record.reason}</td><td class="text-right">${(record.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>${record.note || ''}</td><td class="text-center actions"><button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="cash"><i class="fas fa-pencil-alt"></i></button><button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="cash"><i class="fas fa-trash-alt"></i></button></td>`;
        cashOutTableBody.appendChild(tr);
    });
}
onValue(cashLogRef, renderCashTable);


// --- Edit and Delete Functionality ---
document.body.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const id = target.dataset.id;
    const type = target.dataset.type;

    if (target.classList.contains('btn-delete')) {
        if (!id || !type) return;
        if (confirm(`Are you sure you want to delete this ${type} record?`)) {
            let path;
            if (type === 'purchase') {
                if (!activePurchasesRef) { alert('No active purchase table selected.'); return; }
                path = `${activePurchasesRef.path}/${id}`;
            } else if (type === 'cheque') {
                path = `financials/cheques/${id}`;
            } else if (type === 'cash') {
                 path = `financials/cashLog/${id}`; 
            }
            if (path) remove(ref(db, path)).catch(error => console.error(`Error deleting ${type}:`, error));
        }
    }

    if (target.classList.contains('btn-edit')) {
        if (!id || !type) return;
        let path;
        if (type === 'purchase') {
            if (!activePurchasesRef) { alert('No active purchase table selected.'); return; }
            path = `${activePurchasesRef.path}/${id}`;
        } else if (type === 'cheque') {
            path = `financials/cheques/${id}`; 
        } else if (type === 'cash') {
            path = `financials/cashLog/${id}`;
        }
        
        if (!path) return;
        const snapshot = await get(ref(db, path));
        if (!snapshot.exists()) { console.error("Record to edit not found."); return; }
        const data = snapshot.val();

        if (type === 'purchase') {
            document.getElementById('purchaseEditId').value = id;
            document.getElementById('purchaseDate').value = data.date || '';
            document.getElementById('purchaseEstate').value = data.estate || '';
            document.getElementById('purchaseGrade').value = data.grade || '';
            document.getElementById('purchaseBagWeight').value = data.bagWeight || '';
            document.getElementById('purchaseBags').value = data.bags || '';
            document.getElementById('purchaseAuctionPrice').value = data.auctionPrice || '';
            document.getElementById('purchaseUnitPrice').value = data.unitPrice || '';
            document.getElementById('purchasePaidMode').value = data.paidMode || '';
            document.getElementById('purchasePaidAmount').value = data.paidAmount || '';
            purchaseFormTitle.textContent = "Edit Purchase Record";
            purchaseFormSubmitBtn.innerHTML = `<i class="fas fa-save fa-fw"></i> Update Record`;
            if (addPurchaseFormContainer.classList.contains('hidden')) {
                toggleForm(addPurchaseFormContainer, showAddPurchaseFormBtn, 'Add Purchase/Payment');
            }
        } else if (type === 'cheque') {
            document.getElementById('chequeEditId').value = id;
            document.getElementById('chequeDate').value = data.chequeDate || '';
            document.getElementById('chequeAmount').value = data.amount || '';
            document.getElementById('chequeCustomer').value = data.customer || '';
            document.getElementById('chequeBank').value = data.bank || '';
            document.getElementById('chequeDepositedDate').value = data.depositedDate || '';
            document.getElementById('chequeDepositedAcc').value = data.depositedAcc || '';
            document.getElementById('chequeNote').value = data.note || '';
            chequeFormTitle.textContent = "Edit Cheque Record";
            chequeFormSubmitBtn.innerHTML = `<i class="fas fa-save fa-fw"></i> Update Record`;
            if (addChequeFormContainer.classList.contains('hidden')) {
                toggleForm(addChequeFormContainer, showAddChequeFormBtn, 'Add Cheque Details');
            }
        } else if (type === 'cash') {
            document.getElementById('cashEditId').value = id;
            document.getElementById('cashDate').value = data.date || '';
            document.getElementById('cashReason').value = data.reason || '';
            document.getElementById('cashAmount').value = data.amount || '';
            document.getElementById('cashNote').value = data.note || '';
            cashFormTitle.textContent = "Edit Cash Record";
            cashFormSubmitBtn.innerHTML = `<i class="fas fa-save fa-fw"></i> Update Record`;
            if (addCashFormContainer.classList.contains('hidden')) {
                toggleForm(addCashFormContainer, showAddCashFormBtn, 'Add Cash Out Entry');
            }
        }
    }
});

// --- [REVISED] Export to CSV ---
function exportTableToCSV(filename, tableElement) {
    // 1. --- Header Extraction ---
    const headerRows = tableElement.querySelectorAll('thead tr');
    let headers = [];

    if (tableElement.id === 'purchasesTable') {
        headers = [
            "Month", "Date", "Estate", "Grade", "Bag weight", "Bags",
            "Total weight", "Auction Price", "Unit Price", "Value",
            "Total Value", "Paid mode", "Paid amount", "Payable Balance"
        ];
    } else {
        headers = Array.from(headerRows[headerRows.length - 1].querySelectorAll('th'))
                       .map(th => th.textContent.trim())
                       .filter(h => h !== 'Actions');
    }
    const csvHeader = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

    // 2. --- Body Row Processing with rowspan and alignment handling ---
    const csvRows = [];
    const bodyRows = Array.from(tableElement.querySelectorAll('tbody tr'));
    const pendingRowspans = {}; 

    for (const row of bodyRows) {
        if (row.querySelector('td.text-muted')) continue;

        const csvRow = [];
        let cellIndex = 0; 
        
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            if (pendingRowspans[colIndex] && pendingRowspans[colIndex].rowsLeft > 0) {
                csvRow.push(pendingRowspans[colIndex].value);
                pendingRowspans[colIndex].rowsLeft--;
            } else {
                const cell = row.cells[cellIndex];
                if (!cell || cell.closest('.actions')) {
                    continue;
                }

                const value = `"${cell.textContent.trim().replace(/"/g, '""')}"`;
                csvRow.push(value);
                
                const rowspan = cell.getAttribute('rowspan');
                if (rowspan && parseInt(rowspan, 10) > 1) {
                    pendingRowspans[colIndex] = { value: value, rowsLeft: parseInt(rowspan, 10) - 1 };
                }
                cellIndex++;
            }
        }
        csvRows.push(csvRow.join(','));
    }

    // 3. --- Assemble and Trigger Download ---
    const csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\r\n" + csvRows.join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


exportPurchasesBtn.addEventListener('click', () => {
    const tableName = activePurchaseTableName || 'purchases';
    exportTableToCSV(`${tableName}_log.csv`, document.getElementById('purchasesTable'));
});
exportChequesBtn.addEventListener('click', () => {
    exportTableToCSV('cheque_log.csv', document.querySelector('#cheques-tab .data-table'));
});
exportCashBtn.addEventListener('click', () => {
    exportTableToCSV('cash_log.csv', document.querySelector('#cash-tab .data-table'));
});