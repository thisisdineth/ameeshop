document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM", // Replace with your actual API key
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
    const logDeliveryForm = document.getElementById('logDeliveryForm');
    const deliveryVehicleNumberInput = document.getElementById('deliveryVehicleNumber');
    const driverNameInput = document.getElementById('driverName');
    const productToLoadSelect = document.getElementById('productToLoad');
    const availableStockForProductText = document.getElementById('availableStockForProduct');
    const quantityToLoadInput = document.getElementById('quantityToLoad');
    const deliveryDateInput = document.getElementById('deliveryDate');

    const deliveryLogsTableBody = document.getElementById('deliveryLogsTableBody');
    const noDeliveryLogsText = document.getElementById('noDeliveryLogsText');
    const searchDeliveryLogsInput = document.getElementById('searchDeliveryLogs');

    // Firebase Paths
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const DELIVERY_LOGS_PATH = 'deliveryLogs'; // New path for delivery logs

    let allProducts = []; // Cache for products from definedFinishedProducts_v2
    let allDeliveryLogs = []; // Cache for delivery logs

    // --- Helper Functions ---
    function formatDate(timestampOrDateString) {
        if (!timestampOrDateString) return 'N/A';
        if (typeof timestampOrDateString === 'string' && timestampOrDateString.includes('-')) { // Handles YYYY-MM-DD
             const [year, month, day] = timestampOrDateString.split('-');
             return new Date(year, month - 1, day).toLocaleDateString('en-CA'); // Ensure consistent display
        }
        return new Date(timestampOrDateString).toLocaleDateString('en-CA'); // Handles timestamp
    }

    // --- Populate Products Select Dropdown ---
    async function loadProductsForSelect() {
        try {
            const snapshot = await db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName').once('value');
            allProducts = []; // Clear previous
            productToLoadSelect.innerHTML = '<option value="">-- Select Product --</option>'; // Reset

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const product = { id: childSnapshot.key, ...childSnapshot.val() };
                    allProducts.push(product);
                    if (product.itemName && product.productCode) {
                        const option = document.createElement('option');
                        option.value = product.productCode;
                        option.textContent = `${product.itemName} (${product.productCode}) - Stock: ${product.currentStock || 0}`;
                        option.dataset.currentStock = product.currentStock || 0;
                        productToLoadSelect.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error("Error loading products for select:", error);
            availableStockForProductText.textContent = "Error loading products.";
        }
    }

    if (productToLoadSelect) {
        productToLoadSelect.addEventListener('change', () => {
            const selectedOption = productToLoadSelect.options[productToLoadSelect.selectedIndex];
            if (selectedOption && selectedOption.value) {
                availableStockForProductText.textContent = `Available for loading: ${selectedOption.dataset.currentStock || 0}`;
            } else {
                availableStockForProductText.textContent = "Available for loading: 0";
            }
        });
    }


    // --- Log Delivery Form Submission ---
    if (logDeliveryForm) {
        logDeliveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const vehicleNumber = deliveryVehicleNumberInput.value.trim();
            const driverName = driverNameInput.value.trim();
            const productCode = productToLoadSelect.value;
            const quantityToLoad = parseInt(quantityToLoadInput.value);
            const deliveryDate = deliveryDateInput.value; // YYYY-MM-DD format

            if (!vehicleNumber || !driverName || !productCode || !quantityToLoad || !deliveryDate) {
                alert("Please fill all fields: Vehicle No., Driver, Product, Quantity, and Date.");
                return;
            }
            if (quantityToLoad <= 0) {
                alert("Quantity to load must be a positive number.");
                return;
            }

            const selectedProduct = allProducts.find(p => p.productCode === productCode);
            if (!selectedProduct) {
                alert("Invalid product selected.");
                return;
            }
            const currentStock = parseInt(selectedProduct.currentStock || 0);
            if (quantityToLoad > currentStock) {
                alert(`Not enough stock for ${selectedProduct.itemName}. Available: ${currentStock}, Trying to load: ${quantityToLoad}`);
                return;
            }

            const productRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`);

            try {
                // Check for an existing delivery log entry for this vehicle, driver, product, and date
                const existingLogSnapshot = await db.ref(DELIVERY_LOGS_PATH)
                    .orderByChild('vehicleNumber').equalTo(vehicleNumber)
                    .once('value');

                let existingLogToUpdate = null;

                if (existingLogSnapshot.exists()) {
                    existingLogSnapshot.forEach(childSnapshot => {
                        const log = childSnapshot.val();
                        // Match vehicle, driver, product, and delivery date
                        if (log.driverName === driverName &&
                            log.productCode === productCode &&
                            log.deliveryDate === deliveryDate) {
                            existingLogToUpdate = { id: childSnapshot.key, ...log };
                            return true; // Break forEach
                        }
                    });
                }

                if (existingLogToUpdate) {
                    // Update existing log entry
                    const logToUpdateRef = db.ref(`${DELIVERY_LOGS_PATH}/${existingLogToUpdate.id}`);
                    await logToUpdateRef.transaction(currentLogData => {
                        if (currentLogData) {
                            currentLogData.quantityLoaded = (currentLogData.quantityLoaded || 0) + quantityToLoad;
                            currentLogData.stockInVehicle = (currentLogData.stockInVehicle || 0) + quantityToLoad;
                            // quantitySold remains unchanged here, as it's handled by sales.js
                            return currentLogData;
                        }
                        return currentLogData; // Abort if log deleted mid-transaction
                    });

                    // Update main product inventory (similar to before)
                    await productRef.transaction(productData => {
                        if (productData) {
                            productData.currentStock = (productData.currentStock || 0) - quantityToLoad;
                            productData.addedToDelivery = (productData.addedToDelivery || 0) + quantityToLoad;
                            productData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return productData;
                        }
                        return productData;
                    });

                    alert(`${quantityToLoad} units of ${selectedProduct.itemName} added to existing entry for vehicle ${vehicleNumber}.`);

                } else {
                    // Create a new delivery log entry
                    const deliveryLogRef = db.ref(DELIVERY_LOGS_PATH).push();
                    const deliveryLogData = {
                        deliveryLogId: deliveryLogRef.key,
                        vehicleNumber: vehicleNumber,
                        driverName: driverName,
                        productCode: productCode,
                        productName: selectedProduct.itemName,
                        quantityLoaded: quantityToLoad,
                        quantitySold: 0, // Initialize sold quantity to 0
                        stockInVehicle: quantityToLoad, // Initially, stockInVehicle is same as quantityLoaded
                        deliveryDate: deliveryDate, // Storing as YYYY-MM-DD string
                        loadedAtTimestamp: firebase.database.ServerValue.TIMESTAMP
                    };
                    await deliveryLogRef.set(deliveryLogData);

                    // Update main product inventory (similar to before)
                    await productRef.transaction(productData => {
                        if (productData) {
                            productData.currentStock = (productData.currentStock || 0) - quantityToLoad;
                            productData.addedToDelivery = (productData.addedToDelivery || 0) + quantityToLoad;
                            productData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return productData;
                        }
                        return productData;
                    });

                    alert(`${quantityToLoad} units of ${selectedProduct.itemName} added to NEW entry for vehicle ${vehicleNumber}.`);
                }

                logDeliveryForm.reset();
                availableStockForProductText.textContent = "Available for loading: 0";
                if(deliveryDateInput) deliveryDateInput.valueAsDate = new Date(); // Reset date to today
                loadProductsForSelect(); // Refresh product stock in dropdown

            } catch (error) {
                console.error("Error adding stock to delivery:", error);
                alert("Error adding stock to delivery. Check console for details.");
            }
        });
    }

    // --- Load and Display Delivery Logs ---
    let currentSearchTerm = '';

    function loadDeliveryLogs() {
        const logsRef = db.ref(DELIVERY_LOGS_PATH).orderByChild('loadedAtTimestamp');
        logsRef.on('value', snapshot => {
            allDeliveryLogs = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    allDeliveryLogs.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
            allDeliveryLogs.reverse(); // Show newest first
            renderDeliveryLogsTable();
        }, err => {
            console.error("Error loading delivery logs:", err);
            if (deliveryLogsTableBody) {
                deliveryLogsTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error loading delivery logs.</td></tr>`; // Updated colspan
            }
        });
    }

    function renderDeliveryLogsTable() {
        if (!deliveryLogsTableBody) return;
        deliveryLogsTableBody.innerHTML = '';

        let logsToDisplay = [...allDeliveryLogs];

        if (currentSearchTerm) {
            logsToDisplay = logsToDisplay.filter(log =>
                (log.vehicleNumber && log.vehicleNumber.toLowerCase().includes(currentSearchTerm)) ||
                (log.driverName && log.driverName.toLowerCase().includes(currentSearchTerm)) ||
                (log.productName && log.productName.toLowerCase().includes(currentSearchTerm)) ||
                (log.productCode && log.productCode.toLowerCase().includes(currentSearchTerm))
            );
        }

        if (logsToDisplay.length > 0) {
            if (noDeliveryLogsText) noDeliveryLogsText.style.display = 'none';
            logsToDisplay.forEach(log => {
                const row = deliveryLogsTableBody.insertRow();
                row.insertCell().textContent = formatDate(log.deliveryDate || log.loadedAtTimestamp);
                row.insertCell().textContent = log.vehicleNumber;
                row.insertCell().textContent = log.driverName;
                row.insertCell().textContent = log.productCode;
                row.insertCell().textContent = log.productName;
                const loadedCell = row.insertCell(); loadedCell.textContent = log.quantityLoaded; loadedCell.classList.add('text-right');

                // NEW SOLD CELL
                const soldCell = row.insertCell();
                soldCell.textContent = log.quantitySold || 0; // Display quantitySold, default to 0
                soldCell.classList.add('text-right');
                soldCell.id = `sold-${log.id}`; // For potential real-time updates

                // Listen for real-time updates to quantitySold for this specific log entry
                const soldRef = db.ref(`${DELIVERY_LOGS_PATH}/${log.id}/quantitySold`);
                soldRef.on('value', soldSnapshot => {
                    const updatedSold = soldSnapshot.val();
                    const cell = document.getElementById(`sold-${log.id}`);
                    if (cell) {
                        cell.textContent = updatedSold !== null ? updatedSold : 0;
                        const cachedLog = allDeliveryLogs.find(l => l.id === log.id);
                        if (cachedLog) cachedLog.quantitySold = updatedSold;
                    }
                });

                const stockInVehicleCell = row.insertCell();
                stockInVehicleCell.textContent = log.stockInVehicle;
                stockInVehicleCell.classList.add('text-right');
                stockInVehicleCell.id = `stock-${log.id}`; // For potential real-time updates

                // Listen for real-time updates to stockInVehicle for this specific log entry
                const stockRef = db.ref(`${DELIVERY_LOGS_PATH}/${log.id}/stockInVehicle`);
                stockRef.on('value', stockSnapshot => {
                    const updatedStock = stockSnapshot.val();
                    const cell = document.getElementById(`stock-${log.id}`);
                    if (cell) {
                        cell.textContent = updatedStock !== null ? updatedStock : 0;
                        // Update the local cache if needed, though 'allDeliveryLogs' is refreshed on any top-level change too
                        const cachedLog = allDeliveryLogs.find(l => l.id === log.id);
                        if (cachedLog) cachedLog.stockInVehicle = updatedStock;
                        // Also update the unload button state
                        const unloadBtn = row.querySelector('.unload-btn');
                        if (unloadBtn) {
                            unloadBtn.disabled = !(updatedStock > 0);
                        }
                    }
                });


                const actionsCell = row.insertCell(); actionsCell.classList.add('text-center', 'actions-cell-multi-btn'); // Add a class for potential styling if buttons stack

                // UNLOAD STOCK BUTTON
                const unloadBtn = document.createElement('button');
                unloadBtn.innerHTML = '<i class="fas fa-undo fa-fw"></i> Unload';
                unloadBtn.classList.add('btn', 'btn-secondary', 'btn-sm', 'unload-btn'); // Add a class for easy selection
                unloadBtn.title = 'Unload stock from vehicle back to production';
                unloadBtn.style.marginRight = '5px'; // Add some spacing between buttons
                // Disable if stock in vehicle is 0 or less (initial state)
                unloadBtn.disabled = !(log.stockInVehicle > 0);
                unloadBtn.onclick = () => handleUnloadStock(log.id, log.productCode, log.productName, log.stockInVehicle);
                actionsCell.appendChild(unloadBtn);


                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt fa-fw"></i> Delete';
                deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
                deleteBtn.title = 'Delete this delivery log entry';
                deleteBtn.onclick = () => handleDeleteDeliveryLog(log.id, log.productCode, log.quantityLoaded, log.productName, log.vehicleNumber, log.stockInVehicle); // Pass stockInVehicle
                actionsCell.appendChild(deleteBtn);
            });
        } else {
            if (noDeliveryLogsText) {
                noDeliveryLogsText.style.display = 'block';
                noDeliveryLogsText.textContent = currentSearchTerm ? 'No logs match your search.' : 'No delivery logs yet.';
            }
        }
    }

    async function handleDeleteDeliveryLog(logId, productCode, quantityLoaded, productName, vehicleNumber, currentStockInVehicle) {
        const confirmation = confirm(
`Are you sure you want to delete this delivery log?
Vehicle: ${vehicleNumber}
Product: ${productName} (Qty Loaded: ${quantityLoaded}, Qty Currently in Vehicle: ${currentStockInVehicle})

This action will attempt to:
1. Delete the delivery log entry.
2. Add ${currentStockInVehicle} units (the remaining stock in vehicle) back to the main stock for ${productName} (${productCode}).
3. Reduce the global 'Added to Delivery' count for ${productCode} by ${quantityLoaded}.

This is a sensitive operation. Proceed with caution.`
        );

        if (confirmation) {
            const deliveryLogRef = db.ref(`${DELIVERY_LOGS_PATH}/${logId}`);
            const productRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`);

            try {
                // Transaction to revert stock changes in definedFinishedProducts_v2
                await productRef.transaction(productData => {
                    if (productData) {
                        productData.currentStock = (productData.currentStock || 0) + currentStockInVehicle; // Revert only the stock still in vehicle
                        productData.addedToDelivery = (productData.addedToDelivery || 0) - quantityLoaded; // Decrease by total loaded
                        if (productData.addedToDelivery < 0) productData.addedToDelivery = 0; // Ensure it doesn't go negative
                        productData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                        return productData;
                    }
                    return productData; // Product not found, abort
                });

                // Delete the delivery log entry
                await deliveryLogRef.remove();

                alert(`Delivery log for ${productName} on vehicle ${vehicleNumber} deleted. Stock reverted.`);
                // Table will re-render due to the main listener on DELIVERY_LOGS_PATH
                loadProductsForSelect(); // Refresh product stock in dropdown after revert

            } catch (error) {
                console.error("Error deleting delivery log and reverting stock:", error);
                alert("Error deleting delivery log. Stock might not have been reverted correctly. Check console and Firebase data.");
            }
        }
    }

    // --- Handle Unload Stock from Vehicle to Production ---
    async function handleUnloadStock(logId, productCode, productName, stockInVehicle) {
        if (stockInVehicle <= 0) {
            alert(`No stock to unload for ${productName} in this delivery log.`);
            return;
        }

        const qtyToUnloadStr = prompt(`How many units of "${productName}" (Stock in Vehicle: ${stockInVehicle}) do you want to unload back to production?`, stockInVehicle);
        if (qtyToUnloadStr === null) return; // User cancelled

        const numQtyToUnload = parseInt(qtyToUnloadStr);
        if (isNaN(numQtyToUnload) || numQtyToUnload <= 0) {
            alert("Invalid quantity entered. Please enter a positive number.");
            return;
        }
        if (numQtyToUnload > stockInVehicle) {
            alert(`Cannot unload more than available stock in vehicle (${stockInVehicle}).`);
            return;
        }

        const deliveryLogRef = db.ref(`${DELIVERY_LOGS_PATH}/${logId}`);
        const productRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`);

        try {
            // Transaction to update the delivery log's stockInVehicle
            await deliveryLogRef.transaction(currentLog => {
                if (currentLog) {
                    currentLog.stockInVehicle = (currentLog.stockInVehicle || 0) - numQtyToUnload;
                    return currentLog;
                }
                return currentLog; // Abort if log somehow deleted during transaction
            });

            // Transaction to add stock back to the main product inventory
            await productRef.transaction(productData => {
                if (productData) {
                    productData.currentStock = (productData.currentStock || 0) + numQtyToUnload;
                    // Also reduce 'addedToDelivery' for accurate tracking
                    productData.addedToDelivery = (productData.addedToDelivery || 0) - numQtyToUnload;
                    if (productData.addedToDelivery < 0) productData.addedToDelivery = 0; // Prevent negative
                    productData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                    return productData;
                }
                return productData; // Abort if product deleted mid-transaction
            });

            alert(`${numQtyToUnload} units of "${productName}" unloaded from vehicle and moved back to production stock.`);
            // The table will re-render automatically due to Firebase listeners
            loadProductsForSelect(); // Refresh available stock in the "Add Stock" dropdown

        } catch (error) {
            console.error("Error unloading stock:", error);
            alert("Failed to unload stock. Check console for details. Data might be inconsistent.");
        }
    }


    if (searchDeliveryLogsInput) {
        searchDeliveryLogsInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            renderDeliveryLogsTable();
        });
    }

    // --- Initial Page Load ---
    function initializePage() {
        if(deliveryDateInput) deliveryDateInput.valueAsDate = new Date(); // Set to today
        loadProductsForSelect();
        loadDeliveryLogs();
    }

    initializePage();
});