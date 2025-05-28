document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = { // YOUR FIREBASE CONFIG
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
    const { jsPDF } = window.jspdf;

    // --- Navbar ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    // Delivery Selection
    const deliveryVehicleNumberInput = document.getElementById('deliveryVehicleNumberInput');
    const vehicleSuggestionsListEl = document.getElementById('vehicleSuggestionsList');
    const driverNameInput = document.getElementById('driverNameInput');
    const driverSuggestionsListEl = document.getElementById('driverSuggestionsList');
    const selectedDeliveryInfoEl = document.getElementById('selectedDeliveryInfo');

    // Sale Form
    const saleForm = document.getElementById('saleForm');
    const saleDateInput = document.getElementById('saleDate');
    const customerCitySelect = document.getElementById('customerCitySelect');
    const newCityNameInput = document.getElementById('newCityNameInput');
    const customerNameInput = document.getElementById('customerName');
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const selectedCustomerCityNameInput = document.getElementById('selectedCustomerCityName');
    const installmentDueMessage = document.getElementById('installmentDueMessage'); // New: for installment due

    const saleItemsContainer = document.getElementById('saleItemsContainer');
    const addSaleItemButton = document.getElementById('addSaleItemButton');
    const completeSaleButton = document.getElementById('completeSaleButton');

    const subTotalInput = document.getElementById('subTotal');
    const overallDiscountValueInput = document.getElementById('overallDiscountValueInput');
    const grandTotalInput = document.getElementById('grandTotal');
    const paymentMethodInput = document.getElementById('paymentMethod');
    const installmentFieldsContainer = document.getElementById('installmentFieldsContainer');
    const amountPaidInput = document.getElementById('amountPaid');
    const remainingBalanceInput = document.getElementById('remainingBalance');
    const saleNotesInput = document.getElementById('saleNotes');

    // Sales History
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');
    const noSalesHistoryText = document.getElementById('noSalesHistoryText');

    // Firebase Paths
    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const DELIVERY_LOGS_PATH = 'deliveryLogs'; // From delivery.js
    const CITIES_PATH = 'cities';

    // Caches
    let definedProductsCache = []; // All products from main inventory (for price, name)
    let deliveryLogsCache = [];    // All delivery log entries
    let customersCache = [];
    let citiesCache = [];
    let allSalesData = {};

    // Sale State
    let selectedDeliveryVehicleContext = null; // Stores { vehicleNumber, driverName, aggregatedStock: [{productCode, productName, stockInVehicle, sellingPrice, sourceDeliveryLogIds:[]}] }
    let productsAvailableInSelectedVehicle = []; // Products available in the chosen vehicle for dropdowns

    async function initializeSalesPage() {
        if (saleDateInput) saleDateInput.valueAsDate = new Date();

        await fetchCitiesAndPopulateDropdown();
        await fetchDefinedProductsOnce(); // For prices, names
        await fetchDeliveryLogs();        // For vehicle stock and selection

        listenForProductUpdates(); // For main product definitions (though less critical for sale items now)
        await fetchCustomersForSuggestions();

        // Initial state: disable sale actions until vehicle is selected
        if (addSaleItemButton) addSaleItemButton.disabled = true;
        if (completeSaleButton) completeSaleButton.disabled = true;

        loadSalesLog(); // Sales history
        toggleCustomerNameInputState(); // Customer input logic
        handlePaymentMethodChange();    // Payment method logic

        // Event Listeners
        if (deliveryVehicleNumberInput) deliveryVehicleNumberInput.addEventListener('input', () => handleDeliveryInput(deliveryVehicleNumberInput, 'vehicleNumber', vehicleSuggestionsListEl));
        if (driverNameInput) driverNameInput.addEventListener('input', () => handleDeliveryInput(driverNameInput, 'driverName', driverSuggestionsListEl));

        // Click outside to close suggestions
        document.addEventListener('click', (event) => {
            if (vehicleSuggestionsListEl && deliveryVehicleNumberInput && !deliveryVehicleNumberInput.contains(event.target) && !vehicleSuggestionsListEl.contains(event.target)) {
                vehicleSuggestionsListEl.style.display = 'none';
            }
            if (driverSuggestionsListEl && driverNameInput && !driverNameInput.contains(event.target) && !driverSuggestionsListEl.contains(event.target)) {
                driverSuggestionsListEl.style.display = 'none';
            }
            if (customerSuggestionsListEl && customerNameInput && !customerNameInput.contains(event.target) && !customerSuggestionsListEl.contains(event.target)) {
                customerSuggestionsListEl.style.display = 'none';
            }
        });

        if (customerCitySelect) customerCitySelect.addEventListener('change', handleCityChange);
        if (newCityNameInput) newCityNameInput.addEventListener('input', handleNewCityInput);
        if (customerNameInput) customerNameInput.addEventListener('change', checkCustomerInstallmentStatus); // New listener
        if (paymentMethodInput) paymentMethodInput.addEventListener('change', handlePaymentMethodChange);
        if (amountPaidInput) amountPaidInput.addEventListener('input', calculateRemainingBalanceAndUpdateTotals);
        if (overallDiscountValueInput) overallDiscountValueInput.addEventListener('input', calculateTotals);
        if (searchSalesInput) searchSalesInput.addEventListener('input', displayFilteredSales);
        if (addSaleItemButton) addSaleItemButton.addEventListener('click', addSaleItemRow);
        if (saleForm) saleForm.addEventListener('submit', handleSaleFormSubmit);
    }

    // --- Delivery Vehicle Selection Logic ---
    async function fetchDeliveryLogs() {
        try {
            const snapshot = await db.ref(DELIVERY_LOGS_PATH).orderByChild('loadedAtTimestamp').once('value');
            deliveryLogsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    // Only include logs that might have stock
                    if ((child.val().stockInVehicle || 0) > 0) {
                         deliveryLogsCache.push({ deliveryLogId: child.key, ...child.val() });
                    }
                });
                deliveryLogsCache.reverse(); // Newest first
                console.log("Fetched Delivery Logs with stock:", deliveryLogsCache.length);
            }
        } catch (error) {
            console.error("Error fetching delivery logs:", error);
        }
    }

    function handleDeliveryInput(inputElement, type, suggestionsElement) {
        const searchTerm = inputElement.value.toLowerCase().trim();
        suggestionsElement.innerHTML = '';
        if (searchTerm.length < 1) {
            suggestionsElement.style.display = 'none';
            clearDeliverySelection(); // If input is cleared, reset selection
            return;
        }

        let suggestions = [];
        if (type === 'vehicleNumber') {
            const seen = new Set();
            deliveryLogsCache.forEach(log => {
                if (log.vehicleNumber && log.vehicleNumber.toLowerCase().includes(searchTerm) && !seen.has(log.vehicleNumber.toLowerCase())) {
                    suggestions.push({ text: `${log.vehicleNumber} (Driver: ${log.driverName || 'N/A'})`, value: log.vehicleNumber, driver: log.driverName });
                    seen.add(log.vehicleNumber.toLowerCase());
                }
            });
        } else if (type === 'driverName') {
            const seen = new Set();
            deliveryLogsCache.forEach(log => {
                if (log.driverName && log.driverName.toLowerCase().includes(searchTerm) && !seen.has(log.driverName.toLowerCase())) {
                    suggestions.push({ text: `${log.driverName} (Vehicle: ${log.vehicleNumber || 'N/A'})`, value: log.driverName, vehicle: log.vehicleNumber });
                    seen.add(log.driverName.toLowerCase());
                }
            });
        }

        if (suggestions.length > 0) {
            const ul = document.createElement('ul');
            suggestions.slice(0, 7).forEach(sugg => { // Limit suggestions
                const li = document.createElement('li');
                li.textContent = sugg.text;
                li.addEventListener('click', () => {
                    if (type === 'vehicleNumber') {
                        deliveryVehicleNumberInput.value = sugg.value;
                        if (driverNameInput && sugg.driver) driverNameInput.value = sugg.driver;
                    } else {
                        driverNameInput.value = sugg.value;
                        if (deliveryVehicleNumberInput && sugg.vehicle) deliveryVehicleNumberInput.value = sugg.vehicle;
                    }
                    suggestionsElement.style.display = 'none';
                    confirmDeliveryVehicleSelection(deliveryVehicleNumberInput.value, driverNameInput.value);
                });
                ul.appendChild(li);
            });
            suggestionsElement.appendChild(ul);
            suggestionsElement.style.display = 'block';
        } else {
            suggestionsElement.innerHTML = '<li>No matching delivery logs found.</li>';
            suggestionsElement.style.display = 'block';
            clearDeliverySelection();
        }
    }

    function clearDeliverySelection() {
        selectedDeliveryVehicleContext = null;
        productsAvailableInSelectedVehicle = [];
        if(selectedDeliveryInfoEl) {
            selectedDeliveryInfoEl.textContent = '';
            selectedDeliveryInfoEl.style.display = 'none';
        }
        if(saleItemsContainer) saleItemsContainer.innerHTML = ''; // Clear existing sale items
        if(addSaleItemButton) addSaleItemButton.disabled = true;
        if(completeSaleButton) completeSaleButton.disabled = true;
        calculateTotals(); // Reset totals
    }

    function confirmDeliveryVehicleSelection(vehicleNo, driverName) {
        vehicleNo = vehicleNo.trim();
        driverName = driverName.trim();

        if (!vehicleNo && !driverName) {
            clearDeliverySelection();
            return;
        }

        // Filter logs that match BOTH vehicle AND driver if both are provided, or just one if only one is.
        const relevantLogs = deliveryLogsCache.filter(log => {
            const vehicleMatch = vehicleNo ? (log.vehicleNumber || '').toLowerCase() === vehicleNo.toLowerCase() : true;
            const driverMatch = driverName ? (log.driverName || '').toLowerCase() === driverName.toLowerCase() : true;
            return vehicleMatch && driverMatch && (log.stockInVehicle || 0) > 0;
        });

        if (relevantLogs.length === 0) {
            if(selectedDeliveryInfoEl) {
                selectedDeliveryInfoEl.textContent = `No active stock found for Vehicle: ${vehicleNo || 'Any'}, Driver: ${driverName || 'Any'}.`;
                selectedDeliveryInfoEl.style.display = 'block';
            }
            clearDeliverySelection(); // Clear previous selection effects
            return;
        }

        // Aggregate stock for the selected vehicle context
        const aggregatedStock = {};
        relevantLogs.forEach(log => {
            const productDef = definedProductsCache.find(p => p.productCode === log.productCode);
            const sellingPrice = productDef ? productDef.sellingPrice : 0; // Get current SP

            if (!aggregatedStock[log.productCode]) {
                aggregatedStock[log.productCode] = {
                    productCode: log.productCode,
                    productName: log.productName || (productDef ? productDef.itemName : 'Unknown Product'),
                    totalStockInVehicle: 0,
                    sellingPrice: sellingPrice,
                    sourceDeliveryLogDetails: [] // To store specific log ID and its stock contribution
                };
            }
            aggregatedStock[log.productCode].totalStockInVehicle += log.stockInVehicle;
            aggregatedStock[log.productCode].sourceDeliveryLogDetails.push({
                deliveryLogId: log.deliveryLogId,
                stock: log.stockInVehicle,
                loadedAtTimestamp: log.loadedAtTimestamp // For FIFO if needed later
            });
        });

        // Sort source logs by timestamp for consistent FIFO-like deduction later
        for (const code in aggregatedStock) {
            aggregatedStock[code].sourceDeliveryLogDetails.sort((a,b) => (a.loadedAtTimestamp || 0) - (b.loadedAtTimestamp || 0));
        }

        productsAvailableInSelectedVehicle = Object.values(aggregatedStock).filter(p => p.totalStockInVehicle > 0);
        productsAvailableInSelectedVehicle.sort((a,b) => (a.productName || "").localeCompare(b.productName || ""));


        selectedDeliveryVehicleContext = { // Store the context
            vehicleNumber: relevantLogs[0].vehicleNumber, // Assuming all relevant logs have same vehicle/driver
            driverName: relevantLogs[0].driverName,
            // products: productsAvailableInSelectedVehicle // This is now separate
        };

        if (selectedDeliveryInfoEl) {
             selectedDeliveryInfoEl.textContent = `Selected Vehicle: ${selectedDeliveryVehicleContext.vehicleNumber}, Driver: ${selectedDeliveryVehicleContext.driverName}. ${productsAvailableInSelectedVehicle.length} product(s) available.`;
             selectedDeliveryInfoEl.style.display = 'block';
        }

        if (addSaleItemButton) addSaleItemButton.disabled = productsAvailableInSelectedVehicle.length === 0;
        if (completeSaleButton) completeSaleButton.disabled = productsAvailableInSelectedVehicle.length === 0;

        // Clear existing sale items and update dropdowns if any
        if(saleItemsContainer) saleItemsContainer.innerHTML = '';
        updateAllProductDropdownsBasedOnVehicle(); // Update any existing or new rows
        calculateTotals();

        if (productsAvailableInSelectedVehicle.length === 0) {
             if(selectedDeliveryInfoEl) selectedDeliveryInfoEl.textContent += " No items with stock found.";
        }
    }

    function updateAllProductDropdownsBasedOnVehicle() {
        document.querySelectorAll('.sale-item-row').forEach(selectElement => {
            const currentSelectedProductCode = selectElement.value;
            // const currentDeliveryLogId = selectElement.dataset.deliveryLogId; // If we were selecting specific log entries

            populateProductSelectFromVehicle(selectElement);

            // Try to re-select, or reset if not available
            if (productsAvailableInSelectedVehicle.some(p => p.productCode === currentSelectedProductCode)) {
                 selectElement.value = currentSelectedProductCode;
            } else {
                selectElement.value = "";
            }
            selectElement.dispatchEvent(new Event('change'));
        });
    }


    // --- Product Handling for Sale Items (from selected vehicle) ---
    function populateProductSelectFromVehicle(selectElement) {
        if (!selectElement) return;
        let optionsHTML = '<option value="" data-price="0" data-stock="0" data-name="">-- Select Product from Vehicle --</option>';

        if (productsAvailableInSelectedVehicle.length > 0) {
            productsAvailableInSelectedVehicle.forEach(p => {
                // p structure: {productCode, productName, totalStockInVehicle, sellingPrice, sourceDeliveryLogDetails}
                const stock = p.totalStockInVehicle || 0;
                const disabled = stock <= 0 ? 'disabled' : '';
                const stockDisplay = stock <= 0 ? 'Out of Stock' : `Stock: ${stock}`;
                // The value is productCode. We'll figure out which deliveryLogId to debit from during sale submission.
                optionsHTML += `<option value="${p.productCode}"
                                       data-price="${p.sellingPrice || 0}"
                                       data-name="${p.productName}"
                                       data-stock="${stock}"
                                       ${disabled}>
                                       ${p.productName} (${p.productCode}) - ${stockDisplay}
                                </option>`;
            });
        } else {
            optionsHTML = '<option value="" disabled>-- No Products in Selected Vehicle --</option>';
        }
        selectElement.innerHTML = optionsHTML;
    }

    function addSaleItemRow() {
        if (!saleItemsContainer || !selectedDeliveryVehicleContext || productsAvailableInSelectedVehicle.length === 0) {
            alert("Please select a delivery vehicle with available stock first.");
            return;
        }
        const itemRowDiv = document.createElement('div'); itemRowDiv.classList.add('sale-item-row', 'form-grid');

        const productSelectDiv = document.createElement('div'); productSelectDiv.classList.add('form-group');
        productSelectDiv.innerHTML = '<label class="form-label form-label-sm">Product (from Vehicle)</label>';
        const productSelect = document.createElement('select'); productSelect.classList.add('form-input', 'sale-item-product'); productSelect.required = true;
        populateProductSelectFromVehicle(productSelect); // Use vehicle specific products
        productSelectDiv.appendChild(productSelect);

        const qtyDiv = document.createElement('div'); qtyDiv.classList.add('form-group');
        qtyDiv.innerHTML = '<label class="form-label form-label-sm">Qty</label>';
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.min = "1"; qtyInput.classList.add('form-input', 'sale-item-qty'); qtyInput.placeholder = 'Qty'; qtyInput.required = true; qtyInput.value = "1";
        qtyDiv.appendChild(qtyInput);

        const priceDiv = document.createElement('div'); priceDiv.classList.add('form-group');
        priceDiv.innerHTML = '<label class="form-label form-label-sm">Price/Unit</label>';
        const priceInput = document.createElement('input'); priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.classList.add('form-input', 'sale-item-price'); priceInput.placeholder = 'Price'; priceInput.required = true; // Price can be edited
        priceDiv.appendChild(priceInput);

        const lineTotalDiv = document.createElement('div'); lineTotalDiv.classList.add('form-group', 'line-total-group');
        lineTotalDiv.innerHTML = '<label class="form-label form-label-sm">Line Total</label>';
        const lineTotalInput = document.createElement('input'); lineTotalInput.type = 'text'; lineTotalInput.classList.add('form-input', 'sale-item-linetotal'); lineTotalInput.placeholder = 'Total'; lineTotalInput.readOnly = true;
        lineTotalDiv.appendChild(lineTotalInput);

        const removeBtnDiv = document.createElement('div'); removeBtnDiv.classList.add('form-group');
        removeBtnDiv.style.paddingTop = '1.5em';
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm'); removeBtn.title="Remove Item";
        removeBtn.onclick = () => { itemRowDiv.remove(); calculateTotals(); };
        removeBtnDiv.appendChild(removeBtn);

        // Order: Product, Qty, Price, Line Total, Button
        itemRowDiv.appendChild(productSelectDiv); itemRowDiv.appendChild(qtyDiv); itemRowDiv.appendChild(priceDiv); itemRowDiv.appendChild(lineTotalDiv); itemRowDiv.appendChild(removeBtn);
        saleItemsContainer.appendChild(itemRowDiv);

        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption || !selectedOption.value) { // No product selected
                priceInput.value = ''; qtyInput.value = '1'; qtyInput.max = '';
                calculateTotals(); return;
            }
            priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStockInVehicle = parseInt(selectedOption.dataset.stock || 0);
            qtyInput.max = maxStockInVehicle;
            if (parseInt(qtyInput.value) > maxStockInVehicle || parseInt(qtyInput.value) <= 0 ) {
                qtyInput.value = maxStockInVehicle > 0 ? 1 : 0;
            }
            if (maxStockInVehicle === 0) { // Should be filtered out by populateProductSelectFromVehicle, but as a safeguard
                qtyInput.value = 0;
                if (selectedOption.dataset.name) alert(`"${selectedOption.dataset.name}" is out of stock in this vehicle.`);
            }
            calculateTotals();
        });

        qtyInput.addEventListener('input', calculateTotals);
        priceInput.addEventListener('input', calculateTotals);
        if (productSelect.value) productSelect.dispatchEvent(new Event('change')); // Trigger for pre-filled
    }


    // --- Calculation Logic (Item Discount Removed) ---
    function calculateTotals() {
        let currentSubTotal = 0;
        if (!document) return;
        document.querySelectorAll('.sale-item-row').forEach(row => {
            const productSelect = row.querySelector('.sale-item-product');
            const selectedOption = productSelect ? productSelect.options[productSelect.selectedIndex] : null;
            const stockInVehicleForProduct = selectedOption ? parseInt(selectedOption.dataset.stock || 0) : 0;

            const qtyInput = row.querySelector('.sale-item-qty');
            let qty = parseInt(qtyInput?.value || 0);

            if (qty > stockInVehicleForProduct && selectedOption && selectedOption.value && stockInVehicleForProduct >= 0) {
                alert(`Quantity for ${selectedOption.dataset.name} exceeds available stock in vehicle (${stockInVehicleForProduct}). Adjusting to max available.`);
                qty = stockInVehicleForProduct;
                if(qtyInput) qtyInput.value = qty;
            }
            if (qty < 0) { qty = 0; if(qtyInput) qtyInput.value = qty; }

            const price = parseFloat(row.querySelector('.sale-item-price')?.value || 0);
            const lineTotalField = row.querySelector('.sale-item-linetotal');

            if (qty > 0 && price >= 0) {
                const itemNetTotal = qty * price; // No item-level discount
                if(lineTotalField) lineTotalField.value = itemNetTotal.toFixed(2);
                currentSubTotal += itemNetTotal;
            } else { if(lineTotalField) lineTotalField.value = "0.00"; }
        });
        if(subTotalInput) subTotalInput.value = currentSubTotal.toFixed(2);

        const directDiscountAmount = parseFloat(overallDiscountValueInput?.value || 0);
        const calculatedGrandTotal = currentSubTotal - directDiscountAmount;
        if(grandTotalInput) grandTotalInput.value = calculatedGrandTotal > 0 ? calculatedGrandTotal.toFixed(2) : "0.00";

        if (paymentMethodInput && paymentMethodInput.value === 'Installment') {
            calculateRemainingBalance();
        }
    }

    // --- Form Submission (Modified for Delivery Stock and Sold Quantity) ---
    async function handleSaleFormSubmit(e) {
        e.preventDefault();
        if (!selectedDeliveryVehicleContext) {
            alert("Please select a delivery vehicle/driver before completing the sale.");
            return;
        }

        const saleDateVal = saleDateInput.value;
        let customerNameOriginal = customerNameInput.value.trim();
        // ... (customer and city handling logic - largely same as before) ...
        let customerId = selectedCustomerIdInput.value;
        let customerNameToSave = customerNameOriginal;

        let finalCustomerCity = "";
        if (customerCitySelect && customerCitySelect.value) {
            finalCustomerCity = customerCitySelect.value;
        } else if (newCityNameInput && newCityNameInput.value.trim()) {
            finalCustomerCity = newCityNameInput.value.trim();
        }

        if (!saleDateVal || !customerNameOriginal || !finalCustomerCity) {
            alert("Please fill Sale Date, Customer City (select or add new), and Customer Name."); return;
        }
        finalCustomerCity = finalCustomerCity.trim();
        let cityNormalizedForCheck = normalizeName(finalCustomerCity);

        const cityExists = citiesCache.some(city => normalizeName(city.name) === cityNormalizedForCheck);
        if (newCityNameInput.value.trim() && !cityExists) {
             try {
                const newCityRef = db.ref(CITIES_PATH).push();
                await newCityRef.set({ name: finalCustomerCity });
                await fetchCitiesAndPopulateDropdown();
             } catch (cityError) { console.error("Error saving new city:", cityError); alert("Could not save new city."); return; }
        } else if (cityExists) {
            const existingCityObj = citiesCache.find(city => normalizeName(city.name) === cityNormalizedForCheck);
            if(existingCityObj) finalCustomerCity = existingCityObj.name;
        }

        const itemsToSave = [];
        let allItemsValid = true;
        // This array will hold {productCode, itemName, quantity, unitPrice, lineTotal, sourceLogDebits: [{deliveryLogId, qtyToDeduct}]}

        document.querySelectorAll('.sale-item-row').forEach(row => {
            if (!allItemsValid) return;
            const productSelect = row.querySelector('.sale-item-product');
            const productCode = productSelect?.value;
            if (!productCode) return; // Skip empty rows if any

            const selectedOption = productSelect.options[productSelect.selectedIndex];
            const itemName = selectedOption?.dataset.name;
            const stockInVehicleForThisProduct = parseInt(selectedOption?.dataset.stock || 0); // Total stock for this product code in vehicle

            let quantity = parseInt(row.querySelector('.sale-item-qty')?.value || 0);
            const unitPrice = parseFloat(row.querySelector('.sale-item-price')?.value || 0);

            if (quantity <= 0 ) { alert(`Quantity for ${itemName || 'selected item'} must be > 0.`); allItemsValid = false; return; }
            if (quantity > stockInVehicleForThisProduct) {
                alert(`Not enough stock in vehicle for ${itemName}. Available: ${stockInVehicleForThisProduct}, Requested: ${quantity}. Sale cannot proceed.`);
                allItemsValid = false; return;
            }

            // Determine which deliveryLogIds to debit from for this productCode (FIFO based on sourceDeliveryLogDetails)
            const productAggregatedInfo = productsAvailableInSelectedVehicle.find(p => p.productCode === productCode);
            if (!productAggregatedInfo) {
                alert(`Product ${productCode} not found in current vehicle context. Please re-select vehicle or product.`);
                allItemsValid = false; return;
            }

            let quantityToDeductRemaining = quantity;
            const sourceLogDebits = [];
            for (const sourceLog of productAggregatedInfo.sourceDeliveryLogDetails) {
                if (quantityToDeductRemaining <= 0) break;
                const qtyFromThisLog = Math.min(quantityToDeductRemaining, sourceLog.stock);
                sourceLogDebits.push({ deliveryLogId: sourceLog.deliveryLogId, qtyToDeduct: qtyFromThisLog });
                quantityToDeductRemaining -= qtyFromThisLog;
            }

            if (quantityToDeductRemaining > 0) { // Should not happen if initial stock check was correct
                alert(`Error allocating stock for ${itemName}. Please refresh and try again.`);
                allItemsValid = false; return;
            }

            itemsToSave.push({
                productCode, itemName, quantity, unitPrice,
                lineTotal: quantity * unitPrice,
                sourceLogDebits // Store which delivery logs to update
            });
        });

        if (!allItemsValid) return;
        if (itemsToSave.length === 0) { alert("Please add at least one valid item to the sale."); return; }

        // --- Customer Saving/Lookup (same as before) ---
        const enteredNormalizedName = normalizeName(customerNameOriginal);
        if (!customerId) {
            const existingCustomerInCity = customersCache.find(
                c => c.normalizedName === enteredNormalizedName && (c.city || '').toLowerCase() === finalCustomerCity.toLowerCase()
            );
            if (existingCustomerInCity) {
                customerId = existingCustomerInCity.id;
                customerNameToSave = existingCustomerInCity.name;
            } else {
                try {
                    const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                    customerId = newCustomerRef.key;
                    await newCustomerRef.set({
                        customerId, name: customerNameOriginal, normalizedName: enteredNormalizedName,
                        city: finalCustomerCity, createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                    await fetchCustomersForSuggestions();
                } catch (customerError) { console.error("Error adding new customer:", customerError); alert("Could not save new customer."); return; }
            }
        } else {
             const selectedCustomer = customersCache.find(c => c.id === customerId);
             if (selectedCustomer) customerNameToSave = selectedCustomer.name;
        }

        let currentCustomerPreviousDue = 0;
        if (installmentDueMessage && installmentDueMessage.style.display === 'block') {
            const dueText = installmentDueMessage.textContent;
            const match = dueText.match(/Rs\. ([\d,]+\.\d{2})/);
            if (match && match[1]) {
                currentCustomerPreviousDue = parseFloat(match[1].replace(/,/g, ''));
            }
        }

        const saleEntry = {
            saleDate: saleDateVal, customerId, customerName: customerNameToSave, customerCity: finalCustomerCity,
            items: itemsToSave.map(item => ({ // Storing simplified item data in sale log
                productCode: item.productCode, itemName: item.itemName,
                quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal
            })),
            sourceVehicleNumber: selectedDeliveryVehicleContext.vehicleNumber, // Store source vehicle
            sourceDriverName: selectedDeliveryVehicleContext.driverName,     // Store source driver
            subTotal: parseFloat(subTotalInput.value),
            overallDiscountValue: parseFloat(overallDiscountValueInput.value) || 0,
            grandTotal: parseFloat(grandTotalInput.value),
            paymentMethod: paymentMethodInput.value,
            saleNotes: saleNotesInput.value.trim() || null,
            previousInstallmentDue: currentCustomerPreviousDue, // Store the previous due amount
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        // Installment logic (same as before)
        if (saleEntry.paymentMethod === 'Installment') {
            saleEntry.amountPaid = parseFloat(amountPaidInput.value) || 0;
            saleEntry.remainingBalance = parseFloat(remainingBalanceInput.value) || 0;
            if (saleEntry.amountPaid > saleEntry.grandTotal && saleEntry.grandTotal > 0) { alert("Amount paid cannot exceed Grand Total for installment."); return; }
            if (saleEntry.amountPaid < 0) { alert("Amount paid cannot be negative."); return; }
        }


        // --- Transactional Stock Update (Delivery Logs & Main Product TotalSold) and Sale Record ---
        try {
            const transactionPromises = [];

            // Transactions for deliveryLog stockInVehicle AND quantitySold
            itemsToSave.forEach(item => {
                item.sourceLogDebits.forEach(debit => {
                    const logRef = db.ref(`${DELIVERY_LOGS_PATH}/${debit.deliveryLogId}`);
                    transactionPromises.push(
                        logRef.transaction(currentLog => {
                            if (currentLog) {
                                currentLog.stockInVehicle = (currentLog.stockInVehicle || 0) - debit.qtyToDeduct;
                                currentLog.quantitySold = (currentLog.quantitySold || 0) + debit.qtyToDeduct; // Increment quantitySold
                                return currentLog;
                            }
                            return currentLog; // Abort if log somehow deleted during transaction
                        }, (error, committed, snapshot) => {
                             if (error) throw new Error(`Failed to update stock/sold for log ${debit.deliveryLogId}: ${error.message}`);
                             if (!committed) throw new Error(`Stock/sold update not committed for log ${debit.deliveryLogId}. Stock may be insufficient or item removed.`);
                        }, false)
                    );
                });
            });

            // Transactions for definedProducts totalSold
            itemsToSave.forEach(item => {
                const productTotalSoldRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${item.productCode}/totalSold`);
                const productUpdatedAtRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${item.productCode}/updatedAt`);
                transactionPromises.push(
                    productTotalSoldRef.transaction(currentTotalSold => {
                        return (currentTotalSold || 0) + item.quantity;
                    }, (error, committed, snapshot) => {
                        if (error) throw new Error(`Failed to update totalSold for ${item.productCode}: ${error.message}`);
                        if (!committed) throw new Error(`totalSold update not committed for ${item.productCode}.`);
                    }, false)
                );
                // Separately update 'updatedAt' for the main product
                transactionPromises.push(productUpdatedAtRef.set(firebase.database.ServerValue.TIMESTAMP));
            });

            await Promise.all(transactionPromises);

            // If all transactions successful, save the sale
            const newSaleRef = db.ref(SALES_LOG_PATH).push();
            saleEntry.saleId = newSaleRef.key;
            await newSaleRef.set(saleEntry);

            alert(`Sale recorded! ID: ${saleEntry.saleId}`);
            generateAndShowInvoice(saleEntry);

            // Reset form and state
            if(saleForm) saleForm.reset();
            if(saleItemsContainer) saleItemsContainer.innerHTML = '';
            if(saleDateInput) saleDateInput.valueAsDate = new Date();
            if(customerCitySelect) customerCitySelect.value = '';
            if(newCityNameInput) newCityNameInput.value = '';
            if(customerNameInput) customerNameInput.value = '';
            if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
            if(selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = '';

            // Reset delivery selection UI
            if(deliveryVehicleNumberInput) deliveryVehicleNumberInput.value = '';
            if(driverNameInput) driverNameInput.value = '';
            clearDeliverySelection();

            await fetchDeliveryLogs(); // Re-fetch delivery logs to get updated stock

            toggleCustomerNameInputState();
            handlePaymentMethodChange(); // Resets installment fields
            calculateTotals(); // Recalculates and resets summary fields
            displayInstallmentDueMessage(0); // Hide installment message

        } catch (error) {
            console.error("Error during sale processing:", error);
            alert(`Sale not recorded. Error: ${error.message}. Please check stock and try again.`);
            // Important: Re-fetch delivery logs to ensure UI reflects actual current stock after failed attempt
            await fetchDeliveryLogs();
            if (selectedDeliveryVehicleContext) { // If a vehicle was selected, refresh its view
                confirmDeliveryVehicleSelection(selectedDeliveryVehicleContext.vehicleNumber, selectedDeliveryVehicleContext.driverName);
            }
        }
    }

    // --- Sales History (Updated Rendering) ---
    function renderSaleLogRow(saleKey, data) {
        const row = salesLogTableBody.insertRow(); row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        // Removed Sale ID column from display

        const customerNameCell = row.insertCell(); // New: Customer Name only
        let customerNameDisplayText = data.customerName || 'N/A';
        if (data.customerId) {
            const customerLink = document.createElement('a');
            customerLink.href = `customer.html#${data.customerId}`;
            customerLink.textContent = customerNameDisplayText;
            customerLink.classList.add('table-link');
            customerNameCell.appendChild(customerLink);
        } else {
            customerNameCell.textContent = customerNameDisplayText;
        }

        const customerCityCell = row.insertCell(); // New: Customer City
        customerCityCell.textContent = data.customerCity || 'N/A';

        const itemsCell = row.insertCell(); // "Items (Qty @ Price/Unit)"
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display');
            data.items.forEach(item => {
                const li = document.createElement('li');
                // Updated display for item price
                li.textContent = `${item.itemName || 'Item'} (Qty: ${item.quantity || 0} @ Rs. ${parseFloat(item.unitPrice || 0).toFixed(2)}/unit)`;
                ul.appendChild(li);
            });
            itemsCell.appendChild(ul);
        } else itemsCell.textContent = 'N/A';

        // Source Vehicle Cell
        const vehicleCell = row.insertCell();
        vehicleCell.textContent = `${data.sourceVehicleNumber || 'N/A'} (${data.sourceDriverName || 'N/A'})`;

        const totalCell = row.insertCell(); totalCell.textContent = data.grandTotal ? parseFloat(data.grandTotal).toFixed(2) : '0.00'; totalCell.classList.add('text-right');

        const paymentCell = row.insertCell();
        // Payment method display (same as before)
        let paymentMethodText = data.paymentMethod || 'N/A';
        if (data.paymentMethod === 'Installment') {
            paymentMethodText += ` (Paid: ${parseFloat(data.amountPaid || 0).toFixed(2)}, To be paid: ${parseFloat(data.remainingBalance || 0).toFixed(2)})`;
        }
        paymentCell.textContent = paymentMethodText;

        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        // Action buttons (same as before)
        const invoiceBtn = document.createElement('button'); invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i>'; invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm'); invoiceBtn.title="View/Print Invoice"; invoiceBtn.onclick = () => generateAndShowInvoice(data);
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');  deleteBtn.title="Delete Sale"; deleteBtn.onclick = () => deleteSale(saleKey, data);
        actionsCell.appendChild(invoiceBtn); actionsCell.appendChild(deleteBtn);
    }

    function displayFilteredSales() { // Updated to include vehicle/driver search
        if (!salesLogTableBody) return;
        salesLogTableBody.innerHTML = '';
        const searchTerm = searchSalesInput ? searchSalesInput.value.toLowerCase().trim() : "";
        let salesDisplayed = 0;

        if (allSalesData && typeof allSalesData === 'object' && Object.keys(allSalesData).length > 0) {
            const salesArray = Object.keys(allSalesData)
                .map(key => ({ id: key, ...allSalesData[key] }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            salesArray.forEach(sale => {
                const customerNameMatches = sale.customerName && sale.customerName.toLowerCase().includes(searchTerm);
                const saleIdMatches = sale.saleId && sale.saleId.toLowerCase().includes(searchTerm);
                const cityMatches = sale.customerCity && sale.customerCity.toLowerCase().includes(searchTerm);
                const vehicleMatches = sale.sourceVehicleNumber && sale.sourceVehicleNumber.toLowerCase().includes(searchTerm);
                const driverMatches = sale.sourceDriverName && sale.sourceDriverName.toLowerCase().includes(searchTerm);

                if (!searchTerm || customerNameMatches || saleIdMatches || cityMatches || vehicleMatches || driverMatches) {
                    renderSaleLogRow(sale.id, sale); salesDisplayed++;
                }
            });
        }
         if (noSalesHistoryText) { // Same as before
            noSalesHistoryText.style.display = salesDisplayed === 0 ? 'block' : 'none';
            if (salesDisplayed === 0) {
                noSalesHistoryText.textContent = searchTerm ? 'No sales match your search.' : 'No sales recorded yet.';
            }
        }
    }

    // --- PDF Invoice (Updated Table Columns) ---
    async function generateAndShowInvoice(saleData) {
        const doc = new jsPDF();
        // Company Info (same)
        const companyName = "Amee-Tea Pvt Ltd"; const companyAddress = "123 Tea Lane, Panadura, Western Province, Sri Lanka"; const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        let currentY = 15;
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, currentY);
        currentY += 6; doc.setFontSize(10); doc.setFont(undefined, 'normal');
        doc.text(companyAddress, 14, currentY);
        currentY += 5; doc.text(companyContact, 14, currentY);

        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 196, 18, { align: 'right' });
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        doc.text(`Invoice ID: ${saleData.saleId ? saleData.saleId.slice(-10).toUpperCase() : 'N/A'}`, 196, 26, { align: 'right' });
        doc.text(`Date: ${saleData.saleDate}`, 196, 31, { align: 'right' });
        currentY += 10;

        doc.setLineWidth(0.2); doc.line(14, currentY, 196, currentY); currentY += 5;
        doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text("Bill To:", 14, currentY);
        doc.setFont(undefined, 'normal'); doc.setFontSize(10); currentY += 5;
        let customerLine1 = saleData.customerName;
        if (saleData.customerId) customerLine1 += ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})`;
        doc.text(customerLine1, 14, currentY);
        if (saleData.customerCity) { currentY += 5; doc.text(`City: ${saleData.customerCity}`, 14, currentY); }
        currentY += 5;

        // Fetch the *current* total due for the customer for the invoice
        let customerTotalDue = 0;
        if (saleData.customerId) {
            const snapshot = await db.ref(SALES_LOG_PATH)
                                     .orderByChild('customerId')
                                     .equalTo(saleData.customerId)
                                     .once('value');
            if (snapshot.exists()) {
                snapshot.forEach(saleSnapshot => {
                    const sale = saleSnapshot.val();
                    if (sale.paymentMethod === 'Installment' && sale.remainingBalance > 0) {
                        customerTotalDue += (sale.remainingBalance || 0);
                    }
                });
            }
        }

        if (customerTotalDue > 0) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 0, 0); // Red color for due amount
            doc.text(`CUSTOMER OWES: Rs. ${customerTotalDue.toFixed(2)} (from previous installments)`, 14, currentY);
            doc.setTextColor(0, 0, 0); // Reset color to black
            doc.setFont(undefined, 'normal');
            currentY += 5;
        }

        // Source vehicle
        if (saleData.sourceVehicleNumber) {
             doc.text(`Source Vehicle: ${saleData.sourceVehicleNumber || ''} (Driver: ${saleData.sourceDriverName || ''})`, 14, currentY);
             currentY += 8;
        } else {
            currentY +=3; // smaller gap if no vehicle info
        }

        // Updated Table Columns for Invoice
        const tableColumn = ["#", "Item Description", "Qty", "Price/Unit (Rs.)", "Line Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => {
            tableRows.push([
                itemNumber++,
                `${item.itemName || 'N/A'} (${item.productCode || 'N/A'})`,
                item.quantity,
                parseFloat(item.unitPrice || 0).toFixed(2), // This is the sold price per unit
                parseFloat(item.lineTotal || 0).toFixed(2)
            ]);
        });
        doc.autoTable({
            head: [tableColumn], body: tableRows, startY: currentY,
            theme: 'striped', headStyles: { fillColor: [22, 160, 133], textColor: 255 },
            columnStyles: { // Adjusted column styles
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15, halign: 'right' },
                3: { cellWidth: 30, halign: 'right' }, // Price/Unit
                4: { cellWidth: 35, halign: 'right' }  // Line Total
            }
        });

        // Summary (same as before)
        let finalY = doc.lastAutoTable.finalY || currentY + 20;
        finalY += 7; doc.setFontSize(10);
        doc.text(`Subtotal:`, 150, finalY, {align: 'right'}); doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        if (saleData.overallDiscountValue > 0) {
            finalY += 5; doc.text(`Overall Discount:`, 150, finalY, {align: 'right'});
            doc.text(`- Rs. ${parseFloat(saleData.overallDiscountValue || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 150, finalY, {align: 'right'}); doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);

        // Payment Method & Notes (same as before)
        finalY += 10; doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if (saleData.paymentMethod === 'Installment') {
            finalY += 5; doc.text(`Amount Paid: Rs. ${parseFloat(saleData.amountPaid || 0).toFixed(2)}`, 14, finalY);
            finalY += 5; doc.text(`Remaining Balance: Rs. ${parseFloat(saleData.remainingBalance || 0).toFixed(2)}`, 14, finalY);
        }
        if(saleData.saleNotes){
            finalY += 7; doc.setFont(undefined, 'bold'); doc.text("Notes:", 14, finalY); doc.setFont(undefined, 'normal');
            const notesLines = doc.splitTextToSize(saleData.saleNotes, 180);
            doc.text(notesLines, 14, finalY + 4);
            finalY += (notesLines.length * 4) + 4;
        }

        // Footer (same)
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const footerY = pageHeight - 15;
        doc.setLineWidth(0.2); doc.line(14, footerY - 2, 196, footerY - 2);
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, footerY);
        doc.text("Generated: " + new Date().toLocaleString(), 196, footerY, {align: 'right'});

        doc.save(`Invoice-${(saleData.saleId || 'SALE').slice(-6)}-${(saleData.customerName || 'Customer').replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    // --- Functions to be reused (customer, city, product fetching, normalizeName, etc.) ---
    // These would be similar to your existing sales.js, adapted where needed
    // e.g., fetchCitiesAndPopulateDropdown, fetchDefinedProductsOnce, listenForProductUpdates,
    // fetchCustomersForSuggestions, handleCityChange, handleNewCityInput, toggleCustomerNameInputState,
    // handlePaymentMethodChange, calculateRemainingBalance, calculateRemainingBalanceAndUpdateTotals,
    // normalizeName, deleteSale (warning about stock revert would be even more critical here for delivery logs)

    // Simplified placeholder for fetchDefinedProductsOnce (used for price lookup)
    async function fetchDefinedProductsOnce() {
        try {
            const snapshot = await db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName').once('value');
            definedProductsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    definedProductsCache.push({ id: child.key, ...child.val() });
                });
            }
        } catch (error) { console.error("Error fetching defined products:", error); }
    }
    // Placeholder for listenForProductUpdates (mainly for definedProductsCache if prices change)
    function listenForProductUpdates() {
        db.ref(DEFINED_PRODUCTS_PATH).on('value', snapshot => {
            definedProductsCache = [];
            if(snapshot.exists()){
                snapshot.forEach(child => definedProductsCache.push({id: child.key, ...child.val()}));
            }
            // If a sale is in progress, and a product price changes, this won't auto-update rows.
            // This listener is more for keeping the base product data (like sellingPrice for new rows) fresh.
        });
    }

    async function fetchCitiesAndPopulateDropdown() { // (Same as before)
        try {
            const snapshot = await db.ref(CITIES_PATH).orderByChild('name').once('value');
            citiesCache = [];
            let cityOptionsHTML = '<option value="">-- Select route First --</option>';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const cityData = child.val();
                    if (cityData && cityData.name) {
                        citiesCache.push({ id: child.key, name: cityData.name });
                        cityOptionsHTML += `<option value="${cityData.name}">${cityData.name}</option>`;
                    }
                });
            }
            if (customerCitySelect) customerCitySelect.innerHTML = cityOptionsHTML;
        } catch (error) {
            console.error("Error fetching cities:", error);
            if (customerCitySelect) customerCitySelect.innerHTML = '<option value="">-- Error Loading --</option>';
        }
    }

    async function fetchCustomersForSuggestions() { // (Same as before)
        try {
            const snapshot = await db.ref(CUSTOMERS_PATH).orderByChild('name').once('value');
            customersCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    customersCache.push({
                        id: child.key,
                        name: child.val().name,
                        normalizedName: child.val().normalizedName,
                        city: child.val().city || ""
                    });
                });
            }
        } catch (error) { console.error("Error fetching customers:", error); }
    }

    function normalizeName(name) { // (Same as before)
        if (typeof name !== 'string') return "";
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_');
    }

    function handleCityChange() { // (Same as before)
        if (customerCitySelect && customerCitySelect.value) {
            if (newCityNameInput) newCityNameInput.value = '';
            if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customerCitySelect.value;
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
        displayInstallmentDueMessage(0); // Clear message when city changes
    }

    function handleNewCityInput() { // (Same as before)
        if (newCityNameInput && newCityNameInput.value.trim()) {
            if (customerCitySelect) customerCitySelect.value = '';
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
        displayInstallmentDueMessage(0); // Clear message when new city entered
    }

    function clearCustomerInput(){ // (Same as before)
        if(customerNameInput) customerNameInput.value = '';
        if(customerSuggestionsListEl) customerSuggestionsListEl.innerHTML = '';
        if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        displayInstallmentDueMessage(0); // Clear message when customer input is cleared
    }

    function toggleCustomerNameInputState() { // (Same as before)
        const citySelected = customerCitySelect && customerCitySelect.value;
        const newCityEntered = newCityNameInput && newCityNameInput.value.trim();
        if (customerNameInput) {
            const isDisabled = !(citySelected || newCityEntered);
            customerNameInput.disabled = isDisabled;
            customerNameInput.placeholder = isDisabled ? "Select/Enter route first..." : "Type customer name...";
            if (isDisabled) clearCustomerInput();
        }
    }
      if (customerNameInput && customerSuggestionsListEl && selectedCustomerIdInput) { // (Same as before - customer suggestions)
        customerNameInput.addEventListener('input', () => {
            const searchTerm = customerNameInput.value.toLowerCase();
            customerSuggestionsListEl.innerHTML = '';
            selectedCustomerIdInput.value = '';
            displayInstallmentDueMessage(0); // Clear message on input change

            const currentCityValue = (customerCitySelect ? customerCitySelect.value : '') || (newCityNameInput ? newCityNameInput.value.trim() : '');
            const selectedCityNormalized = currentCityValue.toLowerCase();

            if (!selectedCityNormalized && searchTerm.length > 0) {
                customerSuggestionsListEl.innerHTML = '<li>Select or enter a city first.</li>';
                customerSuggestionsListEl.style.display = 'block';
                return;
            }
            if (searchTerm.length < 1) { customerSuggestionsListEl.style.display = 'none'; return; }

            const filteredCustomers = customersCache.filter(customer => {
                const customerCityLower = (customer.city || '').toLowerCase();
                const cityMatch = customerCityLower === selectedCityNormalized;
                const nameMatch = customer.name && customer.name.toLowerCase().includes(searchTerm);
                return cityMatch && nameMatch;
            }).slice(0, 5);

            if (filteredCustomers.length > 0) {
                const ul = document.createElement('ul');
                filteredCustomers.forEach(customer => {
                    const li = document.createElement('li'); li.textContent = `${customer.name} (${customer.city || 'N/A'})`;
                    li.addEventListener('click', () => {
                        customerNameInput.value = customer.name;
                        selectedCustomerIdInput.value = customer.id;
                        if(selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customer.city;

                        if (customerCitySelect && customer.city && citiesCache.some(c => c.name === customer.city)) {
                            customerCitySelect.value = customer.city;
                            if (newCityNameInput) newCityNameInput.value = '';
                        } else if (newCityNameInput && customer.city) {
                            newCityNameInput.value = customer.city;
                            if (customerCitySelect) customerCitySelect.value = '';
                        }
                        customerSuggestionsListEl.style.display = 'none'; customerSuggestionsListEl.innerHTML = '';
                        checkCustomerInstallmentStatus(); // Check status after selecting customer
                    });
                    ul.appendChild(li);
                });
                customerSuggestionsListEl.appendChild(ul); customerSuggestionsListEl.style.display = 'block';
            } else {
                customerSuggestionsListEl.innerHTML = `<li>No customers matching "${customerNameInput.value}" in ${currentCityValue || 'this city'}. Type full name to add.</li>`;
                customerSuggestionsListEl.style.display = 'block';
            }
        });
    }


    // Check for uncompleted installment payments for the selected customer
    async function checkCustomerInstallmentStatus() {
        const customerId = selectedCustomerIdInput.value;
        if (!customerId) {
            displayInstallmentDueMessage(0);
            return;
        }

        try {
            const snapshot = await db.ref(SALES_LOG_PATH)
                                     .orderByChild('customerId')
                                     .equalTo(customerId)
                                     .once('value');
            let totalDue = 0;
            if (snapshot.exists()) {
                snapshot.forEach(saleSnapshot => {
                    const sale = saleSnapshot.val();
                    if (sale.paymentMethod === 'Installment' && sale.remainingBalance > 0) {
                        totalDue += (sale.remainingBalance || 0);
                    }
                });
            }
            displayInstallmentDueMessage(totalDue);
        } catch (error) {
            console.error("Error checking customer installment status:", error);
            displayInstallmentDueMessage(0); // Hide on error
        }
    }

    // Display the installment due message
    function displayInstallmentDueMessage(amount) {
        if (installmentDueMessage) {
            if (amount > 0) {
                installmentDueMessage.textContent = `CUSTOMER OWES: Rs. ${amount.toFixed(2)} (from previous installments)`;
                installmentDueMessage.style.display = 'block';
            } else {
                installmentDueMessage.style.display = 'none';
                installmentDueMessage.textContent = '';
            }
        }
    }


    function handlePaymentMethodChange() { // (Same as before)
        if (!paymentMethodInput || !installmentFieldsContainer) return;
        if (paymentMethodInput.value === 'Installment') {
            installmentFieldsContainer.style.display = 'grid';
            calculateRemainingBalance();
        } else {
            installmentFieldsContainer.style.display = 'none';
            if(amountPaidInput) amountPaidInput.value = '0';
            if(remainingBalanceInput) remainingBalanceInput.value = '0.00';
        }
    }

    function calculateRemainingBalanceAndUpdateTotals() { // (Same as before)
        calculateTotals();
    }

    function calculateRemainingBalance() { // (Same as before)
        if (!grandTotalInput || !amountPaidInput || !remainingBalanceInput) return;
        const grandTotal = parseFloat(grandTotalInput.value) || 0;
        const paidAmount = parseFloat(amountPaidInput.value) || 0;
        const balance = grandTotal - paidAmount;
        remainingBalanceInput.value = balance.toFixed(2);
    }

    function loadSalesLog() { // (Same as before)
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(100);
        logRef.on('value', snapshot => {
            allSalesData = snapshot.exists() ? snapshot.val() : {};
            displayFilteredSales(); // Will re-render with the new column format
        }, error => {
            console.error("Error listening to sales log:", error);
            allSalesData = {}; displayFilteredSales();
        });
    }

    async function deleteSale(saleId, saleData) { // (Same warning logic as before, but stock revert is now more complex as it involves deliveryLogs)
        if (!saleId) return;
        const confirmationMessage = `DELETE Sale ID: ${saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : saleId.slice(-6).toUpperCase()} for "${saleData.customerName}"?\n
        !!! CRITICAL WARNING !!!
        This action is IRREVERSIBLE and WILL NOT automatically revert stock levels in the delivery vehicle logs OR the main product's 'Total Sold' count.
        If this sale is deleted, you must MANUALLY ADJUST:
        1. The 'stockInVehicle' AND 'quantitySold' for each product in its original delivery log(s).
        2. The 'totalSold' for each product in the main product definitions.

        Are you absolutely sure you want to proceed with deleting this sale log? This can lead to data inconsistency if manual adjustments are not made correctly.`;

        if (confirm(confirmationMessage)) {
            try {
                // If a sale is deleted, you need to revert the 'stockInVehicle' and 'quantitySold'
                // in the corresponding delivery logs. This involves iterating through `saleData.items`
                // and for each item, its `sourceLogDebits` (which aren't stored in the saleData directly,
                // but would have been used during creation).
                // For simplicity here, we're adding a placeholder of where you'd add this logic,
                // as `saleData` only contains simplified item info. You might need to store
                // `sourceLogDebits` within the `salesLog` entry itself if you want to
                // automate this reversal.

                // Manual Reversal Logic Placeholder:
                console.warn("Manual reversal of delivery log stockInVehicle and quantitySold, and main product totalSold is REQUIRED for this deleted sale.");
                saleData.items.forEach(item => {
                    // You would need to query deliveryLogs for the specific item sold
                    // from this sale's vehicle/driver and then increment stockInVehicle
                    // and decrement quantitySold for the quantity sold.
                    // This is complex because `saleData` doesn't directly contain the `deliveryLogId`
                    // from which the stock was deducted.
                    // A robust solution would be to store the `sourceLogDebits` array within the `sale.items`
                    // for each item when the sale is made.
                });

                await db.ref(`${SALES_LOG_PATH}/${saleId}`).remove();
                alert("Sale log entry deleted. REMEMBER TO MANUALLY ADJUST DELIVERY VEHICLE STOCK, QUANTITY SOLD, AND MAIN PRODUCT TOTALS SOLD.");
            } catch (error) { console.error(`Error deleting sale ${saleId}:`, error); alert("Error deleting sale log entry."); }
        }
    }


    // --- Initialize Page ---
    initializeSalesPage();
});