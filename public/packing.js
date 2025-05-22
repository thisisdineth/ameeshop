document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM", // Replace with your actual API key if different
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // --- Navigation ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        mobileMenu.querySelectorAll('a.mobile-navbar-item').forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- Table Management ---
    const addNewTableBtn = document.getElementById('addNewTableBtn');
    const newTableModal = document.getElementById('newTableModal');
    const closeModalButton = document.querySelector('.modal .modal-close-button');
    const tableNameInput = document.getElementById('tableNameInput');
    const existingTableSuggestions = document.getElementById('existingTableSuggestions');
    const createOrSelectTableBtn = document.getElementById('createOrSelectTableBtn');
    const allTablesList = document.getElementById('allTablesList');
    const searchTableInput = document.getElementById('searchTableInput');

    // --- Current Table Display & Actions ---
    const currentTableDisplay = document.getElementById('currentTableDisplay');
    const currentTableNameDisplay = document.getElementById('currentTableNameDisplay');
    const currentCalculatedBalanceDisplay = document.getElementById('currentCalculatedBalance');
    const packingMaterialTableBody = document.getElementById('packingMaterialTableBody');
    const exportToExcelBtn = document.getElementById('exportToExcelBtn');
    const sortOrderSelect = document.getElementById('sortOrderSelect');

    // --- Entry Forms ---
    const entryFormsContainer = document.getElementById('entryFormsContainer');
    const addRowFormContainer = document.getElementById('addRowFormContainer'); // Specific container for receive form
    const addRowForm = document.getElementById('addRowForm');
    const addRowFormTableName = document.getElementById('addRowFormTableName');

    const addManualOutflowContainer = document.getElementById('addManualOutflowContainer');
    const addManualOutflowForm = document.getElementById('addManualOutflowForm');
    const addOutflowFormTableName = document.getElementById('addOutflowFormTableName');


    let activeTableName = null;
    let existingTableNames = [];
    let currentTableEntries = []; // To store entries for sorting/exporting
    let currentSortOrder = 'timestamp_desc'; // Default sort order

    const METADATA_PATH = 'packingMaterialTableMetadata';
    const DATA_PATH = 'packingMaterialTableData';

    // --- Initialize Default Dates ---
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('transactionDate')) document.getElementById('transactionDate').value = today;
    if(document.getElementById('outflowTransactionDate')) document.getElementById('outflowTransactionDate').value = today;


    // --- Modal Handling for New Table ---
    if (addNewTableBtn) {
        addNewTableBtn.onclick = () => {
            newTableModal.style.display = 'flex';
            tableNameInput.value = ''; existingTableSuggestions.innerHTML = '';
            fetchExistingTableNames(); // Refresh suggestions
        };
    }
    if (closeModalButton) closeModalButton.onclick = () => newTableModal.style.display = 'none';
    window.onclick = (event) => { if (event.target === newTableModal) newTableModal.style.display = 'none'; };

    if (tableNameInput) {
        tableNameInput.addEventListener('input', () => {
            const inputText = tableNameInput.value.toLowerCase();
            existingTableSuggestions.innerHTML = '';
            if (inputText.length > 0 && Array.isArray(existingTableNames)) {
                const suggestions = existingTableNames.filter(name => name.toLowerCase().includes(inputText));
                suggestions.forEach(name => {
                    const li = document.createElement('li'); li.textContent = name;
                    li.onclick = () => { tableNameInput.value = name; existingTableSuggestions.innerHTML = ''; };
                    existingTableSuggestions.appendChild(li);
                });
            }
        });
    }

    async function fetchExistingTableNames() {
        try {
            const snapshot = await db.ref(METADATA_PATH).once('value');
            existingTableNames = snapshot.val() ? Object.keys(snapshot.val()).sort((a,b) => a.localeCompare(b)) : [];
        } catch (error) { console.error("Error fetching packing table names: ", error); existingTableNames = []; }
        populateAllTablesList();
    }

    if (createOrSelectTableBtn) {
        createOrSelectTableBtn.onclick = async () => {
            const tableName = tableNameInput.value.trim();
            if (!tableName) { alert('Table name cannot be empty.'); return; }

            setActiveTable(tableName);

            if (!existingTableNames.includes(tableName)) {
                try {
                    await db.ref(`${METADATA_PATH}/${tableName}`).set({ createdAt: firebase.database.ServerValue.TIMESTAMP });
                    existingTableNames.push(tableName);
                    existingTableNames.sort((a,b)=>a.localeCompare(b)); // Keep it sorted
                    populateAllTablesList(); // Refresh the list
                } catch (error) { console.error("Error creating packing table metadata: ", error); alert('Error creating table metadata.'); return; }
            }
            newTableModal.style.display = 'none';
            loadTableData(tableName);
        };
    }

    function setActiveTable(tableName) {
        activeTableName = tableName;
        currentTableNameDisplay.textContent = `Inventory: ${tableName}`;
        addRowFormTableName.textContent = tableName;
        addOutflowFormTableName.textContent = tableName; // Also set for outflow form
        currentTableDisplay.classList.remove('hidden');
        entryFormsContainer.classList.remove('hidden'); // Show the container for both forms
    }

    function sortEntries(entries, sortOrder) {
        return entries.sort((a, b) => {
            let valA, valB;
            switch (sortOrder) {
                case 'timestamp_asc':
                    return (a.timestamp || 0) - (b.timestamp || 0);
                case 'timestamp_desc':
                    return (b.timestamp || 0) - (a.timestamp || 0);
                case 'transactionDate_asc':
                    valA = new Date(a.transactionDate).getTime();
                    valB = new Date(b.transactionDate).getTime();
                    if (valA === valB) return (a.timestamp || 0) - (b.timestamp || 0); // Secondary sort by timestamp
                    return valA - valB;
                case 'transactionDate_desc':
                    valA = new Date(a.transactionDate).getTime();
                    valB = new Date(b.transactionDate).getTime();
                    if (valA === valB) return (b.timestamp || 0) - (a.timestamp || 0); // Secondary sort by timestamp
                    return valB - valA;
                default:
                    return (b.timestamp || 0) - (a.timestamp || 0); // Default: newest first by creation
            }
        });
    }


    async function loadTableData(tableName) {
        if (!tableName || !packingMaterialTableBody) return;
        const dataRef = db.ref(`${DATA_PATH}/${tableName}`); // Order by client-side after fetching

        dataRef.on('value', snapshot => {
            packingMaterialTableBody.innerHTML = '';
            let currentBalance = 0;
            currentTableEntries = []; // Reset current entries

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    currentTableEntries.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });

                // Sort entries based on the current sort order
                currentTableEntries = sortEntries(currentTableEntries, currentSortOrder);

                currentTableEntries.forEach(data => {
                    let receiveQty = 0; let issueQty = 0;
                    if (data.transactionType === 'receive' && data.receiveQty) {
                        receiveQty = parseInt(data.receiveQty) || 0;
                    } else if (data.transactionType === 'issue' && data.issueQty) {
                        issueQty = parseInt(data.issueQty) || 0;
                    }
                    currentBalance += receiveQty - issueQty;
                    renderRow(data.id, data, currentBalance); // Pass calculated balance for this row
                });
            } else {
                const row = packingMaterialTableBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 10;
                cell.textContent = 'No entries. Add a receive or outflow entry.';
                cell.style.textAlign = 'center';
                cell.style.padding = '1rem';
                cell.style.color = 'var(--text-color-muted)';
            }
            currentCalculatedBalanceDisplay.textContent = `${currentBalance} Pcs/Units`;
        }, error => {
            console.error("Error loading table data: ", error);
            packingMaterialTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error loading data.</td></tr>';
        });
    }

    function renderRow(docId, data, calculatedBalanceForRow) {
        const row = packingMaterialTableBody.insertRow();
        row.setAttribute('data-id', docId);
        row.setAttribute('data-timestamp', data.timestamp || 0); // For sorting reference if needed directly on DOM
        row.setAttribute('data-transaction-date', data.transactionDate);

        row.insertCell().textContent = data.transactionDate || '';

        const typeCell = row.insertCell();
        typeCell.classList.add('text-center');
        if (data.transactionType === 'receive') {
            typeCell.innerHTML = '<span class="badge badge-success">IN</span>';
        } else if (data.transactionType === 'issue') {
            typeCell.innerHTML = '<span class="badge badge-danger">OUT</span>';
        } else {
            typeCell.textContent = 'N/A';
        }

        row.insertCell().textContent = data.transactionType === 'receive' ? (data.receiveDate || '') : '';
        const unitPriceCell = row.insertCell();
        unitPriceCell.textContent = data.transactionType === 'receive' && typeof data.receiveUnitPrice === 'number' ? data.receiveUnitPrice.toFixed(2) : '';
        unitPriceCell.classList.add('text-right');

        const receiveQtyCell = row.insertCell();
        receiveQtyCell.textContent = data.transactionType === 'receive' && data.receiveQty ? data.receiveQty : '';
        receiveQtyCell.classList.add('text-right');

        row.insertCell().textContent = data.transactionType === 'issue' ? (data.issueDate || '') : '';
        const issueQtyCell = row.insertCell();
        issueQtyCell.textContent = data.transactionType === 'issue' && data.issueQty ? data.issueQty : '';
        issueQtyCell.classList.add('text-right');

        // Combined Reason/Product/Notes field
        let reasonNotes = '';
        if (data.transactionType === 'receive') {
            reasonNotes = data.receiveNotes || '';
        } else if (data.transactionType === 'issue') {
            reasonNotes = data.issueReason || (data.isAutoIssue ? 'Production Use (Auto)' : 'Manual Outflow');
        }
        row.insertCell().textContent = reasonNotes;

        const balanceCell = row.insertCell();
        balanceCell.textContent = calculatedBalanceForRow;
        balanceCell.classList.add('text-right', 'font-weight-bold');

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i>';
        editBtn.title = "Edit";
        editBtn.classList.add('btn', 'btn-warning', 'btn-sm');

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>';
        deleteBtn.title = "Delete";
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');

        if (data.transactionType === 'receive') {
            editBtn.onclick = () => editRow(docId, data, 'receive');
            deleteBtn.onclick = () => deleteRow(docId, data.transactionType);
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        } else if (data.transactionType === 'issue') {
            if (data.isAutoIssue) { // Assuming 'isAutoIssue' flag for production auto entries
                const info = document.createElement('span');
                info.innerHTML = '<i class="fas fa-info-circle fa-fw"></i> Auto';
                info.title = `Issued for ${data.issueReason || 'production'}. Manage in Production Log.`;
                info.classList.add('text-muted', 'font-italic', 'text-sm');
                actionsCell.appendChild(info);
            } else { // Manually added issue
                editBtn.onclick = () => editRow(docId, data, 'issue');
                deleteBtn.onclick = () => deleteRow(docId, data.transactionType);
                actionsCell.appendChild(editBtn);
                actionsCell.appendChild(deleteBtn);
            }
        }
    }

    // --- Receive Form ---
    if (addRowForm) {
        addRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) { alert('Please select or create a Packing Material table first.'); return; }

            const receiveQty = parseInt(document.getElementById('receiveQty').value);
            if (isNaN(receiveQty) || receiveQty <= 0) { alert('Receive Quantity must be a positive number.'); document.getElementById('receiveQty').focus(); return; }

            const transactionDate = document.getElementById('transactionDate').value;
            if (!transactionDate) { alert('Transaction Date is required.'); document.getElementById('transactionDate').focus(); return; }

            const unitPriceValue = document.getElementById('receiveUnitPrice').value;

            const rowData = {
                transactionDate: transactionDate,
                transactionType: 'receive',
                receiveDate: document.getElementById('receiveDate').value || transactionDate,
                receiveUnitPrice: unitPriceValue && !isNaN(parseFloat(unitPriceValue)) ? parseFloat(unitPriceValue) : null, // Ensure it's a number or null
                receiveQty: receiveQty,
                receiveNotes: document.getElementById('receiveNotes').value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                addRowForm.reset();
                document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0]; // Reset to today
                // Data will reload via the 'on' listener
            } catch (error) { console.error("Error adding receive entry: ", error); alert('Failed to add receive entry. Please check console for details.'); }
        });
    }

    // --- Manual Outflow Form ---
    if (addManualOutflowForm) {
        addManualOutflowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) { alert('Please select or create a Packing Material table first.'); return; }

            const issueQty = parseInt(document.getElementById('outflowIssueQty').value);
            if (isNaN(issueQty) || issueQty <= 0) { alert('Issue Quantity must be a positive number.'); document.getElementById('outflowIssueQty').focus(); return; }

            const transactionDate = document.getElementById('outflowTransactionDate').value;
            if (!transactionDate) { alert('Transaction Date is required.'); document.getElementById('outflowTransactionDate').focus(); return; }

            const issueReason = document.getElementById('outflowReason').value.trim();
            if (!issueReason) { alert('Reason/Product for outflow is required.'); document.getElementById('outflowReason').focus(); return; }

            const rowData = {
                transactionDate: transactionDate,
                transactionType: 'issue',
                issueDate: document.getElementById('outflowIssueDate').value || transactionDate,
                issueQty: issueQty,
                issueReason: issueReason,
                isAutoIssue: false, // Mark as manual
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                addManualOutflowForm.reset();
                document.getElementById('outflowTransactionDate').value = new Date().toISOString().split('T')[0]; // Reset to today
                // Data will reload via the 'on' listener
            } catch (error) { console.error("Error adding manual outflow entry: ", error); alert('Failed to add manual outflow entry. Please check console for details.'); }
        });
    }

    function editRow(docId, currentData, type) { // type can be 'receive' or 'issue'
        if (!activeTableName) return;

        if (type === 'receive') {
            const newTransactionDate = prompt("Edit Transaction Date (YYYY-MM-DD):", currentData.transactionDate); if (newTransactionDate === null) return;
            const newReceiveDate = prompt("Edit Actual Receive Date (YYYY-MM-DD):", currentData.receiveDate || newTransactionDate);
            const newUnitPriceString = prompt("Edit Unit Price:", typeof currentData.receiveUnitPrice === 'number' ? currentData.receiveUnitPrice : "0");
            const newReceiveQtyString = prompt("Edit Receive Quantity:", currentData.receiveQty || "0");
            const newNotes = prompt("Edit Receive Notes:", currentData.receiveNotes || "");

            const newReceiveQty = parseInt(newReceiveQtyString);
            if (isNaN(newReceiveQty) || newReceiveQty <= 0) { alert("Receive Quantity must be a positive number. Edit cancelled."); return; }
            if (!newTransactionDate) { alert("Transaction Date cannot be empty. Edit cancelled."); return; }
            
            let newUnitPrice = null;
            if (newUnitPriceString !== null && newUnitPriceString.trim() !== "" && !isNaN(parseFloat(newUnitPriceString))) {
                newUnitPrice = parseFloat(newUnitPriceString);
            }


            const updatedData = {
                ...currentData,
                transactionDate: newTransactionDate,
                receiveDate: newReceiveDate || newTransactionDate,
                receiveUnitPrice: newUnitPrice,
                receiveQty: newReceiveQty,
                receiveNotes: newNotes !== null ? newNotes.trim() : null,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
                .then(() => console.log("Receive entry updated."))
                .catch(error => { console.error("Error updating entry: ", error); alert('Error updating receive entry.'); });

        } else if (type === 'issue' && !currentData.isAutoIssue) { // Only edit manual issues
            const newTransactionDate = prompt("Edit Transaction Date (YYYY-MM-DD):", currentData.transactionDate); if (newTransactionDate === null) return;
            const newIssueDate = prompt("Edit Actual Issue Date (YYYY-MM-DD):", currentData.issueDate || newTransactionDate);
            const newIssueQtyString = prompt("Edit Issue Quantity:", currentData.issueQty || "0");
            const newReason = prompt("Edit Issue Reason/Product:", currentData.issueReason || "");

            const newIssueQty = parseInt(newIssueQtyString);
            if (isNaN(newIssueQty) || newIssueQty <= 0) { alert("Issue Quantity must be a positive number. Edit cancelled."); return; }
            if (!newTransactionDate) { alert("Transaction Date cannot be empty. Edit cancelled."); return; }
            if (!newReason || newReason.trim() === "") { alert("Issue Reason cannot be empty. Edit cancelled."); return; }

            const updatedData = {
                ...currentData,
                transactionDate: newTransactionDate,
                issueDate: newIssueDate || newTransactionDate,
                issueQty: newIssueQty,
                issueReason: newReason.trim(),
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
                .then(() => console.log("Manual issue entry updated."))
                .catch(error => { console.error("Error updating entry: ", error); alert('Error updating manual issue entry.'); });
        } else {
            alert("This type of entry cannot be edited here.");
        }
    }

    async function deleteRow(docId, transactionType) {
        if (!activeTableName) return;

        const entryRef = db.ref(`${DATA_PATH}/${activeTableName}/${docId}`);
        const snapshot = await entryRef.once('value');
        const entryData = snapshot.val();

        let message = `Are you sure you want to delete this ${transactionType || 'entry'}?`;
        if (transactionType === 'issue' && entryData && entryData.isAutoIssue) {
             message += "\n\nWARNING: This is an automated production issue. Deleting it here might cause discrepancies with your Production Log. It's generally recommended to manage these through the production system.";
        } else if (transactionType === 'receive' || (transactionType === 'issue' && entryData && !entryData.isAutoIssue)) {
            message += "\n\nThis action will affect subsequent balances and cannot be undone.";
        }

        if (confirm(message)) {
            try {
                await entryRef.remove();
                console.log("Entry deleted.");
                // Data will reload via the 'on' listener, recalculating balances
            }
            catch (error) { console.error("Error deleting entry: ", error); alert('Failed to delete entry.'); }
        }
    }

    function populateAllTablesList() {
        allTablesList.innerHTML = '';
        const searchTerm = searchTableInput.value.toLowerCase();
        const filteredNames = existingTableNames.filter(name => name.toLowerCase().includes(searchTerm));

        if (filteredNames.length === 0) {
            const li = document.createElement('li');
            li.textContent = searchTerm ? 'No tables match your search.' : 'No Packing Material tables found. Click "Add New" to create one.';
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
            selectBtn.innerHTML = '<i class="fas fa-folder-open fa-fw"></i> Open';
            selectBtn.classList.add('btn', 'btn-success', 'btn-sm');
            selectBtn.onclick = () => {
                setActiveTable(tableName);
                loadTableData(tableName); // Load data for the selected table
                // Scroll to the table display smoothly
                if(currentTableDisplay && !currentTableDisplay.classList.contains('hidden')) {
                    window.scrollTo({ top: currentTableDisplay.offsetTop - 80, behavior: 'smooth' });
                }
            };

            const deleteTableBtn = document.createElement('button');
            deleteTableBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete Table';
            deleteTableBtn.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteTableBtn.onclick = (event) => { event.stopPropagation(); deleteEntireTable(tableName); };

            actionsDiv.appendChild(selectBtn);
            actionsDiv.appendChild(deleteTableBtn);
            li.appendChild(actionsDiv);
            allTablesList.appendChild(li);
        });
    }

    async function deleteEntireTable(tableNameToDelete) {
        if (confirm(`WARNING: You are about to delete the ENTIRE table "${tableNameToDelete}" and all its data.\nThis action cannot be undone. Are you absolutely sure?`)) {
            try {
                await db.ref(`${DATA_PATH}/${tableNameToDelete}`).remove();
                await db.ref(`${METADATA_PATH}/${tableNameToDelete}`).remove();

                existingTableNames = existingTableNames.filter(name => name !== tableNameToDelete);
                populateAllTablesList();

                if (activeTableName === tableNameToDelete) {
                    currentTableDisplay.classList.add('hidden');
                    entryFormsContainer.classList.add('hidden');
                    activeTableName = null;
                    currentTableNameDisplay.textContent = '';
                    packingMaterialTableBody.innerHTML = '';
                    currentCalculatedBalanceDisplay.textContent = '0 Pcs/Units';
                    currentTableEntries = [];
                }
                alert(`Table "${tableNameToDelete}" and all its data have been successfully deleted.`);
            } catch (error) {
                console.error(`Error deleting table: ${tableNameToDelete}: `, error);
                alert(`Could not delete table "${tableNameToDelete}". Please check the console for errors.`);
            }
        }
    }

    // --- Event Listeners for Table Actions ---
    if (searchTableInput) searchTableInput.addEventListener('input', populateAllTablesList);

    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            if (activeTableName && currentTableEntries.length > 0) { // Check if there are entries
                // Re-sort and re-render the currently displayed entries
                packingMaterialTableBody.innerHTML = ''; // Clear existing rows
                let currentBalance = 0;
                const sortedEntries = sortEntries([...currentTableEntries], currentSortOrder); // Sort a copy
                currentTableEntries = sortedEntries; // Update the main store with sorted entries

                sortedEntries.forEach(data => {
                    let receiveQty = 0; let issueQty = 0;
                    if (data.transactionType === 'receive' && data.receiveQty) receiveQty = parseInt(data.receiveQty) || 0;
                    else if (data.transactionType === 'issue' && data.issueQty) issueQty = parseInt(data.issueQty) || 0;
                    currentBalance += receiveQty - issueQty;
                    renderRow(data.id, data, currentBalance);
                });
                 // Update overall balance
                const finalBalance = sortedEntries.reduce((acc, entry) => {
                    const RQty = entry.transactionType === 'receive' ? (parseInt(entry.receiveQty) || 0) : 0;
                    const IQty = entry.transactionType === 'issue' ? (parseInt(entry.issueQty) || 0) : 0;
                    return acc + RQty - IQty;
                }, 0);
                currentCalculatedBalanceDisplay.textContent = `${finalBalance} Pcs/Units`;
            } else if (activeTableName && currentTableEntries.length === 0) {
                // If table is active but empty, just ensure display is correct (no rows to sort)
                packingMaterialTableBody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding: 1rem; color: var(--text-color-muted);">No entries. Add a receive or outflow entry.</td></tr>';
                currentCalculatedBalanceDisplay.textContent = `0 Pcs/Units`;
            }
        });
    }


    if (exportToExcelBtn) {
        exportToExcelBtn.addEventListener('click', () => {
            if (!activeTableName || currentTableEntries.length === 0) {
                alert("No data available in the current table to export.");
                return;
            }

            // Sort entries by transaction date and then timestamp for consistent export
            const entriesToExport = sortEntries([...currentTableEntries], 'transactionDate_asc');


            let csvContent = "Transaction Date,Type,Receive Date,Unit Price,Receive Qty,Issue Date,Issue Qty,Reason/Product/Notes,Balance\n";
            let runningBalance = 0;

            entriesToExport.forEach(entry => {
                const type = entry.transactionType === 'receive' ? "IN" : "OUT";
                const receiveDate = entry.transactionType === 'receive' ? (entry.receiveDate || '') : '';
                // **APPLIED FIX HERE**
                const unitPrice = entry.transactionType === 'receive' && typeof entry.receiveUnitPrice === 'number' ? entry.receiveUnitPrice.toFixed(2) : '';
                const receiveQty = entry.transactionType === 'receive' ? (entry.receiveQty || '') : '';
                const issueDate = entry.transactionType === 'issue' ? (entry.issueDate || '') : '';
                const issueQty = entry.transactionType === 'issue' ? (entry.issueQty || '') : '';

                let notesOrReason = '';
                if (entry.transactionType === 'receive') {
                    notesOrReason = entry.receiveNotes || '';
                } else if (entry.transactionType === 'issue') {
                    notesOrReason = entry.issueReason || (entry.isAutoIssue ? 'Production Use (Auto)' : 'Manual Outflow');
                }

                // Recalculate balance for CSV
                const RQtyVal = entry.transactionType === 'receive' ? (parseInt(entry.receiveQty) || 0) : 0;
                const IQtyVal = entry.transactionType === 'issue' ? (parseInt(entry.issueQty) || 0) : 0;
                runningBalance += RQtyVal - IQtyVal;

                const row = [
                    `"${entry.transactionDate || ''}"`,
                    `"${type}"`,
                    `"${receiveDate}"`,
                    `"${unitPrice}"`,
                    `"${receiveQty}"`,
                    `"${issueDate}"`,
                    `"${issueQty}"`,
                    `"${notesOrReason.replace(/"/g, '""')}"`, // Escape double quotes
                    `"${runningBalance}"`
                ].join(",");
                csvContent += row + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `${activeTableName}_inventory_export.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert("CSV export is not supported in your browser.");
            }
        });
    }

    // --- Initial Load ---
    fetchExistingTableNames(); // Fetch and display existing tables on page load
    // Set default transaction dates for forms
    const currentDate = new Date().toISOString().split('T')[0];
    if(document.getElementById('transactionDate')) document.getElementById('transactionDate').value = currentDate;
    if(document.getElementById('outflowTransactionDate')) document.getElementById('outflowTransactionDate').value = currentDate;

});