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

    // --- Navbar Mobile Menu Toggle ---
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

    // --- DOM Elements ---
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
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const RAW_TEA_DATA_PATH = 'rawTeaTableData';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const PACKING_MATERIAL_DATA_PATH = 'packingMaterialTableData';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts'; // For updating stock

    let rawMaterialTableNames = [];
    let packingMaterialTableNames = [];

    async function fetchTableNamesForSelect(metadataPath, targetArray, type) {
        try {
            const snapshot = await db.ref(metadataPath).once('value');
            const data = snapshot.val();
            targetArray.length = 0; 
            if (data) {
                targetArray.push(...Object.keys(data));
            }
            // console.log(`Workspaceed ${type} tables:`, targetArray);
        } catch (error) {
            console.error(`Error fetching ${type} tables from ${metadataPath}:`, error);
            targetArray.length = 0;
        }
    }

    function createMaterialSelectElement(optionsArray, selectClassName, placeholderText) {
        const select = document.createElement('select');
        select.classList.add('form-input', selectClassName);
        select.required = true;
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; defaultOption.textContent = placeholderText || "-- Select Table --";
        defaultOption.disabled = true; defaultOption.selected = true; select.appendChild(defaultOption);
        optionsArray.forEach(name => {
            const option = document.createElement('option'); option.value = name; option.textContent = name;
            select.appendChild(option);
        });
        return select;
    }

    function addRawMaterialEntryUI() {
        if (rawMaterialTableNames.length === 0) {
            // console.warn("AddRawMaterialUI: No Raw Tea tables available for dropdown.");
            // Optionally show a persistent message to the user instead of an alert every time
            if (!document.getElementById('noRawTeaTablesMsg')) {
                const msg = document.createElement('p');
                msg.id = 'noRawTeaTablesMsg';
                msg.textContent = 'No Raw Tea tables defined. Please add them via the Raw Tea page first.';
                msg.style.color = 'var(--text-color-muted)'; msg.style.fontSize = '0.9em';
                rawMaterialsConsumedContainer.parentNode.insertBefore(msg, addRawMaterialButton);
            }
            return;
        }
        const noMsg = document.getElementById('noRawTeaTablesMsg');
        if(noMsg) noMsg.remove();

        const entryDiv = document.createElement('div'); entryDiv.classList.add('consumed-material-entry');
        const selectGroup = document.createElement('div'); selectGroup.classList.add('form-group');
        const teaSelect = createMaterialSelectElement(rawMaterialTableNames, 'raw-tea-table-select', '-- Select Raw Tea Table --');
        selectGroup.appendChild(teaSelect);
        const qtyGroup = document.createElement('div'); qtyGroup.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.step = 'any'; qtyInput.min="0.001"; qtyInput.classList.add('form-input', 'raw-tea-qty'); qtyInput.placeholder = 'Qty Used'; qtyInput.required = true;
        qtyGroup.appendChild(qtyInput);
        const unitGroup = document.createElement('div'); unitGroup.classList.add('form-group');
        const unitInput = document.createElement('input'); unitInput.type = 'text'; unitInput.classList.add('form-input', 'raw-tea-unit'); unitInput.placeholder = 'Unit (e.g., Kg)'; unitInput.value = "Kg"; unitInput.required = true;
        unitGroup.appendChild(unitInput);
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger'); removeBtn.title = "Remove"; removeBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(selectGroup); entryDiv.appendChild(qtyGroup); entryDiv.appendChild(unitGroup); entryDiv.appendChild(removeBtn);
        rawMaterialsConsumedContainer.appendChild(entryDiv);
    }

    function addPackingMaterialEntryUI() {
        if (packingMaterialTableNames.length === 0) {
            // console.warn("AddPackingMaterialUI: No Packing Material tables available.");
             if (!document.getElementById('noPackingTablesMsg')) {
                const msg = document.createElement('p');
                msg.id = 'noPackingTablesMsg';
                msg.textContent = 'No Packing Material tables defined. Please add them via the Packing Material page first.';
                msg.style.color = 'var(--text-color-muted)'; msg.style.fontSize = '0.9em';
                packingMaterialsConsumedContainer.parentNode.insertBefore(msg, addPackingMaterialButton);
            }
            return;
        }
        const noMsg = document.getElementById('noPackingTablesMsg');
        if(noMsg) noMsg.remove();

        const entryDiv = document.createElement('div'); entryDiv.classList.add('consumed-material-entry');
        const selectGroup = document.createElement('div'); selectGroup.classList.add('form-group');
        const packingSelect = createMaterialSelectElement(packingMaterialTableNames, 'packing-material-table-select', '-- Select Packing Table --');
        selectGroup.appendChild(packingSelect);
        const qtyGroup = document.createElement('div'); qtyGroup.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.step = '1'; qtyInput.min="1"; qtyInput.classList.add('form-input', 'packing-material-qty'); qtyInput.placeholder = 'Qty Used'; qtyInput.required = true;
        qtyGroup.appendChild(qtyInput);
        const unitGroup = document.createElement('div'); unitGroup.classList.add('form-group');
        const unitInput = document.createElement('input'); unitInput.type = 'text'; unitInput.classList.add('form-input', 'packing-material-unit'); unitInput.placeholder = 'Unit (e.g., Pcs)'; unitInput.value = "Pcs"; unitInput.required = true;
        unitGroup.appendChild(unitInput);
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger'); removeBtn.title = "Remove"; removeBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(selectGroup); entryDiv.appendChild(qtyGroup); entryDiv.appendChild(unitGroup); entryDiv.appendChild(removeBtn);
        packingMaterialsConsumedContainer.appendChild(entryDiv);
    }

    if (addRawMaterialButton) addRawMaterialButton.addEventListener('click', addRawMaterialEntryUI);
    if (addPackingMaterialButton) addPackingMaterialButton.addEventListener('click', addPackingMaterialEntryUI);

    if (logProductionForm) {
        logProductionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Log Production Form Submitted.");
            const today = new Date().toISOString().split('T')[0];
            const productionEntry = {
                productionDate: productionDateInput.value || today,
                batchNumber: batchNumberInput.value.trim() || null,
                finishedProductName: finishedProductNameInput.value.trim(),
                finishedProductCode: finishedProductCodeInput.value.trim().toUpperCase(), // Standardize code to uppercase
                quantityProduced: parseInt(quantityProducedInput.value),
                rawMaterialsConsumed: [], packingMaterialConsumed: [],
                notes: productionNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            if (!productionEntry.productionDate || !productionEntry.finishedProductName || !productionEntry.finishedProductCode || !productionEntry.quantityProduced) {
                alert("Fill required production details (Date, Product Name, Code, Quantity)."); return;
            }
            if(productionEntry.quantityProduced <= 0) {
                alert("Quantity Produced must be greater than 0."); return;
            }


            document.querySelectorAll('#rawMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.raw-tea-table-select').value;
                const quantityUsed = parseFloat(entry.querySelector('.raw-tea-qty').value);
                const unit = entry.querySelector('.raw-tea-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) {
                    productionEntry.rawMaterialsConsumed.push({ rawTeaTableName: tableName, quantityUsed, unit });
                } else if (tableName || quantityUsed || unit) { // If any field is filled but not all valid
                    console.warn("Incomplete raw material entry skipped:", {tableName, quantityUsed, unit});
                }
            });
            document.querySelectorAll('#packingMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.packing-material-table-select').value;
                const quantityUsed = parseInt(entry.querySelector('.packing-material-qty').value);
                const unit = entry.querySelector('.packing-material-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) {
                    productionEntry.packingMaterialConsumed.push({ packingMaterialTableName: tableName, quantityUsed, unit });
                } else if (tableName || quantityUsed || unit) {
                    console.warn("Incomplete packing material entry skipped:", {tableName, quantityUsed, unit});
                }
            });
            
            if (productionEntry.rawMaterialsConsumed.length === 0 && productionEntry.packingMaterialConsumed.length === 0) {
                if (!confirm("No raw or packing materials were specified for consumption. Log production anyway? (This will not deduct from any material inventory)")) return;
            }
            console.log("Production Entry to save:", productionEntry);

            // Get a new push key for the production log FIRST
            const newProductionLogRef = db.ref(PRODUCTION_LOG_PATH).push();
            const productionLogId = newProductionLogRef.key;
            productionEntry.productionLogId = productionLogId; // Add the generated ID to the entry itself

            const updates = {};
            // Path for the new production log entry
            updates[`${PRODUCTION_LOG_PATH}/${productionLogId}`] = productionEntry;

            // Prepare updates for Raw Tea (Outflow)
            for (const material of productionEntry.rawMaterialsConsumed) {
                const outflowEntry = {
                    transactionDate: productionEntry.productionDate,
                    transactionType: 'outflow',
                    outflowProduct: productionEntry.finishedProductName, // What it was used for
                    outflowWeight: material.quantityUsed,
                    outflowNotes: `Prod. ID: ${productionLogId}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                    timestamp: productionEntry.timestamp // Use the same server timestamp
                };
                const outflowKey = db.ref(`${RAW_TEA_DATA_PATH}/${material.rawTeaTableName}`).push().key; // Generate key for this outflow
                updates[`${RAW_TEA_DATA_PATH}/${material.rawTeaTableName}/${outflowKey}`] = outflowEntry;
            }

            // Prepare updates for Packing Material (Issue)
            for (const material of productionEntry.packingMaterialConsumed) {
                const issueEntry = {
                    transactionDate: productionEntry.productionDate,
                    transactionType: 'issue',
                    issueDate: productionEntry.productionDate, // For compatibility with packing.js
                    issueQty: material.quantityUsed,
                    issueReason: `Prod. ID: ${productionLogId}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                    timestamp: productionEntry.timestamp // Use the same server timestamp
                };
                const issueKey = db.ref(`${PACKING_MATERIAL_DATA_PATH}/${material.packingMaterialTableName}`).push().key; // Generate key
                updates[`${PACKING_MATERIAL_DATA_PATH}/${material.packingMaterialTableName}/${issueKey}`] = issueEntry;
            }

            // Prepare update for Finished Product Stock
            const productCode = productionEntry.finishedProductCode;
            const quantityProduced = productionEntry.quantityProduced;
            const finishedProductRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`);
            
            // We will perform the stock update using a transaction for safety, AFTER the main log is written.
            // Or, include it in multi-path if we don't need to read current stock first (but we do for incrementing).

            console.log("Updates to be performed:", updates);

            try {
                await db.ref().update(updates); // This writes the production log & inventory deductions
                console.log("Production logged & inventory deductions written successfully. Production Log ID:", productionLogId);

                // Now, update finished product stock using a transaction
                await finishedProductRef.transaction(currentProductData => {
                    if (currentProductData === null) {
                        console.warn(`Product definition for ${productCode} not found. Creating new definition.`);
                        return { // Auto-create basic product definition if it doesn't exist
                            productCode: productCode,
                            itemName: productionEntry.finishedProductName,
                            currentStock: quantityProduced,
                            totalSold: 0,
                            mrp: 0, sellingPrice: 0, standardWeight: 0, weightUnit: '', unitOfMeasure: '',
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };
                    } else {
                        currentProductData.currentStock = (currentProductData.currentStock || 0) + quantityProduced;
                        currentProductData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                        return currentProductData;
                    }
                });
                console.log(`Finished product stock updated for ${productCode}.`);

                alert("Production logged and all inventories updated successfully!");
                logProductionForm.reset();
                rawMaterialsConsumedContainer.innerHTML = ''; 
                packingMaterialsConsumedContainer.innerHTML = '';
                if(productionDateInput) productionDateInput.valueAsDate = new Date();
                
                // Add default one entry for each if tables exist
                if(rawMaterialTableNames.length > 0) addRawMaterialEntryUI();
                if(packingMaterialTableNames.length > 0) addPackingMaterialEntryUI();
                // The production log display should update automatically due to the .on() listener in loadProductionLog()

            } catch (error) {
                console.error("Error during multi-path update or stock transaction:", error);
                alert("Error logging production or updating inventories. Some operations might have failed. Check console.");
                // Consider if you need to manually revert parts of the 'updates' if some succeed and others fail, though multi-path aims for atomicity.
            }
        });
    }

    function loadProductionLog() {
        console.log(`Setting up listener for Production Log at: ${PRODUCTION_LOG_PATH}`);
        const logRef = db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp'); // Order by server timestamp
        
        logRef.on('value', snapshot => {
            console.log("Production Log data received/updated.");
            if (!productionLogTableBody) {
                console.error("productionLogTableBody element not found in DOM for rendering.");
                return;
            }
            productionLogTableBody.innerHTML = '';
            if (snapshot.exists()) {
                const entries = [];
                snapshot.forEach(childSnapshot => {
                    entries.push({id: childSnapshot.key, ...childSnapshot.val()});
                });
                // Sort client-side: newest first by timestamp, then by productionDate as fallback
                entries.sort((a,b) => {
                    if (b.timestamp && a.timestamp) return (b.timestamp) - (a.timestamp);
                    if (b.productionDate < a.productionDate) return -1;
                    if (b.productionDate > a.productionDate) return 1;
                    return 0; 
                });
                console.log("Sorted production entries for display:", entries.length);
                entries.forEach(entry => renderProductionLogRow(entry.id, entry));
            } else {
                console.log("No production runs found in the log.");
                const row = productionLogTableBody.insertRow(); 
                const cell = row.insertCell(); 
                cell.colSpan = 8; // Number of columns in production log table
                cell.textContent = 'No production runs logged yet.'; 
                cell.style.textAlign = 'center'; cell.style.padding = '1rem';
                cell.style.color = 'var(--text-color-muted)';
            }
        }, errorObject => { // Error callback for .on()
            console.error("Error listening to Production Log:", errorObject);
            if (productionLogTableBody) {
                productionLogTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading production history.</td></tr>`;
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
        const rmCell = row.insertCell(); 
        if (data.rawMaterialsConsumed && data.rawMaterialsConsumed.length > 0) { 
            const ul = document.createElement('ul'); ul.classList.add('material-list-display'); 
            data.rawMaterialsConsumed.forEach(rm => { 
                const li = document.createElement('li'); 
                li.textContent = `${rm.rawTeaTableName}: ${rm.quantityUsed} ${rm.unit || ''}`; 
                ul.appendChild(li); 
            }); 
            rmCell.appendChild(ul); 
        } else { rmCell.textContent = 'N/A'; }
        const pmCell = row.insertCell(); 
        if (data.packingMaterialConsumed && data.packingMaterialConsumed.length > 0) { 
            const ul = document.createElement('ul'); ul.classList.add('material-list-display'); 
            data.packingMaterialConsumed.forEach(pm => { 
                const li = document.createElement('li'); 
                li.textContent = `${pm.packingMaterialTableName}: ${pm.quantityUsed} ${pm.unit || ''}`; 
                ul.appendChild(li); 
            }); 
            pmCell.appendChild(ul); 
        } else { pmCell.textContent = 'N/A'; }
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.title = "Delete Log (Does NOT revert inventory changes)"; deleteBtn.onclick = () => deleteProductionLogEntry(logId, data); actionsCell.appendChild(deleteBtn);
    }
    
    async function deleteProductionLogEntry(logId, entryData) {
        if (confirm(`DELETE production log for "${entryData.finishedProductName}"?\n\nWARNING: This will NOT automatically revert inventory deductions or finished product stock updates. Manual adjustments will be required.`)) {
            try {
                await db.ref(`${PRODUCTION_LOG_PATH}/${logId}`).remove();
                console.log(`Production log ${logId} deleted.`);
                // Table updates via real-time listener in loadProductionLog
                alert("Production log entry deleted. Remember, inventory and stock were NOT automatically reverted.");
            } catch (error) { console.error(`Error deleting log ${logId}:`, error); alert("Error deleting log."); }
        }
    }

    async function initializePage() {
        if(productionDateInput) productionDateInput.valueAsDate = new Date();
        await fetchTableNamesForSelect(RAW_TEA_METADATA_PATH, rawMaterialTableNames, "Raw Tea");
        await fetchTableNamesForSelect(PACKING_MATERIAL_METADATA_PATH, packingMaterialTableNames, "Packing Material");
        
        if (rawMaterialTableNames.length > 0 && rawMaterialsConsumedContainer.children.length === 0) addRawMaterialEntryUI();
        else if (rawMaterialTableNames.length === 0 && addRawMaterialButton) addRawMaterialEntryUI(); // Will show message if no tables

        if (packingMaterialTableNames.length > 0 && packingMaterialsConsumedContainer.children.length === 0) addPackingMaterialEntryUI();
        else if (packingMaterialTableNames.length === 0 && addPackingMaterialButton) addPackingMaterialEntryUI(); // Will show message
        
        loadProductionLog(); // This sets up the real-time listener
    }

    initializePage();
});