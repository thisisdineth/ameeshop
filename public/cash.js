import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, push, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Use the same Firebase config from your main page
const firebaseConfig = {
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
const showAddCashFormBtn = document.getElementById('showAddCashFormBtn');
const addCashFormContainer = document.getElementById('addCashFormContainer');
const addCashForm = document.getElementById('addCashForm');
const cashFormTitle = document.getElementById('cashFormTitle');
const cashFormSubmitBtn = document.getElementById('cashFormSubmitBtn');
const cashOutTableBody = document.getElementById('cashOutTableBody');
const cashEditIdInput = document.getElementById('cashEditId');

// --- Database Reference ---
// This points to the exact same location as the main page's cash log
const cashLogRef = ref(db, 'financials/cashLog');

// --- Form Management ---
function resetForm() {
    addCashForm.reset();
    cashEditIdInput.value = '';
    cashFormTitle.textContent = 'Add New Cash Out Record';
    cashFormSubmitBtn.innerHTML = `<i class="fas fa-check fa-fw"></i> Save Record`;
}

function toggleForm() {
    const isHidden = addCashFormContainer.classList.contains('hidden');
    if (isHidden) {
        addCashFormContainer.classList.remove('hidden');
        showAddCashFormBtn.innerHTML = `<i class="fas fa-times fa-fw"></i> Cancel`;
        showAddCashFormBtn.classList.replace('btn-primary', 'btn-warning');
    } else {
        addCashFormContainer.classList.add('hidden');
        showAddCashFormBtn.innerHTML = `<i class="fas fa-plus fa-fw"></i> Add Cash Out Entry`;
        showAddCashFormBtn.classList.replace('btn-warning', 'btn-primary');
        resetForm();
    }
}

showAddCashFormBtn.addEventListener('click', toggleForm);

// --- Form Submission (Add & Edit) ---
addCashForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const editId = cashEditIdInput.value;
    const formData = {
        date: document.getElementById('cashDate').value,
        reason: document.getElementById('cashReason').value,
        amount: parseFloat(document.getElementById('cashAmount').value) || 0,
        note: document.getElementById('cashNote').value,
    };

    // If there's an editId, update the record. Otherwise, create a new one.
    const dbRef = editId ? ref(db, `financials/cashLog/${editId}`) : push(cashLogRef);
    
    set(dbRef, formData)
        .then(() => {
            // Hide the form and reset it after successful submission
            toggleForm(); 
        })
        .catch(error => console.error("Error saving cash log: ", error));
});


// --- Data Loading & Table Rendering ---
onValue(cashLogRef, (snapshot) => {
    cashOutTableBody.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
        cashOutTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No cash out records found.</td></tr>';
        return;
    }

    // Convert data object to an array and sort by date (newest first)
    const records = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
    }));
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Create a table row for each record
    records.forEach(record => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.date}</td>
            <td>${record.reason}</td>
            <td class="text-right">${(record.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${record.note || ''}</td>
            <td class="text-center actions">
                <button class="btn btn-sm btn-warning btn-edit" data-id="${record.id}"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn btn-sm btn-danger btn-delete" data-id="${record.id}"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        cashOutTableBody.appendChild(tr);
    });
});

// --- Event Delegation for Edit and Delete buttons ---
document.body.addEventListener('click', async (e) => {
    const targetButton = e.target.closest('button');
    if (!targetButton) return;

    const id = targetButton.dataset.id;
    if (!id) return;
    
    // --- Handle Delete ---
    if (targetButton.classList.contains('btn-delete')) {
        if (confirm('Are you sure you want to delete this cash record?')) {
            const recordRef = ref(db, `financials/cashLog/${id}`);
            remove(recordRef).catch(error => console.error("Error deleting record: ", error));
        }
    }

    // --- Handle Edit ---
    if (targetButton.classList.contains('btn-edit')) {
        const recordRef = ref(db, `financials/cashLog/${id}`);
        const snapshot = await get(recordRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Populate the form with the record's data
            cashEditIdInput.value = id;
            document.getElementById('cashDate').value = data.date || '';
            document.getElementById('cashReason').value = data.reason || '';
            document.getElementById('cashAmount').value = data.amount || '';
            document.getElementById('cashNote').value = data.note || '';
            
            // Update form title and button text for editing mode
            cashFormTitle.textContent = "Edit Cash Record";
            cashFormSubmitBtn.innerHTML = `<i class="fas fa-save fa-fw"></i> Update Record`;

            // Show the form if it's hidden
            if (addCashFormContainer.classList.contains('hidden')) {
                toggleForm();
            }
        }
    }
});