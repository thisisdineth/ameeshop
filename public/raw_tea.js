document.addEventListener('DOMContentLoaded', () => {
    // WARNING: Ensure this configuration is correct and secure.
    // Avoid exposing sensitive keys directly in client-side code in production if possible.
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM", // Replace with your actual API key if different
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

    // --- DOM Elements ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

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
    const showAddInflowFormBtn = document.getElementById('showAddInflowFormBtn');
    const transactionDateInput = document.getElementById('transactionDate'); // For inflow

    const manualOutflowFormContainer = document.getElementById('manualOutflowFormContainer');
    const manualOutflowForm = document.getElementById('manualOutflowForm');
    const manualOutflowFormTableName = document.getElementById('manualOutflowFormTableName');
    const showManualOutflowFormBtn = document.getElementById('showManualOutflowFormBtn');
    const outflowDateInput = document.getElementById('outflowDate'); // For manual outflow

    const allTablesList = document.getElementById('allTablesList');
    const searchTableInput = document.getElementById('searchTableInput');

    const inflowBagWeightInput = document.getElementById('inflowBagWeight');
    const inflowBagsInput = document.getElementById('inflowBags');
    const inflowTotalWeightInput = document.getElementById('inflowTotalWeight');

    const sortOrderSelect = document.getElementById('sortOrderSelect');
    const exportToCSVBtn = document.getElementById('exportToCSVBtn');

    // --- Global State ---
    let activeTableName = null;
    let existingTableNames = [];
    let currentSortOrder = 'timestamp_desc'; // Default sort
    let tableDataUnsubscribe = null; // Stores the function to detach the Firebase listener

    const METADATA_PATH = 'rawTeaTableMetadata';
    const DATA_PATH = 'rawTeaTableData';

    // --- Mobile Menu ---
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        mobileMenu.querySelectorAll('a.mobile-navbar-item').forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- Helper Functions ---
    function calculateTotalInflow() {
        if (!inflowBagWeightInput || !inflowBagsInput || !inflowTotalWeightInput) return;
        const bagWeight = parseFloat(inflowBagWeightInput.value) || 0;
        const numBags = parseInt(inflowBagsInput.value) || 0;
        inflowTotalWeightInput.value = (bagWeight * numBags).toFixed(2);
    }

    // --- Modal Management for New Table ---
    if (addNewTableBtn) {
        addNewTableBtn.onclick = () => {
            if (!newTableModal || !tableNameInput || !existingTableSuggestions) return;
            newTableModal.style.display = 'flex';
            tableNameInput.value = '';
            existingTableSuggestions.innerHTML = '';
            // Fetch names to populate suggestions, already done by initial fetchExistingTableNames
        };
    }
    if (closeModalButton) closeModalButton.onclick = () => { if (newTableModal) newTableModal.style.display = 'none'; };
    window.onclick = (event) => {
        if (event.target === newTableModal && newTableModal) newTableModal.style.display = 'none';
    };

    // --- Table Name Suggestions ---
    if (tableNameInput) {
        tableNameInput.addEventListener('input', () => {
            if (!existingTableSuggestions || !Array.isArray(existingTableNames)) return;
            const inputText = tableNameInput.value.toLowerCase();
            existingTableSuggestions.innerHTML = '';
            if (inputText.length > 0) {
                const suggestions = existingTableNames.filter(name => name.toLowerCase().includes(inputText));
                suggestions.forEach(name => {
                    const li = document.createElement('li');
                    li.textContent = name;
                    li.onclick = () => { tableNameInput.value = name; existingTableSuggestions.innerHTML = ''; };
                    existingTableSuggestions.appendChild(li);
                });
            }
        });
    }

    // --- Firebase Operations ---
    async function fetchExistingTableNames() {
        console.log("[Firebase Debug] Fetching existing table names...");
        try {
            const snapshot = await db.ref(METADATA_PATH).once('value');
            if (snapshot.exists()) {
                existingTableNames = Object.keys(snapshot.val());
                console.log("[Firebase Debug] Table names fetched:", existingTableNames);
            } else {
                existingTableNames = [];
                console.log("[Firebase Debug] No table metadata found.");
            }
        } catch (error) {
            console.error("[Firebase Debug] Error fetching Raw Tea table names: ", error);
            existingTableNames = [];
            alert(`Error fetching table list: ${error.message}`);
        }
        populateAllTablesList();
    }

    if (createOrSelectTableBtn) {
        createOrSelectTableBtn.onclick = async () => {
            if (!tableNameInput) return;
            const tableName = tableNameInput.value.trim();
            if (!tableName) {
                alert('Table name cannot be empty.');
                return;
            }

            if (newTableModal) newTableModal.style.display = 'none';

            if (!existingTableNames.includes(tableName)) {
                console.log(`[Firebase Debug] Creating new table metadata for: "${tableName}"`);
                try {
                    await db.ref(`${METADATA_PATH}/${tableName}`).set({ createdAt: firebase.database.ServerValue.TIMESTAMP, name: tableName });
                    existingTableNames.push(tableName);
                    populateAllTablesList(); // Refresh the list
                    console.log(`[Firebase Debug] Metadata created for "${tableName}"`);
                } catch (error) {
                    console.error(`[Firebase Debug] Error creating Raw Tea table metadata for "${tableName}": `, error);
                    alert(`Error creating table metadata: ${error.message}`);
                    return;
                }
            }
            setActiveTable(tableName);
        };
    }

    function setActiveTable(tableName) {
        if (!tableName || typeof tableName !== 'string' || tableName.trim() === '') {
            console.error("[Firebase Debug] setActiveTable called with invalid tableName:", tableName);
            if(currentTableDisplay) currentTableDisplay.classList.add('hidden');
            // Optionally, clear other UI elements or show a global error
            return;
        }
        console.log(`[Firebase Debug] Setting active table to: "${tableName}"`);
        activeTableName = tableName;

        if(currentTableNameDisplay) currentTableNameDisplay.textContent = `Inventory: ${tableName}`;
        if(addRowFormTableName) addRowFormTableName.textContent = tableName;
        if(manualOutflowFormTableName) manualOutflowFormTableName.textContent = tableName;

        if(currentTableDisplay) currentTableDisplay.classList.remove('hidden');
        if(addRowFormContainer) addRowFormContainer.classList.add('hidden'); // Hide forms by default
        if(manualOutflowFormContainer) manualOutflowFormContainer.classList.add('hidden');

        loadTableData(activeTableName);
    }

    async function loadTableData(tableName) {
        if (!tableName || typeof tableName !== 'string' || tableName.trim() === '') {
            console.error("[Firebase Debug] loadTableData ABORTED: Invalid tableName received:", tableName);
            if(rawTeaTableBody) rawTeaTableBody.innerHTML = '<tr><td colspan="11" class="text-center text-danger">Error: Invalid table context.</td></tr>';
            if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = 'Error Kg';
            return;
        }

        console.log(`[Firebase Debug] loadTableData START for table: "${tableName}". Current sort: ${currentSortOrder}. SDK Version: ${firebase.SDK_VERSION}`);

        if (tableDataUnsubscribe) {
            if (typeof tableDataUnsubscribe === 'function') {
                const oldPath = tableDataUnsubscribe.path ? tableDataUnsubscribe.path.toString() : "unknown (listener had no custom path property)";
                console.log(`[Firebase Debug] Detaching previous listener. Old path (approx): ${oldPath}`);
                try {
                    tableDataUnsubscribe();
                } catch (e) {
                    console.error("[Firebase Debug] Error while detaching previous listener:", e);
                }
            } else {
                console.warn("[Firebase Debug] tableDataUnsubscribe was not a function during detach attempt:", tableDataUnsubscribe);
            }
            tableDataUnsubscribe = null;
        }

        const dataRef = db.ref(`${DATA_PATH}/${tableName}`);
        const currentPathString = dataRef.toString();
        console.log(`[Firebase Debug] Attaching new listener to Firebase path: ${currentPathString}`);

        if (rawTeaTableBody) rawTeaTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:1rem;">Loading data...</td></tr>';
        if (currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = 'Loading...';

        tableDataUnsubscribe = dataRef.on('value',
            (snapshot) => { // SUCCESS CALLBACK
                console.log(`[Firebase Debug] 'value' event SUCCESS callback triggered for: ${currentPathString}.`);
                console.log("[Firebase Debug] Received snapshot object:", snapshot);

                if (snapshot === undefined) {
                    console.error(`[Firebase Debug] CRITICAL: Snapshot received as UNDEFINED for table: "${tableName}". Path: ${currentPathString}`);
                    if(rawTeaTableBody) rawTeaTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Error: Data snapshot is undefined for table "${tableName}". Please check console.</td></tr>`;
                    if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = 'Error Kg';
                    return;
                }

                if (typeof snapshot.exists !== 'function') {
                    console.error(`[Firebase Debug] CRITICAL: Received object is NOT a valid Firebase DataSnapshot for table: "${tableName}". Path: ${currentPathString}. Object type: ${typeof snapshot}, Object value:`, snapshot);
                    if(rawTeaTableBody) rawTeaTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Error: Invalid data structure received for table "${tableName}". Please check console.</td></tr>`;
                    if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = 'Error Kg';
                    return;
                }

                console.log(`[Firebase Debug] Snapshot for "${tableName}" is a valid DataSnapshot. Calling snapshot.exists().`);
                if(rawTeaTableBody) rawTeaTableBody.innerHTML = '';
                let finalBalanceForDisplay = 0;
                const entries = [];

                if (snapshot.exists()) {
                    console.log(`[Firebase Debug] Snapshot EXISTS for "${tableName}". Number of children: ${snapshot.numChildren()}`);
                    snapshot.forEach(childSnapshot => {
                        entries.push({ id: childSnapshot.key, ...childSnapshot.val() });
                    });

                    const chronoSortedForBalance = [...entries].sort((a, b) => {
                        const dateA = new Date(a.transactionDate ? a.transactionDate + 'T00:00:00' : 0).getTime();
                        const dateB = new Date(b.transactionDate ? b.transactionDate + 'T00:00:00' : 0).getTime();
                        const timeA = a.timestamp || 0;
                        const timeB = b.timestamp || 0;
                        if (dateA < dateB) return -1; if (dateA > dateB) return 1;
                        return timeA - timeB;
                    });

                    const balancesMap = new Map();
                    let runningBalance = 0;
                    chronoSortedForBalance.forEach(entry => {
                        let inflowQty = parseFloat(entry.inflowTotalWeight) || 0;
                        let outflowQty = parseFloat(entry.outflowWeight) || 0;
                        if (entry.transactionType !== 'inflow') inflowQty = 0; // ensure only inflows add to inflowQty
                        if (entry.transactionType !== 'outflow') outflowQty = 0; // ensure only outflows add to outflowQty

                        runningBalance += inflowQty - outflowQty;
                        balancesMap.set(entry.id, runningBalance);
                    });
                    finalBalanceForDisplay = runningBalance;

                    entries.sort((a, b) => {
                        const dateA = new Date(a.transactionDate ? a.transactionDate + 'T00:00:00' : 0).getTime();
                        const dateB = new Date(b.transactionDate ? b.transactionDate + 'T00:00:00' : 0).getTime();
                        const timeA = a.timestamp || 0;
                        const timeB = b.timestamp || 0;
                        switch (currentSortOrder) {
                            case 'date_asc': return dateA - dateB || timeA - timeB;
                            case 'date_desc': return dateB - dateA || timeB - timeA;
                            case 'timestamp_asc': return timeA - timeB || dateA - dateB;
                            case 'timestamp_desc': default: return timeB - timeA || dateB - dateA;
                        }
                    });

                    if(rawTeaTableBody) entries.forEach(data => renderRow(data.id, data, balancesMap.get(data.id)));

                } else {
                    console.log(`[Firebase Debug] Snapshot does NOT exist for "${tableName}".`);
                    if(rawTeaTableBody){
                        const row = rawTeaTableBody.insertRow();
                        const cell = row.insertCell(); cell.colSpan = 11;
                        cell.textContent = 'No entries yet. Add an inflow or manual outflow.';
                        Object.assign(cell.style, {textAlign: 'center', padding: '1rem', color: 'var(--text-color-muted)'});
                    }
                    finalBalanceForDisplay = 0;
                }
                if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = `${finalBalanceForDisplay.toFixed(2)} Kg`;
                console.log(`[Firebase Debug] loadTableData successfully processed for "${tableName}".`);

            },
            (errorObject) => { // ERROR CALLBACK
                console.error(`[Firebase Debug] Firebase listener ERROR callback for: ${currentPathString}. Error:`, errorObject);
                if(rawTeaTableBody) rawTeaTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Error loading data: ${errorObject.message || 'Unknown Firebase error'}</td></tr>`;
                if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = 'Error Kg';
                if (tableDataUnsubscribe && typeof tableDataUnsubscribe === 'function') {
                    console.log("[Firebase Debug] Detaching listener due to Firebase error.");
                    tableDataUnsubscribe();
                    tableDataUnsubscribe = null;
                }
            }
        );
        if (tableDataUnsubscribe && typeof tableDataUnsubscribe === 'function') {
            tableDataUnsubscribe.path = dataRef; // Custom property for debugging
        }
        console.log(`[Firebase Debug] Listener attached for ${currentPathString}. tableDataUnsubscribe type: ${typeof tableDataUnsubscribe}`);
    }

    function renderRow(docId, data, calculatedBalance) {
        if (!rawTeaTableBody) return;
        const row = rawTeaTableBody.insertRow();
        row.setAttribute('data-id', docId);

        let displayDate = 'N/A';
        if (data.transactionDate) {
            try {
                displayDate = new Date(data.transactionDate + 'T00:00:00').toLocaleDateString(navigator.language || 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) { displayDate = data.transactionDate; } // Fallback to raw date if parsing fails
        }
        row.insertCell().textContent = displayDate;

        const typeCell = row.insertCell(); typeCell.classList.add('text-center');
        if (data.transactionType === 'inflow') typeCell.innerHTML = '<span class="badge badge-success">IN</span>';
        else if (data.transactionType === 'outflow') typeCell.innerHTML = '<span class="badge badge-danger">OUT</span>';
        else typeCell.textContent = 'N/A';

        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowSupplier || 'N/A') : (data.isManualOutflow ? (data.outflowReason || 'Manual Outflow') : (data.outflowProduct || 'Production'));
        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowEstate || 'N/A') : (data.isManualOutflow ? (data.outflowNotes || '') : (data.outflowNotes && data.outflowNotes.includes("Prod ID") ? 'Production Details' : (data.outflowEstate ||'N/A')));
        row.insertCell().textContent = data.transactionType === 'inflow' ? (data.inflowGrade || 'N/A') : (data.isManualOutflow ? '' : (data.outflowNotes && data.outflowNotes.includes("Prod ID") ? '' : (data.outflowGrade ||'N/A')));

        const bagWtCell = row.insertCell(); bagWtCell.textContent = data.transactionType === 'inflow' ? (data.inflowBagWeight || '') : ''; bagWtCell.classList.add('text-right');
        const bagsCell = row.insertCell(); bagsCell.textContent = data.transactionType === 'inflow' ? (data.inflowBags || '') : ''; bagsCell.classList.add('text-right');
        const inflowCell = row.insertCell(); inflowCell.textContent = (data.transactionType === 'inflow' && data.inflowTotalWeight) ? parseFloat(data.inflowTotalWeight).toFixed(2) : '0.00'; inflowCell.classList.add('text-right', 'text-success');
        const outflowCell = row.insertCell(); outflowCell.textContent = (data.transactionType === 'outflow' && data.outflowWeight) ? parseFloat(data.outflowWeight).toFixed(2) : '0.00'; outflowCell.classList.add('text-right', 'text-danger');
        const balanceCell = row.insertCell(); balanceCell.textContent = calculatedBalance.toFixed(2); balanceCell.classList.add('text-right', 'font-weight-bold');

        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        if (data.transactionType === 'inflow') {
            const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i>'; editBtn.title = "Edit Inflow"; editBtn.classList.add('btn', 'btn-warning', 'btn-sm'); editBtn.onclick = () => editInflowRow(docId, data);
            const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>'; deleteBtn.title = "Delete Inflow"; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteRow(docId, 'inflow');
            actionsCell.append(editBtn, deleteBtn);
        } else if (data.transactionType === 'outflow') {
            if (data.isManualOutflow) {
                const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i>'; editBtn.title = "Edit Manual Outflow"; editBtn.classList.add('btn', 'btn-warning', 'btn-sm'); editBtn.onclick = () => editManualOutflowRow(docId, data);
                const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>'; deleteBtn.title = "Delete Manual Outflow"; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteRow(docId, 'manual outflow');
                actionsCell.append(editBtn, deleteBtn);
            } else {
                const info = document.createElement('span'); info.innerHTML = '<i class="fas fa-info-circle fa-fw"></i> Auto'; info.title = `Outflow for ${data.outflowProduct || 'production'}. Manage in Production Log.`; info.classList.add('text-muted', 'font-italic', 'text-sm'); actionsCell.appendChild(info);
            }
        }
    }

    // --- Form Toggles & Event Listeners for Forms ---
    if (showAddInflowFormBtn) {
        showAddInflowFormBtn.onclick = () => {
            if(addRowFormContainer) addRowFormContainer.classList.toggle('hidden');
            if(manualOutflowFormContainer) manualOutflowFormContainer.classList.add('hidden');
            if (transactionDateInput && addRowFormContainer && !addRowFormContainer.classList.contains('hidden')) {
                 transactionDateInput.valueAsDate = new Date();
                 calculateTotalInflow();
            }
        }
    }
    if (showManualOutflowFormBtn) {
        showManualOutflowFormBtn.onclick = () => {
            if(manualOutflowFormContainer) manualOutflowFormContainer.classList.toggle('hidden');
            if(addRowFormContainer) addRowFormContainer.classList.add('hidden');
            if (outflowDateInput && manualOutflowFormContainer && !manualOutflowFormContainer.classList.contains('hidden')) {
                outflowDateInput.valueAsDate = new Date();
            }
        }
    }

    if (addRowForm) {
        addRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) { alert('Please select or create a Raw Tea table first.'); return; }
            if (!transactionDateInput || !document.getElementById('inflowSupplier') || !document.getElementById('inflowEstate') || !document.getElementById('inflowGrade') || !inflowBagWeightInput || !inflowBagsInput || !inflowTotalWeightInput || !document.getElementById('inflowNotes')) return; // Defensive check

            const transactionDateVal = transactionDateInput.value;
            if (!transactionDateVal) { alert('Inflow Date is required.'); transactionDateInput.focus(); return; }

            const totalWeight = parseFloat(inflowTotalWeightInput.value) || 0;
            // Basic validation: if bag details are entered, total weight should ideally be > 0
            // This can be made more stringent if needed.
            if (totalWeight <= 0 && (parseFloat(inflowBagWeightInput.value) > 0 || parseInt(inflowBagsInput.value) > 0)) {
                alert('If Bag Weight or Number of Bags are entered, the Total Inflow Weight should typically be greater than zero.');
                 // inflowTotalWeightInput.focus(); // Optional: focus on the field
                 // return; // Optional: make this a hard stop
            }


            const rowData = {
                transactionDate: transactionDateVal, transactionType: 'inflow',
                inflowSupplier: document.getElementById('inflowSupplier').value.trim() || null,
                inflowEstate: document.getElementById('inflowEstate').value.trim() || null,
                inflowGrade: document.getElementById('inflowGrade').value.trim() || null,
                inflowBagWeight: parseFloat(inflowBagWeightInput.value) || null,
                inflowBags: parseInt(inflowBagsInput.value) || null,
                inflowTotalWeight: totalWeight,
                inflowNotes: document.getElementById('inflowNotes').value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            console.log("[Firebase Debug] Adding inflow:", rowData);
            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                addRowForm.reset();
                transactionDateInput.valueAsDate = new Date();
                calculateTotalInflow();
                if(addRowFormContainer) addRowFormContainer.classList.add('hidden');
            } catch (error) { console.error("[Firebase Debug] Error adding new inflow: ", error); alert(`Error adding inflow: ${error.message}`); }
        });
    }

    if (manualOutflowForm) {
        manualOutflowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) { alert('Please select or create a Raw Tea table first.'); return; }
            if (!outflowDateInput || !document.getElementById('outflowReason') || !document.getElementById('outflowWeight') || !document.getElementById('outflowNotes')) return;

            const transactionDateVal = outflowDateInput.value;
            if (!transactionDateVal) { alert('Outflow Date is required.'); outflowDateInput.focus(); return; }
            const outflowReason = document.getElementById('outflowReason').value.trim();
            if (!outflowReason) { alert('Reason for outflow is required.'); document.getElementById('outflowReason').focus(); return; }
            const outflowWeight = parseFloat(document.getElementById('outflowWeight').value) || 0;
            if (outflowWeight <= 0) { alert('Outflow weight must be greater than zero.'); document.getElementById('outflowWeight').focus(); return; }

            const rowData = {
                transactionDate: transactionDateVal, transactionType: 'outflow', isManualOutflow: true,
                outflowReason: outflowReason, outflowWeight: outflowWeight,
                outflowNotes: document.getElementById('outflowNotes').value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            console.log("[Firebase Debug] Adding manual outflow:", rowData);
            try {
                await db.ref(`${DATA_PATH}/${activeTableName}`).push().set(rowData);
                manualOutflowForm.reset();
                outflowDateInput.valueAsDate = new Date();
                if(manualOutflowFormContainer) manualOutflowFormContainer.classList.add('hidden');
            } catch (error) { console.error("[Firebase Debug] Error recording manual outflow: ", error); alert(`Error recording outflow: ${error.message}`); }
        });
    }

    // --- Edit and Delete Row Logic ---
    function editInflowRow(docId, currentData) {
        if (!activeTableName || currentData.transactionType !== 'inflow') { alert("This function is for editing inflow entries."); return; }

        const newDate = prompt("Enter new Inflow Date (YYYY-MM-DD):", currentData.transactionDate || new Date().toISOString().split('T')[0]); if (newDate === null) return;
        const newSupplier = prompt("Enter new Supplier:", currentData.inflowSupplier || "");
        const newEstate = prompt("Enter new Estate:", currentData.inflowEstate || "");
        const newGrade = prompt("Enter new Grade:", currentData.inflowGrade || "");
        const newBagWeightStr = prompt("Enter new Bag Weight (Kg):", currentData.inflowBagWeight || "0");
        const newBagsStr = prompt("Enter new Number of Bags:", currentData.inflowBags || "0");
        const newNotes = prompt("Enter new Notes:", currentData.inflowNotes || "");

        const newBagWeight = parseFloat(newBagWeightStr);
        const newBags = parseInt(newBagsStr);

        if (isNaN(newBagWeight) || newBagWeight < 0 || isNaN(newBags) || newBags < 0) { alert("Invalid number for Bag Weight or Number of Bags. Must be non-negative."); return;}

        const totalWeight = (newBagWeight || 0) * (newBags || 0);
        // Add validation for totalWeight if needed, e.g., if (totalWeight <= 0 && (newBagWeight > 0 || newBags > 0)) ...

        const updatedData = {
            ...currentData, transactionDate: newDate,
            inflowSupplier: newSupplier !== null ? newSupplier.trim() : null,
            inflowEstate: newEstate !== null ? newEstate.trim() : null,
            inflowGrade: newGrade !== null ? newGrade.trim() : null,
            inflowBagWeight: newBagWeight, inflowBags: newBags,
            inflowTotalWeight: parseFloat(totalWeight.toFixed(2)),
            inflowNotes: newNotes !== null ? newNotes.trim() : null,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        console.log("[Firebase Debug] Updating inflow:", docId, updatedData);
        db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
            .then(() => console.log("[Firebase Debug] Inflow entry updated."))
            .catch(error => { console.error("[Firebase Debug] Error updating inflow: ", error); alert(`Error updating entry: ${error.message}`); });
    }

    function editManualOutflowRow(docId, currentData) {
        if (!activeTableName || !currentData.isManualOutflow) { alert("This function is for editing manual outflow entries."); return; }

        const newDate = prompt("Enter new Outflow Date (YYYY-MM-DD):", currentData.transactionDate || new Date().toISOString().split('T')[0]); if (newDate === null) return;
        const newReason = prompt("Enter new Reason for Outflow:", currentData.outflowReason || ""); if (newReason === null) return;
        const newWeightStr = prompt("Enter new Outflow Weight (Kg):", currentData.outflowWeight || "0");
        const newNotes = prompt("Enter new Notes:", currentData.outflowNotes || "");

        const newWeight = parseFloat(newWeightStr);
        if (isNaN(newWeight) || newWeight <= 0) {alert("Invalid or non-positive weight."); return;}

        const updatedData = {
            ...currentData, transactionDate: newDate,
            outflowReason: newReason.trim(), outflowWeight: newWeight,
            outflowNotes: newNotes !== null ? newNotes.trim() : null,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
        console.log("[Firebase Debug] Updating manual outflow:", docId, updatedData);
        db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).update(updatedData)
            .then(() => console.log("[Firebase Debug] Manual outflow entry updated."))
            .catch(error => { console.error("[Firebase Debug] Error updating manual outflow: ", error); alert(`Error updating entry: ${error.message}`); });
    }

    async function deleteRow(docId, entryType) {
        if (!activeTableName) return;
        let message = `Are you sure you want to delete this ${entryType}? This action cannot be undone.`;
        if (entryType === 'inflow' || entryType === 'manual outflow') message += "\n\nThis will affect subsequent balances.";

        if (confirm(message)) {
            console.log(`[Firebase Debug] Deleting ${entryType}:`, docId);
            try {
                await db.ref(`${DATA_PATH}/${activeTableName}/${docId}`).remove();
                console.log(`[Firebase Debug] ${entryType} deleted successfully.`);
            } catch (error) {
                console.error(`[Firebase Debug] Error deleting ${entryType}: `, error);
                alert(`Error deleting ${entryType}: ${error.message}`);
            }
        }
    }

    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            if (activeTableName && typeof activeTableName === 'string' && activeTableName.trim() !== '') {
                console.log(`[Firebase Debug] Sort order changed to ${currentSortOrder}. Reloading data for ${activeTableName}.`);
                loadTableData(activeTableName);
            } else {
                console.warn("[Firebase Debug] Sort order changed, but activeTableName is invalid or not set:", activeTableName);
            }
        });
    }

    if (exportToCSVBtn) {
        exportToCSVBtn.onclick = () => {
            if (!activeTableName) { alert("Please select a table to export."); return; }
            exportTableToCSV(activeTableName);
        };
    }

    function exportTableToCSV(tableName) {
        console.log(`[Firebase Debug] Exporting table "${tableName}" to CSV.`);
        const table = document.getElementById('rawTeaTable');
        if (!table) {
            alert("Table not found for export.");
            return;
        }

        let csv = [];
        const headers = Array.from(table.querySelectorAll('thead th'))
                             .map(th => th.textContent.trim())
                             .filter(header => header !== 'Actions'); // Exclude the 'Actions' column

        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            str = String(str).replace(/\s+/g, ' ').trim(); // Normalize whitespace
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        csv.push(headers.map(escapeCSV).join(','));

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');

            // Check if it's the "No entries yet" placeholder row
            if (cells.length === 1 && cells[0].colSpan === 11) {
                return; // Skip this row
            }

            // Iterate over cells but exclude the last one which is 'Actions'
            for (let i = 0; i < cells.length; i++) {
                if (i === cells.length - 1 && cells[i].classList.contains('actions')) {
                    continue; // Skip the actions column
                }
                let cellText = cells[i].textContent.trim();

                // Handle badge text specifically (e.g., IN/OUT)
                const badge = cells[i].querySelector('.badge');
                if (badge) {
                    cellText = badge.textContent.trim();
                }

                rowData.push(escapeCSV(cellText));
            }
            csv.push(rowData.join(','));
        });

        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${tableName.replace(/[^a-z0-9_.-]/gi, '_')}_inventory_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log(`[Firebase Debug] CSV export for "${tableName}" initiated.`);
        } else {
            alert("CSV export is not supported in your browser.");
            console.warn("[Firebase Debug] CSV export not supported by browser.");
        }
    }


    function populateAllTablesList() {
        if (!allTablesList || !searchTableInput) return;
        allTablesList.innerHTML = '';
        const searchTerm = searchTableInput.value.toLowerCase();
        const filteredNames = existingTableNames.filter(name => name.toLowerCase().includes(searchTerm));

        if (filteredNames.length === 0) {
            const li = document.createElement('li');
            li.textContent = searchTerm ? 'No tables match your search.' : 'No Raw Tea tables created yet. Click "Add New Raw Tea Table" to start.';
            li.classList.add('list-item-placeholder');
            allTablesList.appendChild(li);
            return;
        }

        filteredNames.sort((a,b) => a.localeCompare(b));
        filteredNames.forEach(tableName => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span'); nameSpan.textContent = tableName; nameSpan.classList.add('item-name'); li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div'); actionsDiv.classList.add('item-actions');
            const selectBtn = document.createElement('button'); selectBtn.innerHTML = '<i class="fas fa-check-circle fa-fw"></i> Select'; selectBtn.classList.add('btn', 'btn-success', 'btn-sm');
            selectBtn.onclick = () => {
                setActiveTable(tableName);
                if(currentTableDisplay && !currentTableDisplay.classList.contains('hidden')) {
                     window.scrollTo({ top: currentTableDisplay.offsetTop - 80, behavior: 'smooth' });
                }
            };
            const deleteTableBtn = document.createElement('button'); deleteTableBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete Table'; deleteTableBtn.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteTableBtn.onclick = (event) => { event.stopPropagation(); deleteEntireTable(tableName); };

            actionsDiv.append(selectBtn, deleteTableBtn);
            li.appendChild(actionsDiv);
            allTablesList.appendChild(li);
        });
    }

    async function deleteEntireTable(tableNameToDelete) {
        if (!tableNameToDelete) return;
        if (confirm(`DELETE TABLE: "${tableNameToDelete}"?\nThis permanently removes all its data and metadata. This action cannot be undone.`)) {
            console.log(`[Firebase Debug] Attempting to delete table: "${tableNameToDelete}"`);
            try {
                await db.ref(`${DATA_PATH}/${tableNameToDelete}`).remove();
                console.log(`[Firebase Debug] Data for table "${tableNameToDelete}" deleted.`);
                await db.ref(`${METADATA_PATH}/${tableNameToDelete}`).remove();
                console.log(`[Firebase Debug] Metadata for table "${tableNameToDelete}" deleted.`);

                existingTableNames = existingTableNames.filter(name => name !== tableNameToDelete);
                populateAllTablesList();

                if (activeTableName === tableNameToDelete) {
                    console.log(`[Firebase Debug] Active table "${activeTableName}" was deleted. Resetting UI.`);
                    if(currentTableDisplay) currentTableDisplay.classList.add('hidden');
                    if(addRowFormContainer) addRowFormContainer.classList.add('hidden');
                    if(manualOutflowFormContainer) manualOutflowFormContainer.classList.add('hidden');
                    activeTableName = null;
                    if(currentTableNameDisplay) currentTableNameDisplay.textContent = '';
                    if(rawTeaTableBody) rawTeaTableBody.innerHTML = '';
                    if(currentCalculatedBalanceDisplay) currentCalculatedBalanceDisplay.textContent = '0.00 Kg';
                    if(tableDataUnsubscribe && typeof tableDataUnsubscribe === 'function') {
                        tableDataUnsubscribe();
                        tableDataUnsubscribe = null;
                    }
                }
                alert(`Table "${tableNameToDelete}" and all its data have been deleted successfully.`);
            } catch (error) {
                console.error(`[Firebase Debug] Error deleting table "${tableNameToDelete}": `, error);
                alert(`Could not delete table "${tableNameToDelete}". Error: ${error.message}`);
            }
        }
    }

    if (searchTableInput) searchTableInput.addEventListener('input', populateAllTablesList);

    // --- Initial Setup ---
    console.log("[Firebase Debug] DOMContentLoaded. Initializing page...");
    fetchExistingTableNames();
    if (transactionDateInput) transactionDateInput.valueAsDate = new Date();
    if (outflowDateInput) outflowDateInput.valueAsDate = new Date();
    calculateTotalInflow();
    if (inflowBagWeightInput) inflowBagWeightInput.addEventListener('input', calculateTotalInflow);
    if (inflowBagsInput) inflowBagsInput.addEventListener('input', calculateTotalInflow);

    console.log("[Firebase Debug] Page initialization complete.");
});