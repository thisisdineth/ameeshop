// === packing.js ===

document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

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

    const addNewTableBtn = document.getElementById('addNewTableBtn');
    const newTableModal = document.getElementById('newTableModal');
    const closeModalButton = document.querySelector('.modal .modal-close-button');
    const tableNameInput = document.getElementById('tableNameInput');
    const existingTableSuggestions = document.getElementById('existingTableSuggestions');
    const createOrSelectTableBtn = document.getElementById('createOrSelectTableBtn');
    const currentTableDisplay = document.getElementById('currentTableDisplay');
    const currentTableNameDisplay = document.getElementById('currentTableNameDisplay');
    const currentCalculatedBalanceDisplay = document.getElementById('currentCalculatedBalance');
    const packingMaterialTableBody = document.getElementById('packingMaterialTableBody');
    const addRowFormContainer = document.getElementById('addRowFormContainer');
    const addRowForm = document.getElementById('addRowForm');
    const addRowFormTableName = document.getElementById('addRowFormTableName');
    const allTablesList = document.getElementById('allTablesList');
    const searchTableInput = document.getElementById('searchTableInput');

    let activeTableName = null;
    let existingTableNames = [];
    const METADATA_PATH = 'packingMaterialTableMetadata';
    const DATA_PATH = 'packingMaterialTableData';

    if (addNewTableBtn) {
        addNewTableBtn.onclick = () => {
            newTableModal.style.display = 'flex';
            tableNameInput.value = ''; existingTableSuggestions.innerHTML = '';
            fetchExistingTableNames();
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
            existingTableNames = snapshot.val() ? Object.keys(snapshot.val()) : [];
        } catch (error) { console.error("Error fetching packing table names: ", error); existingTableNames = []; }
        populateAllTablesList();
    }

    if (createOrSelectTableBtn) {
        createOrSelectTableBtn.onclick = async () => {
            const tableName = tableNameInput.value.trim();
            if (!tableName) { alert('Table name cannot be empty.'); return; }
            activeTableName = tableName;
            currentTableNameDisplay.textContent = `Inventory: ${tableName}`;
            addRowFormTableName.textContent = tableName;
            currentTableDisplay.classList.remove('hidden');
            addRowFormContainer.classList.remove('hidden');
            newTableModal.style.display = 'none';
            if (!existingTableNames.includes(tableName)) {
                try {
                    await db.ref(`${METADATA_PATH}/${tableName}`).set({ createdAt: firebase.database.ServerValue.TIMESTAMP });
                    existingTableNames.push(tableName); populateAllTablesList();
                } catch (error) { console.error("Error creating packing table metadata: ", error); alert('Error creating table metadata.'); return; }
            }
            loadTableData(tableName);
        };
    }

    async function loadTableData(tableName) {
        if (!tableName || !packingMaterialTableBody) return;
        const dataRef = db.ref(`${DATA_PATH}/${tableName}`).orderByChild('transactionDate');
        dataRef.on('value', snapshot => {
            packingMaterialTableBody.innerHTML = ''; let currentBalance = 0; const entries = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => entries.push({ id: childSnapshot.key, ...childSnapshot.val() }));
                entries.sort((a, b) => {
                    if (a.transactionDate < b.transactionDate) return -1; if (a.transactionDate > b.transactionDate) return 1;
                    return (a.timestamp || 0) - (b.timestamp || 0);
                });
                entries.forEach(data => {
                    let receiveQty = 0; let issueQty = 0;
                    if (data.transactionType === 'receive' && data.receiveQty) receiveQty = parseInt(data.receiveQty) || 0;
                    else if (data.transactionType === 'issue' && data.issueQty) issueQty = parseInt(data.issueQty) || 0;
                    currentBalance += receiveQty - issueQty;
                    renderRow(data.id, data, currentBalance);
                });
            } else {
                const row = packingMaterialTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 10;
                cell.textContent = 'No entries. Add a receive entry.'; cell.style.textAlign = 'center'; cell.style.padding = '1rem'; cell.style.color = 'var(--text-color-muted)';
            }
            currentCalculatedBalanceDisplay.textContent = `${currentBalance} Pcs/Units`;
        });
    }
    
    function renderRow(docId, data, calculatedBalance) {
        const row = packingMaterialTableBody.insertRow(); row.setAttribute('data-id', docId);
        row.insertCell().textContent = data.transactionDate || '';
        const typeCell = row.insertCell(); typeCell.classList.add('text-center');
        if (data.transactionType === 'receive') typeCell.innerHTML = '<span class="badge badge-success">IN</span>';
        else if (data.transactionType === 'issue') typeCell.innerHTML = '<span class="badge badge-danger">OUT</span>';
        else typeCell.textContent = 'N/A';

        row.insertCell().textContent = data.transactionType === 'receive' ? (data.receiveDate || '') : '';
        const unitPriceCell = row.insertCell(); unitPriceCell.textContent = data.transactionType === 'receive' && data.receiveUnitPrice ? parseFloat(data.receiveUnitPrice).toFixed(2) : ''; unitPriceCell.classList.add('text-right');
        const receiveQtyCell = row.insertCell(); receiveQtyCell.textContent = data.transactionType === 'receive' && data.receiveQty ? data.receiveQty : ''; receiveQtyCell.classList.add('text-right');
        row.insertCell().textContent = data.transactionType === 'issue' ? (data.issueDate || '') : '';
        const issueQtyCell = row.insertCell(); issueQtyCell.textContent = data.transactionType === 'issue' && data.issueQty ? data.issueQty : ''; issueQtyCell.classList.add('text-right');
        row.insertCell().textContent = data.transactionType === 'receive' ? (data.receiveNotes || '') : (data.issueReason || 'Production Use');
        const balanceCell = row.insertCell(); balanceCell.textContent = calculatedBalance; balanceCell.classList.add('text-right', 'font-weight-bold');
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i>'; editBtn.title = "Edit"; editBtn.classList.add('btn', 'btn-warning', 'btn-sm'); editBtn.onclick = () => editRow(docId, data);
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>'; deleteBtn.title = "Delete"; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteRow(docId, data.transactionType);
        if (data.transactionType === 'receive') { actionsCell.appendChild(editBtn); actionsCell.appendChild(deleteBtn); }
        else if (data.transactionType === 'issue') { const info = document.createElement('span'); info.innerHTML = '<i class="fas fa-info-circle fa-fw"></i> Auto'; info.title = `Issued for ${data.issueReason || 'production'}. Manage in Production Log.`; info.classList.add('text-muted', 'font-italic', 'text-sm'); actionsCell.appendChild(info); }
    }

    if (addRowForm) {
        addRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) { alert('Select/create a Packing Material table.'); return; }
            const receiveQty = parseInt(document.getElementById('receiveQty').value);
            if (!receiveQty || receiveQty <= 0) { alert('Receive Quantity must be positive.'); document.getElementById('receiveQty').focus(); return; }
            const transactionDate = document.getElementById('transactionDate').value;
            if (!transactionDate) { alert('Transaction Date required.'); document.getElementById('transactionDate').focus(); return; }
            const rowData = {
                transactionDate: transactionDate, transactionType: 'receive',
                receiveDate: document.getElementById('receiveDate').value || transactionDate,
                receiveUnitPrice: parseFloat(document.getElementById('receiveUnitPrice').value) || null,
                receiveQty: receiveQty,
                receiveNotes: document.getElementById('receiveNotes').value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                addRowForm.reset(); document.getElementById('transactionDate').valueAsDate = new Date();
            } catch (error) { console.error("Error adding receive entry: ", error); alert('Error adding entry.'); }
        });
    }

    function editRow(docId, currentData) {
        if (!activeTableName || currentData.transactionType !== 'receive') { alert("Only receive entries can be edited here."); return; }
        const newTransactionDate = prompt("New Transaction Date (YYYY-MM-DD):", currentData.transactionDate); if (newTransactionDate === null) return;
        const newReceiveDate = prompt("New Actual Receive Date (YYYY-MM-DD):", currentData.receiveDate || newTransactionDate);
        const newUnitPrice = parseFloat(prompt("New Unit Price:", currentData.receiveUnitPrice || "0"));
        const newReceiveQty = parseInt(prompt("New Receive Quantity:", currentData.receiveQty || "0"));
        const newNotes = prompt("New Receive Notes:", currentData.receiveNotes || "");
        if (newReceiveQty === null || newReceiveQty <= 0) { alert("Receive Quantity must be positive. Edit cancelled."); return; }
        if (!newTransactionDate) { alert("Transaction Date cannot be empty. Edit cancelled."); return; }
        const updatedData = {
            ...currentData, transactionDate: newTransactionDate, receiveDate: newReceiveDate || newTransactionDate,
            receiveUnitPrice: newUnitPrice || null, receiveQty: newReceiveQty,
            receiveNotes: newNotes !== null ? newNotes.trim() : null, updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
            .then(() => console.log("Receive entry updated."))
            .catch(error => { console.error("Error updating entry: ", error); alert('Error updating entry.'); });
    }

    async function deleteRow(docId, transactionType) {
        if (!activeTableName) return;
        let message = `Delete this ${transactionType || 'entry'}?`;
        if (transactionType === 'issue') message += "\n\nWARNING: This issue was likely from Production. Deleting here will NOT update Production Log and may cause discrepancies.";
        else if (transactionType === 'receive') message += "\n\nThis will affect subsequent balances.";
        if (confirm(message)) {
            try { await db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).remove(); console.log("Entry deleted."); }
            catch (error) { console.error("Error deleting entry: ", error); alert('Error deleting entry.'); }
        }
    }

    function populateAllTablesList() {
        allTablesList.innerHTML = ''; const searchTerm = searchTableInput.value.toLowerCase();
        const filteredNames = existingTableNames.filter(name => name.toLowerCase().includes(searchTerm));
        if (filteredNames.length === 0) { const li = document.createElement('li'); li.textContent = searchTerm ? 'No tables match.' : 'No Packing Material tables.'; li.classList.add('list-item-placeholder'); allTablesList.appendChild(li); return; }
        filteredNames.forEach(tableName => {
            const li = document.createElement('li'); const nameSpan = document.createElement('span'); nameSpan.textContent = tableName; nameSpan.classList.add('item-name'); li.appendChild(nameSpan);
            const actionsDiv = document.createElement('div'); actionsDiv.classList.add('item-actions');
            const selectBtn = document.createElement('button'); selectBtn.innerHTML = '<i class="fas fa-check-circle fa-fw"></i> Select'; selectBtn.classList.add('btn', 'btn-success', 'btn-sm');
            selectBtn.onclick = () => {
                activeTableName = tableName; currentTableNameDisplay.textContent = `Inventory: ${tableName}`; addRowFormTableName.textContent = tableName;
                currentTableDisplay.classList.remove('hidden'); addRowFormContainer.classList.remove('hidden'); loadTableData(tableName);
                if(currentTableDisplay) window.scrollTo({ top: currentTableDisplay.offsetTop - 80, behavior: 'smooth' });
            };
            const deleteTableBtn = document.createElement('button'); deleteTableBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteTableBtn.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteTableBtn.onclick = (event) => { event.stopPropagation(); deleteEntireTable(tableName); };
            actionsDiv.appendChild(selectBtn); actionsDiv.appendChild(deleteTableBtn); li.appendChild(actionsDiv); allTablesList.appendChild(li);
        });
    }

    async function deleteEntireTable(tableNameToDelete) {
        if (confirm(`DELETE TABLE: "${tableNameToDelete}"?\nThis removes all data and cannot be undone.`)) {
            try {
                await db.ref(`${DATA_PATH}/${tableNameToDelete}`).remove(); await db.ref(`${METADATA_PATH}/${tableNameToDelete}`).remove();
                existingTableNames = existingTableNames.filter(name => name !== tableNameToDelete); populateAllTablesList();
                if (activeTableName === tableNameToDelete) {
                    currentTableDisplay.classList.add('hidden'); addRowFormContainer.classList.add('hidden'); activeTableName = null;
                    currentTableNameDisplay.textContent = ''; packingMaterialTableBody.innerHTML = ''; currentCalculatedBalanceDisplay.textContent = '0 Pcs/Units';
                }
                alert(`Table "${tableNameToDelete}" deleted.`);
            } catch (error) { console.error(`Error deleting table: ${tableNameToDelete}: `, error); alert(`Could not delete table.`); }
        }
    }

    if (searchTableInput) searchTableInput.addEventListener('input', populateAllTablesList);
    fetchExistingTableNames();
    document.getElementById('transactionDate').valueAsDate = new Date();
});