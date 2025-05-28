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
    const sellingPriceInput = document.getElementById('sellingPrice'); // This is read by sales.js

    const rawMaterialsConsumedContainer = document.getElementById('rawMaterialsConsumedContainer');
    const addRawMaterialButton = document.getElementById('addRawMaterialButton');
    const packingMaterialsConsumedContainer = document.getElementById('packingMaterialsConsumedContainer');
    const addPackingMaterialButton = document.getElementById('addPackingMaterialButton');
    const productionNotesInput = document.getElementById('productionNotes');

    // Finished Products Inventory Table
    const finishedProductsTableBody = document.getElementById('finishedProductsTableBody');
    const noFinishedProductsText = document.getElementById('noFinishedProductsText');
    const sortFinishedProductsSelect = document.getElementById('sortFinishedProducts');
    const searchFinishedProductsInput = document.getElementById('searchFinishedProducts');

    // Firebase Paths (must match sales.js for product data)
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const RAW_TEA_DATA_PATH = 'rawTeaTableData';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const PACKING_MATERIAL_DATA_PATH = 'packingMaterialTableData';

    let rawMaterialTableNames = [];
    let packingMaterialTableNames = [];
    let allFinishedProducts = []; // Local cache for display

    // --- Helper Functions ---
    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleDateString('en-CA'); //ตลาด-MM-DD
    }

    function formatCurrency(amount) {
        return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
    }
    
    function calculatePendingStock() {
        const totalProduced = parseInt(totalQuantityProducedInput.value) || 0;
        const toSellable = parseInt(quantityToAddToSellableStockInput.value) || 0;
        const pending = totalProduced - toSellable;
        if (quantityPendingText) quantityPendingText.textContent = pending >= 0 ? pending : 0;
    }

    if(totalQuantityProducedInput && quantityToAddToSellableStockInput) {
        totalQuantityProducedInput.addEventListener('input', calculatePendingStock);
        quantityToAddToSellableStockInput.addEventListener('input', calculatePendingStock);
    }

    async function fetchTableNamesForSelect(metadataPath, targetArray, type) {
        try {
            const snapshot = await db.ref(metadataPath).once('value');
            targetArray.length = 0; // Clear existing
            if (snapshot.exists()) {
                targetArray.push(...Object.keys(snapshot.val()));
            }
            console.log(`${type} tables fetched:`, targetArray);
        } catch (error) {
            console.error(`Error fetching ${type} tables:`, error);
            targetArray.length = 0;
        }
    }

    function createMaterialSelectElement(optionsArray, selectClassName, placeholderText) {
        const select = document.createElement('select');
        select.classList.add('form-input', selectClassName);
        // select.required = true; // REMOVED: Making this optional
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = placeholderText;
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

    function addMaterialEntryUI(container, tableNames, type) {
        if (!container) {
            console.warn(`Container for ${type} not found.`);
            return;
        }
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
                const msg = document.createElement('p');
                msg.id = noTablesMsgId;
                msg.textContent = noTablesText;
                msg.style.color = 'var(--text-color-muted)';
                msg.style.fontSize = '0.9em';
                if (container.parentNode && addButton) {
                    container.parentNode.insertBefore(msg, addButton);
                }
            }
            return;
        }
        const existingMsg = document.getElementById(noTablesMsgId);
        if (existingMsg) existingMsg.remove();

        const entryDiv = document.createElement('div');
        entryDiv.classList.add('consumed-material-entry', 'form-grid', 'grid-cols-4', 'gap-1', 'mb-1'); // Using grid for alignment

        const sGroup = document.createElement('div');
        sGroup.classList.add('form-group', 'col-span-2'); // Material select takes more space
        sGroup.appendChild(createMaterialSelectElement(tableNames, selectClass, placeholder));

        const qGroup = document.createElement('div');
        qGroup.classList.add('form-group');
        const qInput = document.createElement('input');
        qInput.type = 'number'; qInput.step = qtyStep; qInput.min = qtyMin;
        qInput.classList.add('form-input', qtyClass); qInput.placeholder = 'Qty Used';
        // qInput.required = true; // REMOVED: Making this optional
        qGroup.appendChild(qInput);

        const uGroup = document.createElement('div'); // Hidden for now, unit is fixed per type
        uGroup.classList.add('form-group');
        uGroup.style.display = 'none'; // Hide unit input, fixed for now
        const uInput = document.createElement('input');
        uInput.type = 'text'; uInput.classList.add('form-input', unitClass);
        uInput.placeholder = `Unit (e.g., ${qtyUnit})`; uInput.value = qtyUnit; 
        // uInput.required = true; // REMOVED: Making this optional
        // uGroup.appendChild(uInput); // Not appending it to keep it hidden

        const rmBtnGroup = document.createElement('div');
        rmBtnGroup.classList.add('form-group', 'flex', 'items-end'); // Align button
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button'; rmBtn.innerHTML = '<i class="fas fa-times"></i>';
        rmBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm');
        rmBtn.title = "Remove";
        rmBtn.onclick = () => entryDiv.remove();
        rmBtnGroup.appendChild(rmBtn);

        entryDiv.appendChild(sGroup);
        entryDiv.appendChild(qGroup);
        // entryDiv.appendChild(uGroup); // Unit group not added
        entryDiv.appendChild(rmBtnGroup);
        container.appendChild(entryDiv);
    }

    if (addRawMaterialButton) {
        addRawMaterialButton.addEventListener('click', () => addMaterialEntryUI(rawMaterialsConsumedContainer, rawMaterialTableNames, 'RawMaterial'));
    }
    if (addPackingMaterialButton) {
        addPackingMaterialButton.addEventListener('click', () => addMaterialEntryUI(packingMaterialsConsumedContainer, packingMaterialTableNames, 'PackingMaterial'));
    }

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
            if (isNaN(totalProducedVal) || totalProducedVal <=0) {
                 alert("Total Quantity Produced must be a positive number."); return;
            }
             if (isNaN(toSellableVal) ) {
                 alert("Quantity to Add to Sellable Stock must be a number."); return;
            }


            const productionRunDetails = {
                productionDate: productionDateInput.value || today,
                batchNumber: batchNumberInput.value.trim() || null,
                finishedProductName: finishedProductNameInput.value.trim(),
                finishedProductCode: finishedProductCodeInput.value.trim().toUpperCase(),
                totalQuantityProducedInBatch: totalProducedVal,
                quantityAddedToStockFromThisBatch: toSellableVal,
                notes: productionNotesInput.value.trim() || null,
            };

            const productDefinitionData = {
                itemName: productionRunDetails.finishedProductName,
                productCode: productionRunDetails.finishedProductCode,
                standardWeight: parseFloat(standardWeightInput.value) || 0,
                weightUnit: weightUnitSelect.value || 'g',
                mrp: parseFloat(mrpInput.value) || 0,
                sellingPrice: parseFloat(sellingPriceInput.value) || 0, // Key field for sales page
            };

            if (!productionRunDetails.productionDate || !productionRunDetails.finishedProductName || !productionRunDetails.finishedProductCode ) {
                alert("Please fill all required production details (Date, Product Name, Code)."); return;
            }
            if (productDefinitionData.mrp < 0 || productDefinitionData.sellingPrice < 0 || productDefinitionData.standardWeight < 0) {
                alert("MRP, Selling Price, and Standard Weight cannot be negative."); return;
            }
             if (productDefinitionData.sellingPrice <= 0) {
                alert("Selling Price must be greater than zero."); return;
            }
            if (productDefinitionData.mrp > 0 && productDefinitionData.sellingPrice > productDefinitionData.mrp) {
                 if(!confirm("Warning: Selling Price is greater than MRP. Continue?")) return;
            }


            const rawMaterialsConsumedThisBatch = [];
            document.querySelectorAll('#rawMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.raw-tea-table-select')?.value;
                const quantityUsed = parseFloat(entry.querySelector('.raw-tea-qty')?.value);
                // Validate only if a table name is selected and quantity is provided
                if (tableName && quantityUsed > 0) {
                    rawMaterialsConsumedThisBatch.push({ tableName, quantityUsed, unit: 'Kg' });
                } else if (tableName && (isNaN(quantityUsed) || quantityUsed <= 0)) {
                    // Optional: alert if a table is selected but quantity is invalid
                    alert(`Raw material "${tableName}" has an invalid quantity. Please correct or remove the entry.`);
                    e.preventDefault(); // Prevent form submission
                }
            });

            const packingMaterialsConsumedThisBatch = [];
            document.querySelectorAll('#packingMaterialsConsumedContainer .consumed-material-entry').forEach(entry => {
                const tableName = entry.querySelector('.packing-material-table-select')?.value;
                const quantityUsed = parseInt(entry.querySelector('.packing-material-qty')?.value);
                // Validate only if a table name is selected and quantity is provided
                if (tableName && quantityUsed > 0) {
                    packingMaterialsConsumedThisBatch.push({ tableName, quantityUsed, unit: 'Pcs' });
                } else if (tableName && (isNaN(quantityUsed) || quantityUsed <= 0)) {
                    // Optional: alert if a table is selected but quantity is invalid
                    alert(`Packing material "${tableName}" has an an invalid quantity. Please correct or remove the entry.`);
                    e.preventDefault(); // Prevent form submission
                }
            });

            const updates = {}; // For material deductions

            rawMaterialsConsumedThisBatch.forEach(material => {
                const outflowKey = db.ref(`${RAW_TEA_DATA_PATH}/${material.tableName}`).push().key;
                updates[`${RAW_TEA_DATA_PATH}/${material.tableName}/${outflowKey}`] = {
                    transactionDate: productionRunDetails.productionDate,
                    transactionType: 'outflow',
                    outflowProduct: productionRunDetails.finishedProductName,
                    outflowWeight: material.quantityUsed,
                    outflowNotes: `For Product: ${productionRunDetails.finishedProductCode}, Batch: ${productionRunDetails.batchNumber || 'N/A'}`,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
            });
            packingMaterialsConsumedThisBatch.forEach(material => {
                const issueKey = db.ref(`${PACKING_MATERIAL_DATA_PATH}/${material.tableName}`).push().key;
                updates[`${PACKING_MATERIAL_DATA_PATH}/${material.tableName}/${issueKey}`] = {
                    transactionDate: productionRunDetails.productionDate,
                    transactionType: 'issue',
                    issueQty: material.quantityUsed,
                    issueReason: `For Product: ${productionRunDetails.finishedProductCode}, Batch: ${productionRunDetails.batchNumber || 'N/A'}`,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
            });

            const finishedProductRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productionRunDetails.finishedProductCode}`);

            try {
                if (Object.keys(updates).length > 0) {
                    await db.ref().update(updates); // Deduct materials
                }

                await finishedProductRef.transaction(currentData => {
                    const quantityAddedToSellable = productionRunDetails.quantityAddedToStockFromThisBatch;
                    const quantityForPending = productionRunDetails.totalQuantityProducedInBatch - quantityAddedToSellable;

                    if (currentData === null) { // New product
                        return {
                            ...productDefinitionData,
                            currentStock: quantityAddedToSellable,
                            pendingStock: quantityForPending,
                            addedToDelivery: 0, // Initialize addedToDelivery for new products
                            notes: productionRunDetails.notes,
                            batchNumberOnCreation: productionRunDetails.batchNumber,
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        };
                    } else { // Existing product
                        currentData.itemName = productDefinitionData.itemName; 
                        currentData.standardWeight = productDefinitionData.standardWeight;
                        currentData.weightUnit = productDefinitionData.weightUnit;
                        currentData.mrp = productDefinitionData.mrp;
                        currentData.sellingPrice = productDefinitionData.sellingPrice;
                        currentData.currentStock = (currentData.currentStock || 0) + quantityAddedToSellable;
                        currentData.pendingStock = (currentData.pendingStock || 0) + quantityForPending;
                        // notes and addedToDelivery are not modified here for existing products by production
                        // addedToDelivery will be updated by sales.js
                        if (typeof currentData.addedToDelivery === 'undefined') {
                             currentData.addedToDelivery = 0; // Initialize if it doesn't exist
                        }
                        currentData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                        return currentData;
                    }
                });

                alert("Production logged, product inventory updated successfully!");
                logProductionForm.reset();
                if (rawMaterialsConsumedContainer) rawMaterialsConsumedContainer.innerHTML = '';
                if (packingMaterialsConsumedContainer) packingMaterialsConsumedContainer.innerHTML = '';
                if (quantityPendingText) quantityPendingText.textContent = '0';
                if(productionDateInput) productionDateInput.valueAsDate = new Date();
                
                // Re-add initial material rows if tables are available
                // No longer adding initial rows automatically, as it's optional.
                // If the user wants to add, they click the button.

            } catch (error) {
                console.error("Error logging production:", error);
                alert("Error logging production. Check console for details. Some operations might have failed.");
            }
        });
    }

    // --- Load and Display Finished Products Inventory ---
    let currentSortCriteria = 'latestCreated';
    let currentSearchTerm = '';

    function loadFinishedProductsInventory() {
        const productsRef = db.ref(DEFINED_PRODUCTS_PATH);
        // Using .on() for real-time updates from Firebase (e.g., when sales occur)
        productsRef.on('value', snapshot => {
            console.log("Finished products data received from Firebase for production page.");
            allFinishedProducts = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    allFinishedProducts.push({ 
                        id: child.key, // productCode is the key
                        productCode: child.key, 
                        ...child.val() 
                    });
                });
            }
            renderFinishedProductsTable();
        }, err => {
            console.error("Error loading finished products on production page:", err);
            if(finishedProductsTableBody) {
                 finishedProductsTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">Error loading finished products. Check console.</td></tr>`;
            }
        });
    }

    function renderFinishedProductsTable() {
        if (!finishedProductsTableBody) return;
        finishedProductsTableBody.innerHTML = '';

        let productsToDisplay = [...allFinishedProducts];

        // Client-side Filter
        if (currentSearchTerm) {
            productsToDisplay = productsToDisplay.filter(p =>
                (p.itemName && p.itemName.toLowerCase().includes(currentSearchTerm)) ||
                (p.productCode && p.productCode.toLowerCase().includes(currentSearchTerm))
            );
        }

        // Client-side Sort
        switch (currentSortCriteria) {
            case 'latestCreated': productsToDisplay.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
            case 'oldestCreated': productsToDisplay.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
            case 'topSelling': productsToDisplay.sort((a, b) => (b.addedToDelivery || 0) - (a.addedToDelivery || 0)); break; // Changed from totalSold
            case 'lowestSelling': productsToDisplay.sort((a, b) => (a.addedToDelivery || 0) - (b.addedToDelivery || 0)); break; // Changed from totalSold
            case 'productNameAZ': productsToDisplay.sort((a, b) => (a.itemName || "").localeCompare(b.itemName || "")); break;
            case 'productNameZA': productsToDisplay.sort((a, b) => (b.itemName || "").localeCompare(a.itemName || "")); break;
            default: productsToDisplay.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        if (productsToDisplay.length > 0) {
            if(noFinishedProductsText) noFinishedProductsText.style.display = 'none';
            productsToDisplay.forEach(product => {
                const row = finishedProductsTableBody.insertRow();
                row.insertCell().textContent = product.productCode;
                row.insertCell().textContent = product.itemName;
                const stdWeightCell = row.insertCell(); stdWeightCell.textContent = product.standardWeight ? `${product.standardWeight}` : 'N/A'; stdWeightCell.classList.add('text-right');
                row.insertCell().textContent = product.weightUnit || 'N/A';
                const mrpCell = row.insertCell(); mrpCell.textContent = formatCurrency(product.mrp); mrpCell.classList.add('text-right');
                const spCell = row.insertCell(); spCell.textContent = formatCurrency(product.sellingPrice); spCell.classList.add('text-right');
                
                const sellableStockCell = row.insertCell(); sellableStockCell.textContent = product.currentStock || 0; sellableStockCell.classList.add('text-center');
                const pendingStockCell = row.insertCell(); pendingStockCell.textContent = product.pendingStock || 0; pendingStockCell.classList.add('text-center');
                const addedToDeliveryCell = row.insertCell(); addedToDeliveryCell.textContent = product.addedToDelivery || 0; addedToDeliveryCell.classList.add('text-center'); // Changed from totalSold

                row.insertCell().textContent = formatDate(product.createdAt);

                const actionsCell = row.insertCell(); actionsCell.classList.add('text-center', 'actions-cell');
                
                const addPendingBtn = document.createElement('button');
                addPendingBtn.innerHTML = '<i class="fas fa-plus-square"></i> To Sellable';
                addPendingBtn.classList.add('btn', 'btn-info', 'btn-sm');
                addPendingBtn.title = 'Move Pending Stock to Sellable Stock';
                addPendingBtn.style.marginRight = '5px';
                addPendingBtn.disabled = !(product.pendingStock > 0); 
                addPendingBtn.onclick = () => handleAddPendingToSellable(product.productCode, product.pendingStock, product.itemName);
                actionsCell.appendChild(addPendingBtn);

                const deleteProductBtn = document.createElement('button');
                deleteProductBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                deleteProductBtn.classList.add('btn', 'btn-danger', 'btn-sm');
                deleteProductBtn.title = `Delete product: ${product.itemName}`;
                deleteProductBtn.onclick = () => handleDeleteFinishedProduct(product.productCode, product.itemName);
                actionsCell.appendChild(deleteProductBtn);
            });
        } else {
            if(noFinishedProductsText) {
                noFinishedProductsText.style.display = 'block';
                noFinishedProductsText.textContent = currentSearchTerm ? 'No products match your search.' : 'No finished products defined yet. Log a production run to add products.';
            }
        }
    }
    
    async function handleAddPendingToSellable(productCode, pendingQty, itemName) {
        if (!pendingQty || pendingQty <= 0) {
            alert("No pending stock to move.");
            return;
        }
        const qtyToMoveStr = prompt(`How many units of "${itemName}" (Pending: ${pendingQty}) do you want to move to Sellable Stock?`, pendingQty);
        if (qtyToMoveStr === null) return; // User cancelled

        const numQtyToMove = parseInt(qtyToMoveStr);
        if (isNaN(numQtyToMove) || numQtyToMove <= 0) {
            alert("Invalid quantity entered. Please enter a positive number.");
            return;
        }
        if (numQtyToMove > pendingQty) {
            alert(`Cannot move more than available pending stock (${pendingQty}).`);
            return;
        }

        const productRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`);
        try {
            await productRef.transaction(currentData => {
                if (currentData) {
                    currentData.currentStock = (currentData.currentStock || 0) + numQtyToMove;
                    currentData.pendingStock = (currentData.pendingStock || 0) - numQtyToMove;
                    currentData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                    return currentData;
                }
                return currentData; // Abort if product somehow deleted during transaction
            });
            alert(`${numQtyToMove} units of "${itemName}" moved to sellable stock.`);
            // Table will update via Firebase listener
        } catch (error) {
            console.error("Error moving pending stock:", error);
            alert("Failed to move pending stock. Check console.");
        }
    }

    async function handleDeleteFinishedProduct(productCode, productName) {
        const confirmationMessage = `Are you sure you want to permanently delete the finished product "${productName}" (Code: ${productCode})?\n
        This action is IRREVERSIBLE and will remove the product definition and its stock details.\n
        Associated raw material and packing material deduction records will NOT be automatically deleted or reverted.`;

        if (confirm(confirmationMessage)) {
            try {
                await db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`).remove();
                alert(`Product "${productName}" deleted successfully.`);
                // Table will update via Firebase listener
            } catch (error) {
                console.error(`Error deleting product ${productCode}:`, error);
                alert(`Error deleting product "${productName}". Check console for details.`);
            }
        }
    }

    if (sortFinishedProductsSelect) {
        sortFinishedProductsSelect.addEventListener('change', (e) => {
            currentSortCriteria = e.target.value;
            renderFinishedProductsTable(); // Re-render with new sort
        });
    }
    if (searchFinishedProductsInput) {
        searchFinishedProductsInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            renderFinishedProductsTable(); // Re-render with new search term
        });
    }

    // --- Initial Page Load ---
    async function initializePage() {
        if(productionDateInput) productionDateInput.valueAsDate = new Date();
        
        // Fetch material table names for the production form
        await fetchTableNamesForSelect(RAW_TEA_METADATA_PATH, rawMaterialTableNames, "Raw Material");
        await fetchTableNamesForSelect(PACKING_MATERIAL_METADATA_PATH, packingMaterialTableNames, "Packing Material");

        // No longer adding initial material rows automatically
        // as the selection is now optional. The user will click 'Add' if needed.
        
        // Start listening for finished product updates and render the table
        loadFinishedProductsInventory(); 
    }

    initializePage();
});