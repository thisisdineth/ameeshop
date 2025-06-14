// --- Firebase and Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

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
// Purchases Elements
const showAddPurchaseFormBtn = document.getElementById('showAddPurchaseFormBtn');
const addPurchaseFormContainer = document.getElementById('addPurchaseFormContainer');
const addPurchaseForm = document.getElementById('addPurchaseForm');
const purchaseFormTitle = document.getElementById('purchaseFormTitle');
const purchaseFormSubmitBtn = document.getElementById('purchaseFormSubmitBtn');
const purchasesTableBody = document.getElementById('purchasesTableBody');
const exportPurchasesBtn = document.getElementById('exportPurchasesBtn');
// Cheques Elements
const showAddChequeFormBtn = document.getElementById('showAddChequeFormBtn');
const addChequeFormContainer = document.getElementById('addChequeFormContainer');
const addChequeForm = document.getElementById('addChequeForm');
const chequeFormTitle = document.getElementById('chequeFormTitle');
const chequeFormSubmitBtn = document.getElementById('chequeFormSubmitBtn');
const chequeTableBody = document.getElementById('chequeTableBody');
const exportChequesBtn = document.getElementById('exportChequesBtn');
// Cash Log Elements
const showAddCashFormBtn = document.getElementById('showAddCashFormBtn');
const addCashFormContainer = document.getElementById('addCashFormContainer');
const addCashForm = document.getElementById('addCashForm');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashFormSubmitBtn = document.getElementById('cashFormSubmitBtn');
const cashOutTableBody = document.getElementById('cashOutTableBody');
const exportCashBtn = document.getElementById('exportCashBtn');

// --- Database References ---
const purchasesRef = ref(db, 'financials/purchases');
const chequesRef = ref(db, 'financials/cheques');
const cashLogRef = ref(db, 'financials/cashLog');

// --- Tab Management ---
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.add('hidden'));
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}-tab`).classList.remove('hidden');
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

// --- Form Submission Logic ---
const purchaseFormHandler = (e) => {
    e.preventDefault();
    const editId = document.getElementById('purchaseEditId').value;
    const formData = { /* ... form data ... */ };
    // ... logic to set/push to Firebase
};

addPurchaseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('purchaseEditId').value;
    const formData = {
        date: document.getElementById('purchaseDate').value, estate: document.getElementById('purchaseEstate').value, grade: document.getElementById('purchaseGrade').value,
        bagWeight: parseFloat(document.getElementById('purchaseBagWeight').value) || 0, bags: parseInt(document.getElementById('purchaseBags').value) || 0,
        auctionPrice: parseFloat(document.getElementById('purchaseAuctionPrice').value) || 0, unitPrice: parseFloat(document.getElementById('purchaseUnitPrice').value) || 0,
        paidMode: document.getElementById('purchasePaidMode').value, paidAmount: parseFloat(document.getElementById('purchasePaidAmount').value) || 0,
    };
    const dbRef = editId ? ref(db, `financials/purchases/${editId}`) : push(purchasesRef);
    set(dbRef, formData)
        .then(() => { toggleForm(addPurchaseFormContainer, showAddPurchaseFormBtn, 'Add Purchase/Payment', { form: addPurchaseForm, titleElement: purchaseFormTitle, submitBtn: purchaseFormSubmitBtn, defaultTitle: 'Add New Purchase Record' }); })
        .catch(error => console.error("Error saving purchase: ", error));
});
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
addCashForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('cashEditId').value;
    const formData = { date: document.getElementById('cashDate').value, reason: document.getElementById('cashReason').value, amount: parseFloat(document.getElementById('cashAmount').value) || 0, note: document.getElementById('cashNote').value, };
    const dbRef = editId ? ref(db, `financials/cashLog/${editId}`) : push(cashLogRef);
    set(dbRef, formData)
        .then(() => { toggleForm(addCashFormContainer, showAddCashFormBtn, 'Add Cash Out Entry', { form: addCashForm, titleElement: cashFormTitle, submitBtn: cashFormSubmitBtn, defaultTitle: 'Add New Cash Out Record' }); })
        .catch(error => console.error("Error saving cash log: ", error));
});


// --- Data Loading & Table Rendering ---

onValue(purchasesRef, (snapshot) => {
    purchasesTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
        purchasesTableBody.innerHTML = `<tr><td colspan="14" class="text-center text-muted">No purchase records found.</td></tr>`;
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
    dateGroups.reverse(); // Show latest dates first

    let lastMonth = null;
    dateGroups.forEach(group => {
        const groupRowCount = group.length;
        let groupTotalValue = 0;
        group.forEach(r => {
            const totalWeight = (r.bagWeight || 0) * (r.bags || 0);
            groupTotalValue += totalWeight * (r.unitPrice || 0);
        });
        const paymentInfo = group[group.length - 1]; // Payment info is on the last item of the group
        const groupPaidAmount = paymentInfo.paidAmount || 0;
        const groupPayableBalance = groupTotalValue - groupPaidAmount;

        group.forEach((record, index) => {
            const tr = document.createElement('tr');
            const totalWeight = (record.bagWeight || 0) * (record.bags || 0);
            const value = totalWeight * (record.unitPrice || 0);
            const currentMonth = new Date(record.date).toLocaleString('default', { month: 'short' });

            let summaryCells = '';
            if (index === 0) { // Add summary cells with rowspan for the first row of the group
                summaryCells = `
                    <td rowspan="${groupRowCount}">${currentMonth !== lastMonth ? currentMonth : ''}</td>
                    <td rowspan="${groupRowCount}">${record.date}</td>
                `;
            }
            let paymentCells = '';
            if (index === 0) { // Add payment cells with rowspan
                paymentCells = `
                    <td class="text-right font-weight-bold" rowspan="${groupRowCount}">${groupTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td rowspan="${groupRowCount}">${paymentInfo.paidMode || ''}</td>
                    <td class="text-right font-weight-bold text-danger" rowspan="${groupRowCount}">${groupPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td class="text-right font-weight-bold" rowspan="${groupRowCount}">${groupPayableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                `;
            }
            
            tr.innerHTML = `
                ${summaryCells}
                <td>${record.estate || ''}</td>
                <td>${record.grade || ''}</td>
                <td class="text-right">${(record.bagWeight || 0).toFixed(2)}</td>
                <td class="text-right">${record.bags || 0}</td>
                <td class="text-right">${totalWeight.toFixed(2)}</td>
                <td class="text-right">${(record.auctionPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-right">${(record.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="text-right text-success">${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                ${paymentCells}
                <td class="text-center actions">
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="purchase"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="purchase"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            purchasesTableBody.appendChild(tr);
            if (index === 0) lastMonth = currentMonth;
        });
    });
});

onValue(chequesRef, (snapshot) => { /* ... Cheque rendering logic (same as before but with date sort) ... */ 
    chequeTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) { chequeTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No cheque records.</td></tr>'; return; }
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    records.sort((a, b) => new Date(b.chequeDate) - new Date(a.chequeDate));
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.chequeDate}</td> <td>${record.customer}</td> <td>${record.bank}</td>
            <td class="text-right">${(record.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${record.depositedDate || 'N/A'}</td> <td>${record.depositedAcc || 'N/A'}</td> <td>${record.note || ''}</td>
            <td class="text-center actions">
                <button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="cheque"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="cheque"><i class="fas fa-trash-alt"></i></button>
            </td>`;
        chequeTableBody.appendChild(tr);
    });
});

onValue(cashLogRef, (snapshot) => { /* ... Cash log rendering logic (same as before but with date sort) ... */ 
    cashOutTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) { cashOutTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No cash out records.</td></tr>'; return; }
    const records = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    records.sort((a,b) => new Date(b.date) - new Date(a.date));
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.date}</td> <td>${record.reason}</td>
            <td class="text-right">${(record.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${record.note || ''}</td>
            <td class="text-center actions">
                <button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}" data-type="cash"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}" data-type="cash"><i class="fas fa-trash-alt"></i></button>
            </td>`;
        cashOutTableBody.appendChild(tr);
    });
});

// --- Edit and Delete Functionality ---
document.body.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const id = target.dataset.id;
    const type = target.dataset.type;

    if (target.classList.contains('btn-delete')) {
        if (!id || !type) return;
        if (confirm(`Are you sure you want to delete this ${type} record?`)) {
            const path = `financials/${type === 'purchase' ? 'purchases' : type === 'cheque' ? 'cheques' : 'cashLog'}/${id}`;
            remove(ref(db, path)).catch(error => console.error(`Error deleting ${type}:`, error));
        }
    }

    if (target.classList.contains('btn-edit')) {
        if (!id || !type) return;
        const path = `financials/${type === 'purchase' ? 'purchases' : type === 'cheque' ? 'cheques' : 'cashLog'}/${id}`;
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

// --- Export to CSV ---
function exportTableToCSV(filename, tableElement) {
    const headers = Array.from(tableElement.querySelectorAll('thead tr:last-child th')).map(th => th.textContent.trim()).filter(h => h !== 'Actions');
     let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\r\n";

    // This simplified export doesn't handle rowspans perfectly. It will show blank cells.
    // A more complex export would be needed to fill down the rowspan values.
    tableElement.querySelectorAll('tbody tr').forEach(row => {
        if (row.querySelector('td.text-muted')) return;
        const rowData = Array.from(row.querySelectorAll('td')).filter(td => !td.hasAttribute('rowspan'));
        const rowText = rowData.map(td => `"${td.textContent.replace(/"/g, '""').trim()}"`).join(',');
        
        // This is a simplified approach. For a perfect export, you would need to reconstruct the data from the grouped logic.
        // For now, we export what is visible, which will have blank cells for grouped data.
        if(rowText) csvContent += rowText + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

exportPurchasesBtn.addEventListener('click', () => exportTableToCSV('purchases_log.csv', document.getElementById('purchasesTable')));
exportChequesBtn.addEventListener('click', () => exportTableToCSV('cheque_log.csv', document.querySelector('#cheques-tab .data-table')));
exportCashBtn.addEventListener('click', () => exportTableToCSV('cash_log.csv', document.querySelector('#cash-tab .data-table')));