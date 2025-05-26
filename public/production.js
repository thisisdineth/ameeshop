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

    // --- Navbar Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    const logProductionForm = document.getElementById('logProductionForm');
    const productionDateInput = document.getElementById('productionDate');
    const batchNumberInput = document.getElementById('batchNumber');
    const finishedProductNameInput = document.getElementById('finishedProductName');
    const finishedProductCodeInput = document.getElementById('finishedProductCode');
    const totalQuantityProducedInput = document.getElementById('totalQuantityProduced');
    const quantityToAddToSellableStockInput = document.getElementById('quantityToAddToSellableStock');
    const quantityPendingText = document.getElementById('quantityPendingText');

    const standardWeightInput = document.getElementById('standardWeight');
    const weightUnitSelect = document.getElementById('weightUnit');
    const mrpInput = document.getElementById('mrp');
    const sellingPriceInput = document.getElementById('sellingPrice');

    const rawMaterialsConsumedContainer = document.getElementById('rawMaterialsConsumedContainer');
    const addRawMaterialButton = document.getElementById('addRawMaterialButton');
    const packingMaterialsConsumedContainer = document.getElementById('packingMaterialsConsumedContainer');
    const addPackingMaterialButton = document.getElementById('addPackingMaterialButton');
    const productionNotesInput = document.getElementById('productionNotes');

    // Production Log History Table
    const productionLogTableBody = document.getElementById('productionLogTableBody');
    const noProductionHistoryText = document.getElementById('noProductionHistoryText');

    // Finished Products Inventory Table
    const finishedProductsTableBody = document.getElementById('finishedProductsTableBody');
    const noFinishedProductsText = document.getElementById('noFinishedProductsText');
    const sortFinishedProductsSelect = document.getElementById('sortFinishedProducts');
    const searchFinishedProductsInput = document.getElementById('searchFinishedProducts');

    const PRODUCTION_LOG_PATH = 'productionLog_v2'; // Consider versioning if structure changes
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2'; // Consider versioning
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const RAW_TEA_DATA_PATH = 'rawTeaTableData';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const PACKING_MATERIAL_DATA_PATH = 'packingMaterialTableData';

    let rawMaterialTableNames = [];
    let packingMaterialTableNames = [];
    let allFinishedProducts = []; // For client-side search/sort

    // --- Helper Functions ---
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
    }

    function formatCurrency(amount) {
        return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
    }
    
    function calculatePendingStock() {
        const totalProduced = parseInt(totalQuantityProducedInput.value) || 0;
        const toSellable = parseInt(quantityToAddToSellableStockInput.value) || 0;
        const pending = totalProduced - toSellable;
        quantityPendingText.textContent = pending >= 0 ? pending : 0;
    }
    if(totalQuantityProducedInput && quantityToAddToSellableStockInput) {
        totalQuantityProducedInput.addEventListener('input', calculatePendingStock);
        quantityToAddToSellableStockInput.addEventListener('input', calculatePendingStock);
    }


    async function fetchTableNamesForSelect(metadataPath, targetArray, type) {
        try {
            const snapshot = await db.ref(metadataPath).once('value');
            targetArray.length = 0;
            if (snapshot.exists()) targetArray.push(...Object.keys(snapshot.val()));
        } catch (error) { console.error(`Error fetching ${type} tables:`, error); targetArray.length = 0; }
    }

    function createMaterialSelectElement(optionsArray, selectClassName, placeholderText) {
        const select = document.createElement('select');
        select.classList.add('form-input', selectClassName);
        select.required = true;
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; defaultOption.textContent = placeholderText; defaultOption.disabled = true; defaultOption.selected = true;
        select.appendChild(defaultOption);
        optionsArray.forEach(name => {
            const option = document.createElement('option'); option.value = name; option.textContent = name;
            select.appendChild(option);
        });
        return select;
    }

    function addMaterialEntryUI(container, tableNames, type) {
        const isRawMaterial = type === 'RawMaterial';
        const placeholder = isRawMaterial ? '-- Select Raw Tea Table --' : '-- Select Packing Table --';
        const qtyUnit = isRawMaterial ? 'Kg' : 'Pcs';
        const qtyStep = isRawMaterial ? 'any' : '1';
        const qtyMin = isRawMaterial ? '0.001' : '1';
        const selectClass = isRawMaterial ? 'raw-tea-table-select' : 'packing-material-table-select';
        const qtyClass = isRawMaterial ? 'raw-tea-qty' : 'packing-material-qty';
        const unitClass = isRawMaterial ? 'raw-tea-unit' : 'packing-material-unit';
        const noTablesMsgId = isRawMaterial ? 'noRawTeaTablesMsg' : 'noPackingTablesMsg';
        const noTablesText = `No ${type} tables defined. Add via ${type} page.`;
        const addButton = isRawMaterial ? addRawMaterialButton : addPackingMaterialButton;

        if (tableNames.length === 0) {
            if (!document.getElementById(noTablesMsgId)) {
                const msg = document.createElement('p'); msg.id = noTablesMsgId; msg.textContent = noTablesText;
                msg.style.color = 'var(--text-color-muted)'; msg.style.fontSize = '0.9em';
                container.parentNode.insertBefore(msg, addButton);
            }
            return;
        }
        const existingMsg = document.getElementById(noTablesMsgId);
        if (existingMsg) existingMsg.remove();

        const entryDiv = document.createElement('div'); entryDiv.classList.add('consumed-material-entry');
        const sGroup = document.createElement('div'); sGroup.classList.add('form-group');
        sGroup.appendChild(createMaterialSelectElement(tableNames, selectClass, placeholder));
        const qGroup = document.createElement('div'); qGroup.classList.add('form-group');
        const qInput = document.createElement('input'); qInput.type = 'number'; qInput.step = qtyStep; qInput.min = qtyMin; qInput.classList.add('form-input', qtyClass); qInput.placeholder = 'Qty Used'; qInput.required = true;
        qGroup.appendChild(qInput);
        const uGroup = document.createElement('div'); uGroup.classList.add('form-group');
        const uInput = document.createElement('input'); uInput.type = 'text'; uInput.classList.add('form-input', unitClass); uInput.placeholder = `Unit (e.g., ${qtyUnit})`; uInput.value = qtyUnit; uInput.required = true;
        uGroup.appendChild(uInput);
        const rmBtn = document.createElement('button'); rmBtn.type = 'button'; rmBtn.innerHTML = '<i class="fas fa-times"></i>'; rmBtn.classList.add('btn', 'btn-remove-item', 'btn-danger'); rmBtn.title = "Remove"; rmBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(sGroup); entryDiv.appendChild(qGroup); entryDiv.appendChild(uGroup); entryDiv.appendChild(rmBtn);
        container.appendChild(entryDiv);
    }

    if (addRawMaterialButton) addRawMaterialButton.addEventListener('click', () => addMaterialEntryUI(rawMaterialsConsumedContainer, rawMaterialTableNames, 'RawMaterial'));
    if (addPackingMaterialButton) addPackingMaterialButton.addEventListener('click', () => addMaterialEntryUI(packingMaterialsConsumedContainer, packingMaterialTableNames, 'PackingMaterial'));

    // --- Log Production Form Submission ---
    if (logProductionForm) {
        logProductionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const today = new Date().toISOString().split('T')[0];
            const totalProducedVal = parseInt(totalQuantityProducedInput.value);
            const toSellableVal = parseInt(quantityToAddToSellableStockInput.value);

            if (toSellableVal > totalProducedVal) {
                alert("Quantity to add to sellable stock cannot exceed total quantity produced.");
                return;
            }
             if (toSellableVal < 0) {
                alert("Quantity to add to sellable stock cannot be negative.");
                return;
            }


            const productionRunData = {
                productionDate: productionDateInput.value || today,
                batchNumber: batchNumberInput.value.trim() || null,
                finishedProductName: finishedProductNameInput.value.trim(),
                finishedProductCode: finishedProductCodeInput.value.trim().toUpperCase(),
                totalQuantityProducedInBatch: totalProducedVal,
                quantityAddedToStockFromThisBatch: toSellableVal,
                rawMaterialsConsumed: [],
                packingMaterialConsumed: [],
                notes: productionNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            // Product Definition Data (for definedFinishedProducts node)
            const productDefinitionData = {
                itemName: productionRunData.finishedProductName,
                productCode: productionRunData.finishedProductCode,
                standardWeight: parseFloat(standardWeightInput.value) || 0,
                weightUnit: weightUnitSelect.value || 'g',
                mrp: parseFloat(mrpInput.value) || 0,
                sellingPrice: parseFloat(sellingPriceInput.value) || 0,
            };

            // Basic Validations
            if (!productionRunData.productionDate || !productionRunData.finishedProductName || !productionRunData.finishedProductCode || !productionRunData.totalQuantityProducedInBatch === undefined) {
                alert("Please fill all required production details (Date, Product Name, Code, Total Quantity Produced)."); return;
            }
            if (productDefinitionData.mrp < 0 || productDefinitionData.sellingPrice < 0 || productDefinitionData.standardWeight < 0) {
                alert("MRP, Selling Price, and Standard Weight cannot be negative."); return;
            }
            if (productDefinitionData.sellingPrice > productDefinitionData.mrp && productDefinitionData.mrp > 0) {
                 if(!confirm("Warning: Selling Price is greater than MRP. Continue?")) return;
            }


            document.querySelectorAll('#rawMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.raw-tea-table-select').value;
                const quantityUsed = parseFloat(entry.querySelector('.raw-tea-qty').value);
                const unit = entry.querySelector('.raw-tea-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) productionRunData.rawMaterialsConsumed.push({ tableName, quantityUsed, unit });
            });
            document.querySelectorAll('#packingMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.packing-material-table-select').value;
                const quantityUsed = parseInt(entry.querySelector('.packing-material-qty').value);
                const unit = entry.querySelector('.packing-material-unit').value.trim();
                if (tableName && quantityUsed > 0 && unit) productionRunData.packingMaterialConsumed.push({ tableName, quantityUsed, unit });
            });

            const newProductionLogRef = db.ref(PRODUCTION_LOG_PATH).push();
            const productionLogId = newProductionLogRef.key;
            productionRunData.productionLogId = productionLogId;

            const updates = {};
            updates[`${PRODUCTION_LOG_PATH}/${productionLogId}`] = productionRunData;

            // Deduct Raw Materials
            productionRunData.rawMaterialsConsumed.forEach(material => {
                const outflowKey = db.ref(`${RAW_TEA_DATA_PATH}/${material.tableName}`).push().key;
                updates[`${RAW_TEA_DATA_PATH}/${material.tableName}/${outflowKey}`] = {
                    transactionDate: productionRunData.productionDate, transactionType: 'outflow',
                    outflowProduct: productionRunData.finishedProductName, outflowWeight: material.quantityUsed,
                    outflowNotes: `Prod. ID: ${productionLogId}, Batch: ${productionRunData.batchNumber || 'N/A'}`,
                    timestamp: productionRunData.timestamp
                };
            });
            // Deduct Packing Materials
            productionRunData.packingMaterialConsumed.forEach(material => {
                const issueKey = db.ref(`${PACKING_MATERIAL_DATA_PATH}/${material.tableName}`).push().key;
                updates[`${PACKING_MATERIAL_DATA_PATH}/${material.tableName}/${issueKey}`] = {
                    transactionDate: productionRunData.productionDate, transactionType: 'issue',
                    issueQty: material.quantityUsed,
                    issueReason: `Prod. ID: ${productionLogId}, Batch: ${productionRunData.batchNumber || 'N/A'}`,
                    timestamp: productionRunData.timestamp
                };
            });

            const finishedProductRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productionRunData.finishedProductCode}`);

            try {
                await db.ref().update(updates); // Log production run & deduct materials

                // Update Finished Product Definition and Stock
                await finishedProductRef.transaction(currentData => {
                    const quantityAddedToSellable = productionRunData.quantityAddedToStockFromThisBatch;
                    const quantityForPending = productionRunData.totalQuantityProducedInBatch - quantityAddedToSellable;

                    if (currentData === null) { // New product
                        return {
                            ...productDefinitionData,
                            currentStock: quantityAddedToSellable,
                            pendingStock: quantityForPending,
                            totalSold: 0,
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };
                    } else { // Existing product
                        currentData.itemName = productDefinitionData.itemName; // Allow name updates
                        currentData.standardWeight = productDefinitionData.standardWeight;
                        currentData.weightUnit = productDefinitionData.weightUnit;
                        currentData.mrp = productDefinitionData.mrp;
                        currentData.sellingPrice = productDefinitionData.sellingPrice;
                        currentData.currentStock = (currentData.currentStock || 0) + quantityAddedToSellable;
                        currentData.pendingStock = (currentData.pendingStock || 0) + quantityForPending;
                        currentData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                        return currentData;
                    }
                });

                alert("Production logged, inventories updated successfully!");
                logProductionForm.reset();
                rawMaterialsConsumedContainer.innerHTML = '';
                packingMaterialsConsumedContainer.innerHTML = '';
                quantityPendingText.textContent = '0';
                if(productionDateInput) productionDateInput.valueAsDate = new Date();
                if(rawMaterialTableNames.length > 0) addMaterialEntryUI(rawMaterialsConsumedContainer, rawMaterialTableNames, 'RawMaterial');
                if(packingMaterialTableNames.length > 0) addMaterialEntryUI(packingMaterialsConsumedContainer, packingMaterialTableNames, 'PackingMaterial');

            } catch (error) {
                console.error("Error logging production:", error);
                alert("Error logging production. Check console for details. Some operations might have failed.");
            }
        });
    }

    // --- Load and Display Production Log History ---
    function loadProductionLogHistory() {
        const logRef = db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp');
        logRef.on('value', snapshot => {
            if (!productionLogTableBody) return;
            productionLogTableBody.innerHTML = '';
            if (snapshot.exists()) {
                noProductionHistoryText.style.display = 'none';
                const entries = [];
                snapshot.forEach(child => entries.push({ id: child.key, ...child.val() }));
                entries.reverse(); // Newest first
                entries.forEach(entry => renderProductionLogRow(entry));
            } else {
                noProductionHistoryText.style.display = 'block';
            }
        }, err => {
            console.error("Error loading production log history:", err);
            noProductionHistoryText.textContent = 'Error loading production history.';
            noProductionHistoryText.style.display = 'block';
        });
    }

    function renderProductionLogRow(data) {
        const row = productionLogTableBody.insertRow();
        row.insertCell().textContent = data.productionDate || '';
        row.insertCell().textContent = data.finishedProductName || '';
        row.insertCell().textContent = data.finishedProductCode || '';
        row.insertCell().textContent = data.batchNumber || 'N/A';
        const totalQtyCell = row.insertCell(); totalQtyCell.textContent = data.totalQuantityProducedInBatch || '0'; totalQtyCell.classList.add('text-center');
        const addedToStockCell = row.insertCell(); addedToStockCell.textContent = data.quantityAddedToStockFromThisBatch || '0'; addedToStockCell.classList.add('text-center');

        const rmCell = row.insertCell();
        if (data.rawMaterialsConsumed && data.rawMaterialsConsumed.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display');
            data.rawMaterialsConsumed.forEach(rm => {
                const li = document.createElement('li'); li.textContent = `${rm.tableName}: ${rm.quantityUsed} ${rm.unit || ''}`;
                ul.appendChild(li);
            }); rmCell.appendChild(ul);
        } else { rmCell.textContent = 'N/A'; rmCell.classList.add('text-center'); }

        const pmCell = row.insertCell();
        if (data.packingMaterialConsumed && data.packingMaterialConsumed.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display');
            data.packingMaterialConsumed.forEach(pm => {
                const li = document.createElement('li'); li.textContent = `${pm.tableName}: ${pm.quantityUsed} ${pm.unit || ''}`;
                ul.appendChild(li);
            }); pmCell.appendChild(ul);
        } else { pmCell.textContent = 'N/A'; pmCell.classList.add('text-center'); }

        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.title = "Delete Log (WARNING: Does NOT revert inventory/stock changes automatically)";
        deleteBtn.onclick = () => deleteProductionLogEntry(data.productionLogId, data);
        actionsCell.appendChild(deleteBtn);
    }

    async function deleteProductionLogEntry(logId, entryData) {
        const confirmationMessage = `Permanently DELETE production batch log for "${entryData.finishedProductName}" (Batch: ${entryData.batchNumber || 'N/A'})?\n
        !!! IMPORTANT WARNING !!!
        This action is IRREVERSIBLE and WILL NOT automatically:
        1. Revert raw material deductions.
        2. Revert packing material deductions.
        3. Reduce 'Sellable Stock' or 'Pending Stock' for product code '${entryData.finishedProductCode}'.
        You MUST manually adjust all related inventories if this log is deleted.\n
        Are you absolutely sure you want to proceed?`;

        if (confirm(confirmationMessage)) {
            try {
                await db.ref(`${PRODUCTION_LOG_PATH}/${logId}`).remove();
                alert("Production log entry deleted. REMEMBER TO MANUALLY ADJUST ALL RELATED INVENTORIES!");
            } catch (error) {
                console.error(`Error deleting production log ${logId}:`, error);
                alert("Error deleting production log entry.");
            }
        }
    }


    // --- Load and Display Finished Products Inventory ---
    let currentSortCriteria = 'latestCreated';
    let currentSearchTerm = '';

    function loadFinishedProductsInventory() {
        const productsRef = db.ref(DEFINED_PRODUCTS_PATH);
        productsRef.on('value', snapshot => {
            allFinishedProducts = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    allFinishedProducts.push({ id: child.key, ...child.val() });
                });
            }
            renderFinishedProductsTable(); // Initial render
        }, err => {
            console.error("Error loading finished products:", err);
            finishedProductsTableBody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Error loading finished products.</td></tr>`;
        });
    }

    function renderFinishedProductsTable() {
        if (!finishedProductsTableBody) return;
        finishedProductsTableBody.innerHTML = '';

        let productsToDisplay = [...allFinishedProducts];

        // Filter
        if (currentSearchTerm) {
            productsToDisplay = productsToDisplay.filter(p =>
                (p.itemName && p.itemName.toLowerCase().includes(currentSearchTerm)) ||
                (p.productCode && p.productCode.toLowerCase().includes(currentSearchTerm))
            );
        }

        // Sort
        switch (currentSortCriteria) {
            case 'latestCreated': productsToDisplay.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
            case 'oldestCreated': productsToDisplay.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
            case 'topSelling': productsToDisplay.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)); break;
            case 'lowestSelling': productsToDisplay.sort((a, b) => (a.totalSold || 0) - (b.totalSold || 0)); break;
            case 'productNameAZ': productsToDisplay.sort((a, b) => a.itemName.localeCompare(b.itemName)); break;
            case 'productNameZA': productsToDisplay.sort((a, b) => b.itemName.localeCompare(a.itemName)); break;
        }

        if (productsToDisplay.length > 0) {
            noFinishedProductsText.style.display = 'none';
            productsToDisplay.forEach(product => {
                const row = finishedProductsTableBody.insertRow();
                row.insertCell().textContent = product.productCode;
                row.insertCell().textContent = product.itemName;
                const stdWeightCell = row.insertCell(); stdWeightCell.textContent = product.standardWeight || 'N/A'; stdWeightCell.classList.add('text-right');
                row.insertCell().textContent = product.weightUnit || 'N/A';
                const mrpCell = row.insertCell(); mrpCell.textContent = formatCurrency(product.mrp); mrpCell.classList.add('text-right');
                const spCell = row.insertCell(); spCell.textContent = formatCurrency(product.sellingPrice); spCell.classList.add('text-right');
                
                const avgIncome = (product.mrp || 0) - (product.sellingPrice || 0);
                const avgIncomeCell = row.insertCell(); avgIncomeCell.textContent = formatCurrency(avgIncome); avgIncomeCell.classList.add('text-right');
                if (avgIncome < 0) avgIncomeCell.classList.add('text-danger');


                const sellableStockCell = row.insertCell(); sellableStockCell.textContent = product.currentStock || 0; sellableStockCell.classList.add('text-center');
                const pendingStockCell = row.insertCell(); pendingStockCell.textContent = product.pendingStock || 0; pendingStockCell.classList.add('text-center');
                const totalSoldCell = row.insertCell(); totalSoldCell.textContent = product.totalSold || 0; totalSoldCell.classList.add('text-center');

                row.insertCell().textContent = formatDate(product.createdAt);

                const actionsCell = row.insertCell(); actionsCell.classList.add('text-center');
                // Placeholder for "Add Pending to Stock" button
                const addPendingBtn = document.createElement('button');
                addPendingBtn.innerHTML = '<i class="fas fa-plus-square"></i> To Sellable';
                addPendingBtn.classList.add('btn', 'btn-info', 'btn-sm');
                addPendingBtn.title = 'Move Pending Stock to Sellable Stock';
                addPendingBtn.disabled = !(product.pendingStock > 0); // Disable if no pending stock
                addPendingBtn.onclick = () => handleAddPendingToSellable(product.id, product.pendingStock, product.itemName);
                actionsCell.appendChild(addPendingBtn);
                // Add more actions like "Edit Product Definition" if needed
            });
        } else {
            noFinishedProductsText.style.display = 'block';
             noFinishedProductsText.textContent = currentSearchTerm ? 'No products match your search.' : 'No finished products defined yet.';
        }
    }
    
    async function handleAddPendingToSellable(productId, pendingQty, itemName) {
        if (!pendingQty || pendingQty <= 0) {
            alert("No pending stock to move.");
            return;
        }
        const qtyToMove = prompt(`How many units of "${itemName}" (Pending: ${pendingQty}) do you want to move to Sellable Stock?`, pendingQty);
        if (qtyToMove === null) return; // User cancelled

        const numQtyToMove = parseInt(qtyToMove);
        if (isNaN(numQtyToMove) || numQtyToMove <= 0) {
            alert("Invalid quantity entered.");
            return;
        }
        if (numQtyToMove > pendingQty) {
            alert(`Cannot move more than available pending stock (${pendingQty}).`);
            return;
        }

        const productRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productId}`);
        try {
            await productRef.transaction(currentData => {
                if (currentData) {
                    currentData.currentStock = (currentData.currentStock || 0) + numQtyToMove;
                    currentData.pendingStock = (currentData.pendingStock || 0) - numQtyToMove;
                    currentData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                    return currentData;
                }
                return currentData; // Abort if product somehow deleted
            });
            alert(`${numQtyToMove} units of "${itemName}" moved to sellable stock.`);
        } catch (error) {
            console.error("Error moving pending stock:", error);
            alert("Failed to move pending stock. Check console.");
        }
    }


    if (sortFinishedProductsSelect) {
        sortFinishedProductsSelect.addEventListener('change', (e) => {
            currentSortCriteria = e.target.value;
            renderFinishedProductsTable();
        });
    }
    if (searchFinishedProductsInput) {
        searchFinishedProductsInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            renderFinishedProductsTable(); // Debounce this for better performance on large lists if needed
        });
    }


    // --- Initial Page Load ---
    async function initializePage() {
        if(productionDateInput) productionDateInput.valueAsDate = new Date();
        await fetchTableNamesForSelect(RAW_TEA_METADATA_PATH, rawMaterialTableNames, "Raw Tea");
        await fetchTableNamesForSelect(PACKING_MATERIAL_METADATA_PATH, packingMaterialTableNames, "Packing Material");

        if(rawMaterialTableNames.length > 0) addMaterialEntryUI(rawMaterialsConsumedContainer, rawMaterialTableNames, 'RawMaterial');
        if(packingMaterialTableNames.length > 0) addMaterialEntryUI(packingMaterialsConsumedContainer, packingMaterialTableNames, 'PackingMaterial');
        
        loadProductionLogHistory();
        loadFinishedProductsInventory();
    }

    initializePage();
});