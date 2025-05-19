// === raw_tea.js ===

document.addEventListener('DOMContentLoaded', () => {
    // Firebase configuration (Same as user provided)
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

    // --- Navbar Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        const mobileNavLinks = mobileMenu.querySelectorAll('a.mobile-navbar-item'); // Ensure links have this class in HTML
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- DOM Elements ---
    const addNewTableBtn = document.getElementById('addNewTableBtn');
    const newTableModal = document.getElementById('newTableModal');
    const closeModalButton = document.querySelector('.modal .modal-close-button');
    const tableNameInput = document.getElementById('tableNameInput');
    const existingTableSuggestions = document.getElementById('existingTableSuggestions');
    const createOrSelectTableBtn = document.getElementById('createOrSelectTableBtn');

    const currentTableDisplay = document.getElementById('currentTableDisplay');
    const currentTableNameDisplay = document.getElementById('currentTableNameDisplay');
    const currentCalculatedBalanceDisplay = document.getElementById('currentCalculatedBalance');
    const rawTeaTableBody = document.getElementById('rawTeaTableBody');

    const addRowFormContainer = document.getElementById('addRowFormContainer');
    const addRowForm = document.getElementById('addRowForm');
    const addRowFormTableName = document.getElementById('addRowFormTableName');

    const allTablesList = document.getElementById('allTablesList');
    const searchTableInput = document.getElementById('searchTableInput');

    // For Inflow Form
    const inflowBagWeightInput = document.getElementById('inflowBagWeight');
    const inflowBagsInput = document.getElementById('inflowBags');
    const inflowTotalWeightInput = document.getElementById('inflowTotalWeight');


    let activeTableName = null;
    let existingTableNames = [];
    const METADATA_PATH = 'rawTeaTableMetadata'; // Path for table names/metadata
    const DATA_PATH = 'rawTeaTableData';         // Path for actual table data entries

    // --- Calculate Total Inflow Weight ---
    function calculateTotalInflow() {
        const bagWeight = parseFloat(inflowBagWeightInput.value) || 0;
        const numBags = parseInt(inflowBagsInput.value) || 0;
        inflowTotalWeightInput.value = (bagWeight * numBags).toFixed(2);
    }
    if (inflowBagWeightInput) inflowBagWeightInput.addEventListener('input', calculateTotalInflow);
    if (inflowBagsInput) inflowBagsInput.addEventListener('input', calculateTotalInflow);


    // --- Modal Functionality ---
    if (addNewTableBtn) {
        addNewTableBtn.onclick = () => {
            newTableModal.style.display = 'flex';
            tableNameInput.value = '';
            existingTableSuggestions.innerHTML = '';
            fetchExistingTableNames();
        };
    }
    if (closeModalButton) {
        closeModalButton.onclick = () => newTableModal.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target === newTableModal) newTableModal.style.display = 'none';
    };

    // --- Table Name Input and Suggestions ---
    if (tableNameInput) {
        tableNameInput.addEventListener('input', () => {
            const inputText = tableNameInput.value.toLowerCase();
            existingTableSuggestions.innerHTML = '';
            if (inputText.length > 0 && Array.isArray(existingTableNames)) {
                const suggestions = existingTableNames.filter(name => name.toLowerCase().includes(inputText));
                suggestions.forEach(name => {
                    const li = document.createElement('li');
                    li.textContent = name;
                    li.onclick = () => {
                        tableNameInput.value = name;
                        existingTableSuggestions.innerHTML = '';
                    };
                    existingTableSuggestions.appendChild(li);
                });
            }
        });
    }

    // --- Fetch Existing Table Names ---
    async function fetchExistingTableNames() {
        try {
            const snapshot = await db.ref(METADATA_PATH).once('value');
            existingTableNames = snapshot.val() ? Object.keys(snapshot.val()) : [];
        } catch (error) {
            console.error("Error fetching table names: ", error);
            existingTableNames = [];
        }
        populateAllTablesList();
    }

    // --- Create or Select Table ---
    if (createOrSelectTableBtn) {
        createOrSelectTableBtn.onclick = async () => {
            const tableName = tableNameInput.value.trim();
            if (!tableName) {
                alert('Table name cannot be empty.');
                return;
            }
            activeTableName = tableName;
            currentTableNameDisplay.textContent = `Inventory: ${tableName}`;
            addRowFormTableName.textContent = tableName;
            currentTableDisplay.classList.remove('hidden');
            addRowFormContainer.classList.remove('hidden');
            newTableModal.style.display = 'none';

            if (!existingTableNames.includes(tableName)) {
                try {
                    await db.ref(`${METADATA_PATH}/${tableName}`).set({ 
                        createdAt: firebase.database.ServerValue.TIMESTAMP,
                        // You could add default units or other metadata here
                        // e.g., defaultUnit: "Kg" 
                    });
                    existingTableNames.push(tableName);
                    populateAllTablesList();
                } catch (error) {
                    console.error("Error creating table metadata: ", error);
                    alert('Error creating table metadata.');
                    return;
                }
            }
            loadTableData(tableName);
        };
    }

    // --- Load Table Data & Calculate Balance ---
    async function loadTableData(tableName) {
        if (!tableName || !rawTeaTableBody) return;
        
        const dataRef = db.ref(`${DATA_PATH}/${tableName}`).orderByChild('transactionDate');
        dataRef.on('value', snapshot => { // Real-time listener
            rawTeaTableBody.innerHTML = ''; // Clear before re-rendering
            let currentBalance = 0;
            const entries = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    entries.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });

                // Sort again client-side if transactionDate can be same, then by timestamp
                entries.sort((a, b) => {
                    if (a.transactionDate < b.transactionDate) return -1;
                    if (a.transactionDate > b.transactionDate) return 1;
                    return (a.timestamp || 0) - (b.timestamp || 0); // Fallback to timestamp
                });

                entries.forEach(data => {
                    let inflowQty = 0;
                    let outflowQty = 0;

                    if (data.transactionType === 'inflow' && data.inflowTotalWeight) {
                        inflowQty = parseFloat(data.inflowTotalWeight) || 0;
                    } else if (data.transactionType === 'outflow' && data.outflowWeight) {
                        outflowQty = parseFloat(data.outflowWeight) || 0;
                    }
                    currentBalance += inflowQty - outflowQty;
                    renderRow(data.id, data, currentBalance);
                });
            } else {
                 const row = rawTeaTableBody.insertRow();
                 const cell = row.insertCell();
                 cell.colSpan = 11; // Adjusted colspan
                 cell.textContent = 'No entries yet for this tea. Add an inflow below.';
                 cell.style.textAlign = 'center';
                 cell.style.padding = '1rem';
                 cell.style.color = 'var(--text-color-muted)';
            }
            currentCalculatedBalanceDisplay.textContent = `${currentBalance.toFixed(2)} Kg`;
        });
    }
    
    // --- Render a Single Row ---
    // Columns: Date, Type, Supplier/Product, Estate, Grade, Bag Wt, Bags, Inflow, Outflow, Balance, Actions
    function renderRow(docId, data, calculatedBalance) {
        const row = rawTeaTableBody.insertRow();
        row.setAttribute('data-id', docId);

        row.insertCell().textContent = data.transactionDate || '';
        
        const typeCell = row.insertCell();
        typeCell.classList.add('text-center');
        if (data.transactionType === 'inflow') {
            typeCell.innerHTML = '<span class="badge badge-success">IN</span>';
        } else if (data.transactionType === 'outflow') {
            typeCell.innerHTML = '<span class="badge badge-danger">OUT</span>';
        } else {
            typeCell.textContent = 'N/A';
        }

        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowSupplier || 'N/A') : (data.outflowProduct || data.outflowNotes || 'N/A');
        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowEstate || 'N/A') : (data.outflowNotes ? 'Production' : 'N/A'); // Simplified for outflow
        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowGrade || 'N/A') : 'N/A';

        const bagWtCell = row.insertCell();
        bagWtCell.textContent = data.transactionType === 'inflow' ? (data.inflowBagWeight || '') : '';
        bagWtCell.classList.add('text-right');

        const bagsCell = row.insertCell();
        bagsCell.textContent = data.transactionType === 'inflow' ? (data.inflowBags || '') : '';
        bagsCell.classList.add('text-right');

        const inflowCell = row.insertCell();
        inflowCell.textContent = data.transactionType === 'inflow' && data.inflowTotalWeight ? parseFloat(data.inflowTotalWeight).toFixed(2) : '0.00';
        inflowCell.classList.add('text-right', 'text-success');
        
        const outflowCell = row.insertCell();
        outflowCell.textContent = data.transactionType === 'outflow' && data.outflowWeight ? parseFloat(data.outflowWeight).toFixed(2) : '0.00';
        outflowCell.classList.add('text-right', 'text-danger');

        const balanceCell = row.insertCell();
        balanceCell.textContent = calculatedBalance.toFixed(2);
        balanceCell.classList.add('text-right', 'font-weight-bold');

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i>';
        editBtn.title = "Edit Entry";
        editBtn.classList.add('btn', 'btn-warning', 'btn-sm');
        editBtn.onclick = () => editRow(docId, data);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>';
        deleteBtn.title = "Delete Entry";
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.onclick = () => deleteRow(docId, data.transactionType, data.inflowTotalWeight, data.outflowWeight); // Pass info for potential balance adjustment if needed

        // Only allow editing/deleting of manual inflows from this interface for simplicity
        if (data.transactionType === 'inflow') {
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        } else if (data.transactionType === 'outflow') {
            const info = document.createElement('span');
            info.innerHTML = '<i class="fas fa-info-circle fa-fw"></i> Prod.';
            info.title = `Outflow for ${data.outflowProduct || 'production'}. Manage in Production Log.`;
            info.classList.add('text-muted', 'font-italic', 'text-sm');
            actionsCell.appendChild(info);
            // Optionally add a delete button for outflows too, but with strong warnings
            // actionsCell.appendChild(deleteBtn); // Be cautious with this
        }
    }

    // --- Add New Inflow Row ---
    if (addRowForm) {
        addRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) {
                alert('Please select or create a Raw Tea table first.');
                return;
            }

            const totalWeight = parseFloat(document.getElementById('inflowTotalWeight').value) || 0;
            if (totalWeight <= 0) {
                alert('Total inflow weight must be greater than zero.');
                return;
            }

            const rowData = {
                transactionDate: document.getElementById('transactionDate').value,
                transactionType: 'inflow',
                inflowSupplier: document.getElementById('inflowSupplier').value.trim() || null,
                inflowEstate: document.getElementById('inflowEstate').value.trim() || null,
                inflowGrade: document.getElementById('inflowGrade').value.trim() || null,
                inflowBagWeight: parseFloat(document.getElementById('inflowBagWeight').value) || null,
                inflowBags: parseInt(document.getElementById('inflowBags').value) || null,
                inflowTotalWeight: totalWeight,
                inflowNotes: document.getElementById('inflowNotes').value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP // For tie-breaking if dates are same
            };

            if (!rowData.transactionDate) {
                alert('Inflow Date is required.');
                document.getElementById('transactionDate').focus();
                return;
            }

            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                addRowForm.reset();
                document.getElementById('transactionDate').valueAsDate = new Date();
                // Table updates via real-time listener
            } catch (error) {
                console.error("Error adding new inflow: ", error);
                alert('Error adding inflow. Check console.');
            }
        });
    }

    // --- Edit Inflow Row ---
    function editRow(docId, currentData) {
        if (!activeTableName || currentData.transactionType !== 'inflow') {
            alert("Only inflow entries can be edited from this interface.");
            return;
        }

        // For better UX, pre-fill the main form. Using prompts for brevity.
        const newDate = prompt("Enter new Inflow Date (YYYY-MM-DD):", currentData.transactionDate);
        if (newDate === null) return; // User cancelled

        const newSupplier = prompt("Enter new Supplier:", currentData.inflowSupplier || "");
        const newEstate = prompt("Enter new Estate:", currentData.inflowEstate || "");
        const newGrade = prompt("Enter new Grade:", currentData.inflowGrade || "");
        const newBagWeight = parseFloat(prompt("Enter new Bag Weight (Kg):", currentData.inflowBagWeight || "0"));
        const newBags = parseInt(prompt("Enter new Number of Bags:", currentData.inflowBags || "0"));
        const newNotes = prompt("Enter new Notes:", currentData.inflowNotes || "");


        const totalWeight = (newBagWeight || 0) * (newBags || 0);
        if (totalWeight <= 0 && (newBagWeight || newBags) ) { // Allow if both are 0, but not if one is non-zero and result is 0
            alert("Calculated total weight is invalid based on new bag weight/count. Edit cancelled.");
            return;
        }


        const updatedData = {
            ...currentData, // Keep other fields like timestamp, transactionType
            transactionDate: newDate,
            inflowSupplier: newSupplier !== null ? newSupplier.trim() : null,
            inflowEstate: newEstate !== null ? newEstate.trim() : null,
            inflowGrade: newGrade !== null ? newGrade.trim() : null,
            inflowBagWeight: newBagWeight || null,
            inflowBags: newBags || null,
            inflowTotalWeight: totalWeight.toFixed(2),
            inflowNotes: newNotes !== null ? newNotes.trim() : null,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
            .then(() => console.log("Inflow entry updated.")) // Table updates via listener
            .catch(error => {
                console.error("Error updating inflow: ", error);
                alert('Error updating inflow entry.');
            });
    }

    // --- Delete Row ---
    // Deleting any transaction will affect subsequent balances. The real-time listener will handle re-calculation.
    async function deleteRow(docId, transactionType, inflowWt, outflowWt) {
        if (!activeTableName) return;
        let message = `Are you sure you want to delete this ${transactionType || 'entry'}?`;
        if (transactionType === 'outflow') {
            message += "\n\nWARNING: This outflow was likely created by a Production Log. Deleting it here will NOT update the Production Log itself and may cause inventory discrepancies. Manual adjustment in Production Log might be needed."
        } else if (transactionType === 'inflow') {
             message += "\n\nThis will affect the calculated balance for all subsequent entries."
        }

        if (confirm(message)) {
            try {
                await db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).remove();
                // Table updates via real-time listener, which recalculates balances.
                console.log("Entry deleted.");
            } catch (error) {
                console.error("Error deleting entry: ", error);
                alert('Error deleting entry.');
            }
        }
    }

    // --- Populate All Created Tables List ---
    function populateAllTablesList() {
        allTablesList.innerHTML = '';
        const searchTerm = searchTableInput.value.toLowerCase();
        const filteredNames = existingTableNames.filter(name => name.toLowerCase().includes(searchTerm));

        if (filteredNames.length === 0) {
            const li = document.createElement('li');
            li.textContent = searchTerm ? 'No tables match search.' : 'No Raw Tea tables created yet.';
            li.classList.add('list-item-placeholder');
            allTablesList.appendChild(li);
            return;
        }

        filteredNames.forEach(tableName => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = tableName;
            nameSpan.classList.add('item-name');
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('item-actions');

            const selectBtn = document.createElement('button');
            selectBtn.innerHTML = '<i class="fas fa-check-circle fa-fw"></i> Select';
            selectBtn.classList.add('btn', 'btn-success', 'btn-sm');
            selectBtn.onclick = () => {
                activeTableName = tableName;
                currentTableNameDisplay.textContent = `Inventory: ${tableName}`;
                addRowFormTableName.textContent = tableName;
                currentTableDisplay.classList.remove('hidden');
                addRowFormContainer.classList.remove('hidden');
                loadTableData(tableName);
                if(currentTableDisplay) window.scrollTo({ top: currentTableDisplay.offsetTop - 80, behavior: 'smooth' });
            };

            const deleteTableBtn = document.createElement('button');
            deleteTableBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete Table';
            deleteTableBtn.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteTableBtn.onclick = (event) => {
                event.stopPropagation();
                deleteEntireTable(tableName);
            };
            actionsDiv.appendChild(selectBtn);
            actionsDiv.appendChild(deleteTableBtn);
            li.appendChild(actionsDiv);
            allTablesList.appendChild(li);
        });
    }

    // --- Delete Entire Table ---
    async function deleteEntireTable(tableNameToDelete) {
        if (confirm(`DELETE TABLE: "${tableNameToDelete}"?\nThis removes all its data and cannot be undone.`)) {
            try {
                await db.ref(`${DATA_PATH}/${tableNameToDelete}`).remove();      // Delete data
                await db.ref(`${METADATA_PATH}/${tableNameToDelete}`).remove(); // Delete metadata
                
                existingTableNames = existingTableNames.filter(name => name !== tableNameToDelete);
                populateAllTablesList();
                if (activeTableName === tableNameToDelete) {
                    currentTableDisplay.classList.add('hidden');
                    addRowFormContainer.classList.add('hidden');
                    activeTableName = null;
                    currentTableNameDisplay.textContent = '';
                    rawTeaTableBody.innerHTML = '';
                    currentCalculatedBalanceDisplay.textContent = '0.00 Kg';
                }
                alert(`Table "${tableNameToDelete}" deleted.`);
            } catch (error) {
                console.error(`Error deleting table ${tableNameToDelete}: `, error);
                alert(`Could not delete table "${tableNameToDelete}".`);
            }
        }
    }

    // --- Search Table ---
    if (searchTableInput) searchTableInput.addEventListener('input', populateAllTablesList);
    
    // --- Initial Load ---
    fetchExistingTableNames();
    document.getElementById('transactionDate').valueAsDate = new Date(); // Pre-fill date
});

// Helper CSS for badges (add to tbs.css or your main shared CSS)
/*
.badge {
    display: inline-block;
    padding: .35em .65em;
    font-size: .75em;
    font-weight: 700;
    line-height: 1;
    color: #fff;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;
    border-radius: .25rem;
}
.badge-success { background-color: var(--button-success-bg, #28a745); }
.badge-danger { background-color: var(--button-danger-bg, #dc3545); }
.text-success { color: var(--button-success-bg, #28a745) !important; }
.text-danger { color: var(--button-danger-bg, #dc3545) !important; }
.font-weight-bold { font-weight: 700 !important; }
.font-italic { font-style: italic !important; }
.text-muted { color: var(--text-color-muted, #6c757d) !important; }
.text-sm { font-size: 0.8rem !important; }
*/