// === production.js ===

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

    const logProductionForm = document.getElementById('logProductionForm');
    const productionDateInput = document.getElementById('productionDate');
    const batchNumberInput = document.getElementById('batchNumber');
    const finishedProductNameInput = document.getElementById('finishedProductName');
    const finishedProductCodeInput = document.getElementById('finishedProductCode');
    const quantityProducedInput = document.getElementById('quantityProduced');
    const rawMaterialsConsumedContainer = document.getElementById('rawMaterialsConsumedContainer');
    const addRawMaterialButton = document.getElementById('addRawMaterialButton');
    const packingMaterialsConsumedContainer = document.getElementById('packingMaterialsConsumedContainer');
    const addPackingMaterialButton = document.getElementById('addPackingMaterialButton');
    const productionNotesInput = document.getElementById('productionNotes');
    const productionLogTableBody = document.getElementById('productionLogTableBody');

    const PRODUCTION_LOG_PATH = 'productionLog';
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata'; // From raw_tea.js
    const RAW_TEA_DATA_PATH = 'rawTeaTableData';         // From raw_tea.js
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata'; // From packing.js
    const PACKING_MATERIAL_DATA_PATH = 'packingMaterialTableData';       // From packing.js

    let rawMaterialTableNames = []; // Store fetched raw tea table names
    let packingMaterialTableNames = []; // Store fetched packing material table names

    async function fetchTableNamesForSelect(metadataPath, targetArray) {
        try {
            const snapshot = await db.ref(metadataPath).once('value');
            const data = snapshot.val();
            targetArray.length = 0; // Clear array before pushing
            if (data) {
                targetArray.push(...Object.keys(data));
            }
             console.log(`Workspaceed for ${metadataPath}:`, targetArray); // Debug
        } catch (error) {
            console.error(`Error fetching from ${metadataPath}:`, error);
            targetArray.length = 0;
        }
    }

    function createMaterialSelectElement(optionsArray, selectClassName, placeholderText) {
        const select = document.createElement('select');
        select.classList.add('form-input', selectClassName);
        select.required = true;
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = placeholderText || "-- Select Table --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        optionsArray.forEach(name => {
            const option = document.createElement('option');
            option.value = name; option.textContent = name;
            select.appendChild(option);
        });
        return select;
    }

    function addRawMaterialEntryUI() {
        if (rawMaterialTableNames.length === 0) {
            alert("No Raw Tea tables found. Please create Raw Tea tables first.");
            return;
        }
        const entryDiv = document.createElement('div'); entryDiv.classList.add('consumed-material-entry');
        const selectGroup = document.createElement('div'); selectGroup.classList.add('form-group');
        const teaSelect = createMaterialSelectElement(rawMaterialTableNames, 'raw-tea-table-select', '-- Select Raw Tea Table --');
        selectGroup.appendChild(teaSelect);
        const qtyGroup = document.createElement('div'); qtyGroup.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.step = 'any'; qtyInput.classList.add('form-input', 'raw-tea-qty'); qtyInput.placeholder = 'Qty Used'; qtyInput.required = true;
        qtyGroup.appendChild(qtyInput);
        const unitGroup = document.createElement('div'); unitGroup.classList.add('form-group');
        const unitInput = document.createElement('input'); unitInput.type = 'text'; unitInput.classList.add('form-input', 'raw-tea-unit'); unitInput.placeholder = 'Unit (e.g., Kg)'; unitInput.value = "Kg"; unitInput.required = true;
        unitGroup.appendChild(unitInput);
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item'); removeBtn.title = "Remove"; removeBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(selectGroup); entryDiv.appendChild(qtyGroup); entryDiv.appendChild(unitGroup); entryDiv.appendChild(removeBtn);
        rawMaterialsConsumedContainer.appendChild(entryDiv);
    }

    function addPackingMaterialEntryUI() {
        if (packingMaterialTableNames.length === 0) {
            alert("No Packing Material tables found. Please create Packing Material tables first.");
            return;
        }
        const entryDiv = document.createElement('div'); entryDiv.classList.add('consumed-material-entry');
        const selectGroup = document.createElement('div'); selectGroup.classList.add('form-group');
        const packingSelect = createMaterialSelectElement(packingMaterialTableNames, 'packing-material-table-select', '-- Select Packing Table --');
        selectGroup.appendChild(packingSelect);
        const qtyGroup = document.createElement('div'); qtyGroup.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.step = '1'; qtyInput.classList.add('form-input', 'packing-material-qty'); qtyInput.placeholder = 'Qty Used'; qtyInput.required = true;
        qtyGroup.appendChild(qtyInput);
        const unitGroup = document.createElement('div'); unitGroup.classList.add('form-group');
        const unitInput = document.createElement('input'); unitInput.type = 'text'; unitInput.classList.add('form-input', 'packing-material-unit'); unitInput.placeholder = 'Unit (e.g., Pcs)'; unitInput.value = "Pcs"; unitInput.required = true;
        unitGroup.appendChild(unitInput);
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item'); removeBtn.title = "Remove"; removeBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(selectGroup); entryDiv.appendChild(qtyGroup); entryDiv.appendChild(unitGroup); entryDiv.appendChild(removeBtn);
        packingMaterialsConsumedContainer.appendChild(entryDiv);
    }

    if (addRawMaterialButton) addRawMaterialButton.addEventListener('click', addRawMaterialEntryUI);
    if (addPackingMaterialButton) addPackingMaterialButton.addEventListener('click', addPackingMaterialEntryUI);

    if (logProductionForm) {
        logProductionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const today = new Date().toISOString().split('T')[0];
            const productionEntry = {
                productionDate: productionDateInput.value || today,
                batchNumber: batchNumberInput.value.trim() || null,
                finishedProductName: finishedProductNameInput.value.trim(),
                finishedProductCode: finishedProductCodeInput.value.trim(),
                quantityProduced: parseInt(quantityProducedInput.value),
                rawMaterialsConsumed: [], packingMaterialConsumed: [],
                notes: productionNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP // For main production log entry
            };
            if (!productionEntry.productionDate || !productionEntry.finishedProductName || !productionEntry.finishedProductCode || !productionEntry.quantityProduced) {
                alert("Fill required production details (Date, Product Name, Code, Quantity)."); return;
            }

            document.querySelectorAll('#rawMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.raw-tea-table-select').value;
                const quantityUsed = parseFloat(entry.querySelector('.raw-tea-qty').value);
                const unit = entry.querySelector('.raw-tea-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) productionEntry.rawMaterialsConsumed.push({ rawTeaTableName: tableName, quantityUsed, unit });
            });
            document.querySelectorAll('#packingMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.packing-material-table-select').value;
                const quantityUsed = parseInt(entry.querySelector('.packing-material-qty').value);
                const unit = entry.querySelector('.packing-material-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) productionEntry.packingMaterialConsumed.push({ packingMaterialTableName: tableName, quantityUsed, unit });
            });
            if (productionEntry.rawMaterialsConsumed.length === 0 && productionEntry.packingMaterialConsumed.length === 0) {
                if (!confirm("No materials specified. Log production anyway?")) return;
            }

            const productionTimestamp = firebase.database.ServerValue.TIMESTAMP; // Use a single timestamp for all related entries

            try {
                const newProductionRef = db.ref(PRODUCTION_LOG_PATH).push();
                const productionLogId = newProductionRef.key;
                productionEntry.productionLogId = productionLogId; // Add ID to the log itself for reference
                
                // Use a multi-path update to try and make operations more atomic
                const updates = {};
                updates[`${PRODUCTION_LOG_PATH}/${productionLogId}`] = productionEntry;

                for (const material of productionEntry.rawMaterialsConsumed) {
                    const outflowEntry = {
                        transactionDate: productionEntry.productionDate,
                        transactionType: 'outflow',
                        outflowProduct: productionEntry.finishedProductName,
                        outflowWeight: material.quantityUsed,
                        outflowNotes: `Prod. ID: ${productionLogId}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                        timestamp: productionTimestamp // Consistent timestamp
                    };
                    const outflowKey = db.ref(`${RAW_TEA_DATA_PATH}/${material.rawTeaTableName}`).push().key;
                    updates[`${RAW_TEA_DATA_PATH}/${material.rawTeaTableName}/${outflowKey}`] = outflowEntry;
                }
                for (const material of productionEntry.packingMaterialConsumed) {
                    const issueEntry = {
                        transactionDate: productionEntry.productionDate,
                        transactionType: 'issue',
                        issueDate: productionEntry.productionDate, // For packing.js compatibility
                        issueQty: material.quantityUsed,
                        issueReason: `Prod. ID: ${productionLogId}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                        timestamp: productionTimestamp // Consistent timestamp
                    };
                    const issueKey = db.ref(`${PACKING_MATERIAL_DATA_PATH}/${material.packingMaterialTableName}`).push().key;
                    updates[`${PACKING_MATERIAL_DATA_PATH}/${material.packingMaterialTableName}/${issueKey}`] = issueEntry;
                }

                await db.ref().update(updates);

                alert("Production logged and inventories updated!");
                logProductionForm.reset();
                rawMaterialsConsumedContainer.innerHTML = ''; packingMaterialsConsumedContainer.innerHTML = '';
                productionDateInput.valueAsDate = new Date();
                // Add default one entry for each if tables exist
                if(rawMaterialTableNames.length > 0) addRawMaterialEntryUI();
                if(packingMaterialTableNames.length > 0) addPackingMaterialEntryUI();

            } catch (error) {
                console.error("Error logging production:", error);
                alert("Error logging production. Check console.");
            }
        });
    }

    function loadProductionLog() {
        const logRef = db.ref(PRODUCTION_LOG_PATH).orderByChild('productionDate');
        logRef.on('value', snapshot => {
            productionLogTableBody.innerHTML = '';
            if (snapshot.exists()) {
                const entries = [];
                snapshot.forEach(childSnapshot => entries.push({id: childSnapshot.key, ...childSnapshot.val()}));
                // Sort descending by date, then by timestamp for recency within the same date
                entries.sort((a,b) => {
                    if (b.productionDate < a.productionDate) return -1;
                    if (b.productionDate > a.productionDate) return 1;
                    return (b.timestamp || 0) - (a.timestamp || 0); // Newest timestamp first
                });

                entries.forEach(entry => renderProductionLogRow(entry.id, entry));

            } else {
                const row = productionLogTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 8;
                cell.textContent = 'No production runs logged yet.'; cell.style.textAlign = 'center'; cell.style.padding = '1rem';
            }
        });
    }

    function renderProductionLogRow(logId, data) {
        const row = productionLogTableBody.insertRow(); row.setAttribute('data-id', logId);
        row.insertCell().textContent = data.productionDate || '';
        row.insertCell().textContent = data.finishedProductName || '';
        row.insertCell().textContent = data.finishedProductCode || '';
        const qtyCell = row.insertCell(); qtyCell.textContent = data.quantityProduced || '0'; qtyCell.classList.add('text-center');
        row.insertCell().textContent = data.batchNumber || 'N/A';
        const rmCell = row.insertCell(); if (data.rawMaterialsConsumed && data.rawMaterialsConsumed.length > 0) { const ul = document.createElement('ul'); ul.classList.add('material-list-display'); data.rawMaterialsConsumed.forEach(rm => { const li = document.createElement('li'); li.textContent = `${rm.rawTeaTableName}: ${rm.quantityUsed} ${rm.unit || ''}`; ul.appendChild(li); }); rmCell.appendChild(ul); } else rmCell.textContent = 'N/A';
        const pmCell = row.insertCell(); if (data.packingMaterialConsumed && data.packingMaterialConsumed.length > 0) { const ul = document.createElement('ul'); ul.classList.add('material-list-display'); data.packingMaterialConsumed.forEach(pm => { const li = document.createElement('li'); li.textContent = `${pm.packingMaterialTableName}: ${pm.quantityUsed} ${pm.unit || ''}`; ul.appendChild(li); }); pmCell.appendChild(ul); } else pmCell.textContent = 'N/A';
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.title = "Delete Log (Does NOT revert inventory changes)"; deleteBtn.onclick = () => deleteProductionLogEntry(logId, data); actionsCell.appendChild(deleteBtn);
    }
    
    async function deleteProductionLogEntry(logId, entryData) {
        if (confirm(`DELETE production log for "${entryData.finishedProductName}"?\n\nWARNING: This will NOT automatically revert inventory deductions. Manual adjustments may be needed.`)) {
            try {
                await db.ref(`${PRODUCTION_LOG_PATH}/${logId}`).remove();
                console.log(`Production log ${logId} deleted.`);
            } catch (error) { console.error(`Error deleting log ${logId}:`, error); alert("Error deleting log."); }
        }
    }

    async function initializePage() {
        productionDateInput.valueAsDate = new Date();
        await fetchTableNamesForSelect(RAW_TEA_METADATA_PATH, rawMaterialTableNames);
        await fetchTableNamesForSelect(PACKING_MATERIAL_METADATA_PATH, packingMaterialTableNames);
        // Add one default entry for each material type if tables exist and containers are empty
        if (rawMaterialTableNames.length > 0 && rawMaterialsConsumedContainer.children.length === 0) addRawMaterialEntryUI();
        if (packingMaterialTableNames.length > 0 && packingMaterialsConsumedContainer.children.length === 0) addPackingMaterialEntryUI();
        loadProductionLog();
    }
    initializePage();
});