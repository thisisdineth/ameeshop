// === production.js ===

document.addEventListener('DOMContentLoaded', () => {
    // Firebase configuration
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
        const mobileNavLinks = mobileMenu.querySelectorAll('a.mobile-navbar-item');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- DOM Elements for Production Log ---
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

    // Firebase Paths
    const PRODUCTION_LOG_PATH = 'productionLog';
    const RAW_MATERIAL_METADATA_PATH = 'rawMaterialTableMetadata'; // Assumed from previous context
    const RAW_MATERIAL_DATA_PATH = 'rawMaterialTableData';         // Assumed
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const PACKING_MATERIAL_DATA_PATH = 'packingMaterialTableData';

    let rawMaterialTables = [];
    let packingMaterialTables = [];

    // --- Populate Material Table Select Options ---
    async function fetchMaterialTableNames(metadataPath, targetArray, selectClass, placeholder) {
        try {
            const snapshot = await db.ref(metadataPath).once('value');
            const data = snapshot.val();
            if (data) {
                targetArray.splice(0, targetArray.length, ...Object.keys(data)); // Clear and fill array
            } else {
                targetArray.length = 0;
            }
        } catch (error) {
            console.error(`Error fetching from ${metadataPath}:`, error);
            targetArray.length = 0;
        }
    }

    function createMaterialSelect(optionsArray, selectClass, placeholderText) {
        const select = document.createElement('select');
        select.classList.add('form-input', selectClass);
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = placeholderText || "-- Select Material Table --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        optionsArray.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        return select;
    }

    // --- Dynamic Form Fields for Materials ---
    function addRawMaterialEntry() {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('consumed-material-entry');

        const selectGroup = document.createElement('div');
        selectGroup.classList.add('form-group');
        const selectLabel = document.createElement('label');
        selectLabel.textContent = "Raw Tea Table:";
        selectLabel.classList.add('form-label', 'sr-only'); // Screen reader only, placeholder in select
        const teaSelect = createMaterialSelect(rawMaterialTables, 'raw-tea-table-select', '-- Select Raw Tea --');
        selectGroup.appendChild(selectLabel);
        selectGroup.appendChild(teaSelect);

        const qtyGroup = document.createElement('div');
        qtyGroup.classList.add('form-group');
        const qtyLabel = document.createElement('label');
        qtyLabel.textContent = "Qty Used:";
        qtyLabel.classList.add('form-label', 'sr-only');
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.step = 'any';
        qtyInput.classList.add('form-input', 'raw-tea-qty');
        qtyInput.placeholder = 'Qty Used';
        qtyGroup.appendChild(qtyLabel);
        qtyGroup.appendChild(qtyInput);
        
        const unitGroup = document.createElement('div');
        unitGroup.classList.add('form-group');
        const unitLabel = document.createElement('label');
        unitLabel.textContent = "Unit:";
        unitLabel.classList.add('form-label', 'sr-only');
        const unitInput = document.createElement('input');
        unitInput.type = 'text';
        unitInput.classList.add('form-input', 'raw-tea-unit');
        unitInput.placeholder = 'Unit (e.g., kg)';
        unitGroup.appendChild(unitLabel);
        unitGroup.appendChild(unitInput);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.classList.add('btn', 'btn-remove-item');
        removeBtn.title = "Remove Raw Material";
        removeBtn.onclick = () => entryDiv.remove();

        entryDiv.appendChild(selectGroup);
        entryDiv.appendChild(qtyGroup);
        entryDiv.appendChild(unitGroup);
        entryDiv.appendChild(removeBtn);
        rawMaterialsConsumedContainer.appendChild(entryDiv);
    }

    function addPackingMaterialEntry() {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('consumed-material-entry');

        const selectGroup = document.createElement('div');
        selectGroup.classList.add('form-group');
        const selectLabel = document.createElement('label');
        selectLabel.textContent = "Packing Material Table:";
        selectLabel.classList.add('form-label', 'sr-only');
        const packingSelect = createMaterialSelect(packingMaterialTables, 'packing-material-table-select', '-- Select Packing Material --');
        selectGroup.appendChild(selectLabel);
        selectGroup.appendChild(packingSelect);
        
        const qtyGroup = document.createElement('div');
        qtyGroup.classList.add('form-group');
        const qtyLabel = document.createElement('label');
        qtyLabel.textContent = "Qty Used:";
        qtyLabel.classList.add('form-label', 'sr-only');
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.step = '1';
        qtyInput.classList.add('form-input', 'packing-material-qty');
        qtyInput.placeholder = 'Qty Used';
        qtyGroup.appendChild(qtyLabel);
        qtyGroup.appendChild(qtyInput);

        const unitGroup = document.createElement('div');
        unitGroup.classList.add('form-group');
        const unitLabel = document.createElement('label');
        unitLabel.textContent = "Unit:";
        unitLabel.classList.add('form-label', 'sr-only');
        const unitInput = document.createElement('input');
        unitInput.type = 'text';
        unitInput.classList.add('form-input', 'packing-material-unit');
        unitInput.placeholder = 'Unit (e.g., pcs)';
        unitGroup.appendChild(unitLabel);
        unitGroup.appendChild(unitInput);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.classList.add('btn', 'btn-remove-item');
        removeBtn.title = "Remove Packing Material";
        removeBtn.onclick = () => entryDiv.remove();

        entryDiv.appendChild(selectGroup);
        entryDiv.appendChild(qtyGroup);
        entryDiv.appendChild(unitGroup);
        entryDiv.appendChild(removeBtn);
        packingMaterialsConsumedContainer.appendChild(entryDiv);
    }

    if (addRawMaterialButton) addRawMaterialButton.addEventListener('click', addRawMaterialEntry);
    if (addPackingMaterialButton) addPackingMaterialButton.addEventListener('click', addPackingMaterialEntry);

    // --- Handle Production Log Submission ---
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
                rawMaterialsConsumed: [],
                packingMaterialConsumed: [],
                notes: productionNotesInput.value.trim() || null,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Validate required fields
            if (!productionEntry.productionDate || !productionEntry.finishedProductName || !productionEntry.finishedProductCode || !productionEntry.quantityProduced) {
                alert("Please fill in all required production details (Date, Product Name, Code, Quantity).");
                return;
            }

            // Collect Raw Materials
            document.querySelectorAll('#rawMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.raw-tea-table-select').value;
                const quantityUsed = parseFloat(entry.querySelector('.raw-tea-qty').value);
                const unit = entry.querySelector('.raw-tea-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) {
                    productionEntry.rawMaterialsConsumed.push({ rawTeaTableName: tableName, quantityUsed, unit });
                }
            });

            // Collect Packing Materials
            document.querySelectorAll('#packingMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.packing-material-table-select').value;
                const quantityUsed = parseInt(entry.querySelector('.packing-material-qty').value);
                const unit = entry.querySelector('.packing-material-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) {
                    productionEntry.packingMaterialConsumed.push({ packingMaterialTableName: tableName, quantityUsed, unit });
                }
            });
            
            if (productionEntry.rawMaterialsConsumed.length === 0 && productionEntry.packingMaterialConsumed.length === 0) {
                if (!confirm("No raw or packing materials were specified. Log production anyway?")) {
                    return;
                }
            }


            try {
                // 1. Save to Production Log
                const newProductionRef = await db.ref(PRODUCTION_LOG_PATH).push(productionEntry);
                console.log("Production logged successfully:", newProductionRef.key);

                // 2. Decrement Raw Materials (add outflow entry)
                for (const material of productionEntry.rawMaterialsConsumed) {
                    const outflowEntry = {
                        // Assuming raw material table has `inflowDate` as primary, we add a new transaction date.
                        // The structure of raw material outflow needs to align with its table structure.
                        // From previous raw_material.js logic, fields are inflowDate, inflowSupplier etc. and outflowDate, outflowEstate, outflowGrade, outflowProduct, outflowWeight
                        inflowDate: productionEntry.productionDate, // Or a specific date for this transaction
                        outflowDate: productionEntry.productionDate,
                        outflowProduct: productionEntry.finishedProductName, // What was produced
                        outflowWeight: material.quantityUsed,
                        outflowNotes: `Used for Prod ID: ${newProductionRef.key}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    };
                    await db.ref(`${RAW_MATERIAL_DATA_PATH}/${material.rawTeaTableName}`).push(outflowEntry);
                    console.log(`Outflow logged for raw material: ${material.rawTeaTableName}`);
                }

                // 3. Decrement Packing Materials (add issue entry)
                for (const material of productionEntry.packingMaterialConsumed) {
                    // From packing_material.js logic, fields are transactionDate, receiveDate etc. and issueDate, issueQty
                    const issueEntry = {
                        transactionDate: productionEntry.productionDate, // Main date for this issue transaction
                        issueDate: productionEntry.productionDate,
                        issueQty: material.quantityUsed,
                        issueReason: `Used for Prod ID: ${newProductionRef.key}, Batch: ${productionEntry.batchNumber || 'N/A'}`,
                        // Balance Qty in packing material table would be affected by this.
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    };
                    await db.ref(`${PACKING_MATERIAL_DATA_PATH}/${material.packingMaterialTableName}`).push(issueEntry);
                    console.log(`Issue logged for packing material: ${material.packingMaterialTableName}`);
                }

                alert("Production logged and inventories updated successfully!");
                logProductionForm.reset();
                rawMaterialsConsumedContainer.innerHTML = ''; // Clear dynamic fields
                packingMaterialsConsumedContainer.innerHTML = '';
                productionDateInput.valueAsDate = new Date(); // Pre-fill for next entry
                // The production log display will update via its own .on() listener
            } catch (error) {
                console.error("Error logging production:", error);
                alert("Error logging production. Inventory might not have been updated. Check console.");
            }
        });
    }

    // --- Load and Display Production Log ---
    function loadProductionLog() {
        const logRef = db.ref(PRODUCTION_LOG_PATH).orderByChild('productionDate');
        logRef.on('value', snapshot => {
            productionLogTableBody.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    renderProductionLogRow(childSnapshot.key, childSnapshot.val());
                });
            } else {
                const row = productionLogTableBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 8; // Number of columns in the production log table
                cell.textContent = 'No production runs logged yet.';
                cell.style.textAlign = 'center';
                cell.style.padding = '1rem';
            }
        });
    }

    function renderProductionLogRow(logId, data) {
        const row = productionLogTableBody.insertRow();
        row.setAttribute('data-id', logId);

        row.insertCell().textContent = data.productionDate || '';
        row.insertCell().textContent = data.finishedProductName || '';
        row.insertCell().textContent = data.finishedProductCode || '';
        const qtyCell = row.insertCell();
        qtyCell.textContent = data.quantityProduced || '0';
        qtyCell.classList.add('text-center');
        row.insertCell().textContent = data.batchNumber || 'N/A';

        const rawMaterialsCell = row.insertCell();
        if (data.rawMaterialsConsumed && data.rawMaterialsConsumed.length > 0) {
            const ul = document.createElement('ul');
            ul.classList.add('material-list-display');
            data.rawMaterialsConsumed.forEach(rm => {
                const li = document.createElement('li');
                li.textContent = `${rm.rawTeaTableName}: ${rm.quantityUsed} ${rm.unit || ''}`;
                ul.appendChild(li);
            });
            rawMaterialsCell.appendChild(ul);
        } else {
            rawMaterialsCell.textContent = 'N/A';
        }

        const packingMaterialsCell = row.insertCell();
        if (data.packingMaterialConsumed && data.packingMaterialConsumed.length > 0) {
            const ul = document.createElement('ul');
            ul.classList.add('material-list-display');
            data.packingMaterialConsumed.forEach(pm => {
                const li = document.createElement('li');
                li.textContent = `${pm.packingMaterialTableName}: ${pm.quantityUsed} ${pm.unit || ''}`;
                ul.appendChild(li);
            });
            packingMaterialsCell.appendChild(ul);
        } else {
            packingMaterialsCell.textContent = 'N/A';
        }

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        // Delete button - Edit is complex due to inventory adjustments reversal.
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.title = "Delete Production Log Entry (Does NOT automatically revert inventory changes)";
        deleteBtn.onclick = () => deleteProductionLogEntry(logId, data); // Pass data for potential reversal logic
        actionsCell.appendChild(deleteBtn);
    }
    
    async function deleteProductionLogEntry(logId, entryData) {
        // IMPORTANT: Simple deletion here. Reversing inventory changes is complex.
        // You would need to find the exact outflow/issue entries created by this production
        // and either delete them or create counter-entries (e.g., a receive for the raw tea).
        // This requires storing references (e.g., productionLogId) in the outflow/issue entries.
        if (confirm(`DELETE production log for "${entryData.finishedProductName}" (Batch: ${entryData.batchNumber || 'N/A'})?\n\nWARNING: This action will NOT automatically revert the inventory deductions made for raw and packing materials. Manual adjustments to inventory tables may be required.`)) {
            try {
                await db.ref(`${PRODUCTION_LOG_PATH}/${logId}`).remove();
                console.log(`Production log entry ${logId} deleted.`);
                // Note: The table will auto-update due to the .on() listener in loadProductionLog
            } catch (error) {
                console.error(`Error deleting production log entry ${logId}:`, error);
                alert("Error deleting production log entry.");
            }
        }
    }


    // --- Initial Setup ---
    async function initializePage() {
        productionDateInput.valueAsDate = new Date(); // Pre-fill production date
        await fetchMaterialTableNames(RAW_MATERIAL_METADATA_PATH, rawMaterialTables, '.raw-tea-table-select', '-- Select Raw Tea --');
        await fetchMaterialTableNames(PACKING_MATERIAL_METADATA_PATH, packingMaterialTables, '.packing-material-table-select', '-- Select Packing Material --');
        // Add one default entry field for each material type
        if (rawMaterialTables.length > 0) addRawMaterialEntry(); else console.warn("No raw material tables found to populate select.");
        if (packingMaterialTables.length > 0) addPackingMaterialEntry(); else console.warn("No packing material tables found to populate select.");
        
        loadProductionLog();
    }

    initializePage();
});