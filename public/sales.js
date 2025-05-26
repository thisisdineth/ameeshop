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
    const { jsPDF } = window.jspdf;

    // --- Navbar ---
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
    const saleForm = document.getElementById('saleForm');
    const saleDateInput = document.getElementById('saleDate');

    const customerCitySelect = document.getElementById('customerCitySelect');
    const newCityNameInput = document.getElementById('newCityNameInput');
    const customerNameInput = document.getElementById('customerName');
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const selectedCustomerCityNameInput = document.getElementById('selectedCustomerCityName'); // To store city of selected/typed customer

    const saleItemsContainer = document.getElementById('saleItemsContainer');
    const addSaleItemButton = document.getElementById('addSaleItemButton');
    const subTotalInput = document.getElementById('subTotal');
    const overallDiscountValueInput = document.getElementById('overallDiscountValueInput'); // Changed from Percent
    const grandTotalInput = document.getElementById('grandTotal');

    const paymentMethodInput = document.getElementById('paymentMethod');
    const installmentFieldsContainer = document.getElementById('installmentFieldsContainer');
    const amountPaidInput = document.getElementById('amountPaid');
    const remainingBalanceInput = document.getElementById('remainingBalance');

    const saleNotesInput = document.getElementById('saleNotes');
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');

    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts';
    const CITIES_PATH = 'cities'; // New path for cities

    let definedProductsCache = [];
    let customersCache = []; // Will store customers with their city
    let citiesCache = []; // { id: cityKey, name: "cityName" }
    let allSalesData = {};

    async function initializeSalesPage() {
        console.log("Initializing Sales Page...");
        if (saleDateInput) saleDateInput.valueAsDate = new Date();
        
        await fetchCitiesAndPopulateDropdown();
        await fetchDefinedProductsForSelect(true);
        await fetchCustomersForSuggestions();

        if (saleItemsContainer && saleItemsContainer.children.length === 0) {
            addSaleItemRow();
        }
        loadSalesLog();
        toggleCustomerNameInputState(); // Disable customer name input initially
        handlePaymentMethodChange(); // Set initial state for payment fields

        // Event listeners for city inputs
        if (customerCitySelect) {
            customerCitySelect.addEventListener('change', () => {
                if (customerCitySelect.value) {
                    if (newCityNameInput) newCityNameInput.value = '';
                    if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customerCitySelect.value;
                }
                clearCustomerInput();
                toggleCustomerNameInputState();
            });
        }
        if (newCityNameInput) {
            newCityNameInput.addEventListener('input', () => {
                if (newCityNameInput.value.trim()) {
                    if (customerCitySelect) customerCitySelect.value = '';
                    if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = ''; // Clear if typing new
                }
                clearCustomerInput(); // Clear customer when city potentially changes
                toggleCustomerNameInputState();
            });
        }
        if (paymentMethodInput) paymentMethodInput.addEventListener('change', handlePaymentMethodChange);
        if (amountPaidInput) amountPaidInput.addEventListener('input', calculateRemainingBalanceAndUpdateTotals);
    }
    
    function clearCustomerInput(){
        if(customerNameInput) customerNameInput.value = '';
        if(customerSuggestionsListEl) customerSuggestionsListEl.innerHTML = '';
        if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
    }


    function toggleCustomerNameInputState() {
        const citySelected = customerCitySelect && customerCitySelect.value;
        const newCityEntered = newCityNameInput && newCityNameInput.value.trim();
        if (customerNameInput) {
            const isDisabled = !(citySelected || newCityEntered);
            customerNameInput.disabled = isDisabled;
            customerNameInput.placeholder = isDisabled ? "Select/Enter City first..." : "Type customer name...";
            if (isDisabled) {
                clearCustomerInput();
            }
        }
    }
    
    async function fetchCitiesAndPopulateDropdown() {
        try {
            const snapshot = await db.ref(CITIES_PATH).orderByChild('name').once('value');
            citiesCache = [];
            let cityOptionsHTML = '<option value="">-- Select City First --</option>';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const cityData = child.val();
                    if (cityData && cityData.name) { // Ensure cityData and name exist
                        citiesCache.push({ id: child.key, name: cityData.name });
                        cityOptionsHTML += `<option value="${cityData.name}">${cityData.name}</option>`;
                    }
                });
            }
            if (customerCitySelect) customerCitySelect.innerHTML = cityOptionsHTML;
            console.log("Fetched cities:", citiesCache);
        } catch (error) {
            console.error("Error fetching cities:", error);
            citiesCache = []; // Ensure cache is empty on error
             if (customerCitySelect) customerCitySelect.innerHTML = '<option value="">-- Error Loading Cities --</option>';
        }
    }


    async function fetchDefinedProductsForSelect(forceRefresh = false) {
        if (!forceRefresh && definedProductsCache.length > 0) {
            updateAllProductDropdowns(); return;
        }
        console.log("Fetching defined products from Firebase for sales page...");
        try {
            const snapshot = await db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName').once('value');
            definedProductsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const productData = child.val();
                    if (productData.productCode && productData.itemName) {
                        definedProductsCache.push({ id: child.key, ...productData });
                    } else { console.warn("Skipping product in sales dropdown due to missing code or name:", child.key, productData); }
                });
            }
            console.log("Fetched products for sale dropdown:", definedProductsCache.length, "items.");
            updateAllProductDropdowns();
        } catch (error) { console.error("Error fetching defined products for sales:", error); definedProductsCache = []; }
    }
    
    function updateAllProductDropdowns() {
        document.querySelectorAll('.sale-item-product').forEach(selectElement => {
            const currentValue = selectElement.value;
            populateProductSelect(selectElement);
            if (definedProductsCache.some(p => p.productCode === currentValue)) {
                selectElement.value = currentValue;
            } else { selectElement.selectedIndex = 0; }
            if (selectElement.value && selectElement.selectedIndex > 0) {
                const event = new Event('change', { bubbles: true });
                selectElement.dispatchEvent(event);
            } else {
                 const itemRow = selectElement.closest('.sale-item-row');
                 if(itemRow) {
                    const priceInput = itemRow.querySelector('.sale-item-price');
                    if(priceInput) priceInput.value = '';
                 }
                 calculateTotals();
            }
        });
    }

    function populateProductSelect(selectElement) {
        if (!selectElement) { console.error("populateProductSelect: selectElement is null"); return; }
        let optionsHTML = '<option value="" disabled selected>-- Select Product --</option>';
        if (Array.isArray(definedProductsCache) && definedProductsCache.length > 0) {
            definedProductsCache.forEach(p => {
                if (p && p.productCode && p.itemName) { 
                    optionsHTML += `<option value="${p.productCode}" data-price="${p.sellingPrice || 0}" data-name="${p.itemName}" data-stock="${p.currentStock || 0}">${p.itemName} (${p.productCode}) - Stock: ${p.currentStock || 0}</option>`;
                }
            });
        }
        selectElement.innerHTML = optionsHTML;
    }

    async function fetchCustomersForSuggestions() {
        try {
            const snapshot = await db.ref(CUSTOMERS_PATH).orderByChild('name').once('value');
            customersCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    customersCache.push({ 
                        id: child.key, 
                        name: child.val().name,
                        normalizedName: child.val().normalizedName,
                        city: child.val().city || "" // Store city
                    });
                });
            }
            // console.log("Fetched customers for suggestions:", customersCache);
        } catch (error) { console.error("Error fetching customers:", error); }
    }

    if (customerNameInput) {
        customerNameInput.addEventListener('input', () => {
            const searchTerm = customerNameInput.value.toLowerCase();
            customerSuggestionsListEl.innerHTML = '';
            selectedCustomerIdInput.value = ''; 
            
            const currentCityValue = customerCitySelect.value || newCityNameInput.value.trim();
            const selectedCityNormalized = currentCityValue.toLowerCase();

            if (!selectedCityNormalized) { // Should not happen if input is enabled correctly
                customerSuggestionsListEl.innerHTML = '<li>Error: City not identified.</li>';
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
                        if(selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customer.city; // Set this hidden input too
                        // Ensure the main city dropdowns/inputs reflect this customer's city
                        if (customerCitySelect && customer.city && citiesCache.some(c => c.name === customer.city)) {
                            customerCitySelect.value = customer.city;
                            if (newCityNameInput) newCityNameInput.value = '';
                        } else if (newCityNameInput && customer.city) { // If city not in dropdown (e.g. manually added)
                            newCityNameInput.value = customer.city;
                            if (customerCitySelect) customerCitySelect.value = '';
                        }
                        customerSuggestionsListEl.style.display = 'none'; customerSuggestionsListEl.innerHTML = '';
                    });
                    ul.appendChild(li);
                });
                customerSuggestionsListEl.appendChild(ul); customerSuggestionsListEl.style.display = 'block';
            } else { 
                customerSuggestionsListEl.innerHTML = '<li>No matching customers in this city. Type full name to add.</li>';
                customerSuggestionsListEl.style.display = 'block';
            }
        });
        document.addEventListener('click', (event) => { // Hide suggestions when clicking outside
            if (customerSuggestionsListEl && customerNameInput && !customerNameInput.contains(event.target) && !customerSuggestionsListEl.contains(event.target)) {
                customerSuggestionsListEl.style.display = 'none';
            }
        });
    }
    
    function normalizeName(name) {
        if (typeof name !== 'string') { return ""; }
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_');
    }

    function addSaleItemRow() {
        const itemRowDiv = document.createElement('div'); itemRowDiv.classList.add('sale-item-row', 'form-grid');
        const productSelectDiv = document.createElement('div'); productSelectDiv.classList.add('form-group');
        productSelectDiv.innerHTML = '<label class="form-label form-label-sm">Product</label>';
        const productSelect = document.createElement('select'); productSelect.classList.add('form-input', 'sale-item-product'); productSelect.required = true;
        populateProductSelect(productSelect); 
        productSelectDiv.appendChild(productSelect);

        const qtyDiv = document.createElement('div'); qtyDiv.classList.add('form-group');
        qtyDiv.innerHTML = '<label class="form-label form-label-sm">Qty</label>';
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.min = "1"; qtyInput.classList.add('form-input', 'sale-item-qty'); qtyInput.placeholder = 'Qty'; qtyInput.required = true; qtyInput.value = "1";
        qtyDiv.appendChild(qtyInput);

        const priceDiv = document.createElement('div'); priceDiv.classList.add('form-group');
        priceDiv.innerHTML = '<label class="form-label form-label-sm">Price</label>';
        const priceInput = document.createElement('input'); priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.classList.add('form-input', 'sale-item-price'); priceInput.placeholder = 'Price'; priceInput.required = true;
        priceDiv.appendChild(priceInput);

        const itemDiscountDiv = document.createElement('div'); itemDiscountDiv.classList.add('form-group', 'item-discount-group');
        itemDiscountDiv.innerHTML = '<label class="form-label form-label-sm">Item Disc. (%)</label>';
        const itemDiscountInput = document.createElement('input'); itemDiscountInput.type = 'number'; itemDiscountInput.step = '0.01'; itemDiscountInput.min="0"; itemDiscountInput.max="100"; itemDiscountInput.classList.add('form-input', 'sale-item-discount-percent'); itemDiscountInput.placeholder = '%'; itemDiscountInput.value = "0";
        itemDiscountDiv.appendChild(itemDiscountInput);
        
        const lineTotalDiv = document.createElement('div'); lineTotalDiv.classList.add('form-group', 'line-total-group');
        lineTotalDiv.innerHTML = '<label class="form-label form-label-sm">Line Total</label>';
        const lineTotalInput = document.createElement('input'); lineTotalInput.type = 'text'; lineTotalInput.classList.add('form-input', 'sale-item-linetotal'); lineTotalInput.placeholder = 'Total'; lineTotalInput.readOnly = true;
        lineTotalDiv.appendChild(lineTotalInput);

        const removeBtnDiv = document.createElement('div'); removeBtnDiv.classList.add('form-group'); // Make it a form-group for alignment
        removeBtnDiv.style.paddingTop = '1.5em'; // Align button with inputs that have labels
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm'); removeBtn.title="Remove Item";
        removeBtn.onclick = () => { itemRowDiv.remove(); calculateTotals(); }; 
        removeBtnDiv.appendChild(removeBtn);

        itemRowDiv.appendChild(productSelectDiv); itemRowDiv.appendChild(qtyDiv); itemRowDiv.appendChild(priceDiv); itemRowDiv.appendChild(itemDiscountDiv); itemRowDiv.appendChild(lineTotalDiv); itemRowDiv.appendChild(removeBtnDiv);
        if (saleItemsContainer) saleItemsContainer.appendChild(itemRowDiv);

        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if(priceInput) priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStock = parseInt(selectedOption.dataset.stock || 0);
            if(qtyInput) {
                qtyInput.max = maxStock;
                if (!qtyInput.value || parseInt(qtyInput.value) === 0 || parseInt(qtyInput.value) > maxStock ) qtyInput.value = maxStock > 0 ? 1 : 0;
                if(maxStock === 0) qtyInput.value = 0; // Cannot sell if no stock
            }
            calculateTotals();
        });
        if (productSelect.value) {
            const event = new Event('change', { bubbles: true });
            productSelect.dispatchEvent(event);
        }
        if(qtyInput) qtyInput.addEventListener('input', calculateTotals); 
        if(priceInput) priceInput.addEventListener('input', calculateTotals); 
        if(itemDiscountInput) itemDiscountInput.addEventListener('input', calculateTotals);
    }

    if (addSaleItemButton) {
        addSaleItemButton.addEventListener('click', async () => {
            await fetchDefinedProductsForSelect(true); // Refresh products before adding new row
            addSaleItemRow();
        });
    }
    if (overallDiscountValueInput) overallDiscountValueInput.addEventListener('input', calculateTotals);


    function calculateTotals() {
        let currentSubTotal = 0;
        document.querySelectorAll('.sale-item-row').forEach(row => {
            const qty = parseInt(row.querySelector('.sale-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.sale-item-price').value) || 0;
            const discountPercent = parseFloat(row.querySelector('.sale-item-discount-percent').value) || 0;
            const lineTotalField = row.querySelector('.sale-item-linetotal');
            if (qty > 0 && price >= 0) {
                const itemGrossTotal = qty * price;
                const itemDiscountAmount = itemGrossTotal * (discountPercent / 100);
                const itemNetTotal = itemGrossTotal - itemDiscountAmount;
                if(lineTotalField) lineTotalField.value = itemNetTotal.toFixed(2); 
                currentSubTotal += itemNetTotal;
            } else { if(lineTotalField) lineTotalField.value = "0.00"; }
        });
        if(subTotalInput) subTotalInput.value = currentSubTotal.toFixed(2);
        
        const directDiscountAmount = parseFloat(overallDiscountValueInput.value) || 0; // Use direct discount amount
        const calculatedGrandTotal = currentSubTotal - directDiscountAmount;
        if(grandTotalInput) grandTotalInput.value = calculatedGrandTotal > 0 ? calculatedGrandTotal.toFixed(2) : "0.00";

        if (paymentMethodInput && paymentMethodInput.value === 'Installment') {
            calculateRemainingBalance();
        }
    }

    function handlePaymentMethodChange() {
        if (!paymentMethodInput || !installmentFieldsContainer) return;
        if (paymentMethodInput.value === 'Installment') {
            installmentFieldsContainer.style.display = 'grid'; // Or 'flex', 'block'
            calculateRemainingBalance(); 
        } else {
            installmentFieldsContainer.style.display = 'none';
            if(amountPaidInput) amountPaidInput.value = '0';
            if(remainingBalanceInput) remainingBalanceInput.value = '0.00';
        }
    }
    
    function calculateRemainingBalanceAndUpdateTotals() {
        calculateTotals(); // Recalculate totals first as grand total might affect this
        // calculateRemainingBalance function itself is called within calculateTotals if installment
    }


    function calculateRemainingBalance() {
        if (!grandTotalInput || !amountPaidInput || !remainingBalanceInput) return;
        const grandTotal = parseFloat(grandTotalInput.value) || 0;
        const paidAmount = parseFloat(amountPaidInput.value) || 0;
        
        // Basic validation for paid amount (can be enhanced)
        // if (paidAmount > grandTotal && grandTotal > 0) {
        //     amountPaidInput.value = grandTotal.toFixed(2); // Optionally cap at grand total
        // }
        
        const balance = grandTotal - paidAmount;
        remainingBalanceInput.value = balance.toFixed(2);
    }


    if (saleForm) {
        saleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saleDate = saleDateInput.value;
            let customerNameOriginal = customerNameInput.value.trim();
            let customerId = selectedCustomerIdInput.value;
            let customerNameToSave = customerNameOriginal;

            let finalCustomerCity = "";
            if (customerCitySelect && customerCitySelect.value) {
                finalCustomerCity = customerCitySelect.value;
            } else if (newCityNameInput && newCityNameInput.value.trim()) {
                finalCustomerCity = newCityNameInput.value.trim();
            }

            if (!saleDate || !customerNameOriginal || !finalCustomerCity) {
                alert("Please fill Sale Date, Customer City (select or add new), and Customer Name.");
                return;
            }
            finalCustomerCity = finalCustomerCity.trim(); // Ensure it's trimmed
            let cityNormalizedForCheck = normalizeName(finalCustomerCity);

            // Save new city if entered and doesn't exist in cache by normalized name
            if (!citiesCache.some(city => normalizeName(city.name) === cityNormalizedForCheck)) {
                try {
                    const newCityRef = db.ref(CITIES_PATH).push();
                    await newCityRef.set({ name: finalCustomerCity });
                    console.log("New city saved:", finalCustomerCity);
                    await fetchCitiesAndPopulateDropdown(); // Refresh city dropdown and cache
                    // The customer will be associated with this new city
                } catch (cityError) {
                    console.error("Error saving new city:", cityError);
                    alert("Could not save new city. Sale not recorded."); return;
                }
            } else { // City exists, ensure we use the canonical name from cache
                const existingCityObj = citiesCache.find(city => normalizeName(city.name) === cityNormalizedForCheck);
                if(existingCityObj) finalCustomerCity = existingCityObj.name;
            }

            const items = []; let allItemsValid = true;
            document.querySelectorAll('.sale-item-row').forEach(row => { /* ... (item validation as before) ... */ 
                if (!allItemsValid) return;
                const productSelect = row.querySelector('.sale-item-product');
                const productCode = productSelect.value;
                if (!productCode) { return; } 
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const itemName = selectedOption.dataset.name;
                const currentStock = parseInt(selectedOption.dataset.stock || 0);
                const quantity = parseInt(row.querySelector('.sale-item-qty').value) || 0;
                const unitPrice = parseFloat(row.querySelector('.sale-item-price').value) || 0;
                const discountPercent = parseFloat(row.querySelector('.sale-item-discount-percent').value) || 0;

                if (quantity <= 0 ) { alert(`Quantity for ${itemName || 'selected item'} must be > 0.`); allItemsValid = false; return; }
                if (productCode && quantity > 0 && unitPrice >= 0) {
                    if (quantity > currentStock) { alert(`Not enough stock for ${itemName}. Has: ${currentStock}, Need: ${quantity}`); allItemsValid = false; return; }
                    const itemGrossTotal = quantity * unitPrice;
                    const discountPerItemAmount = itemGrossTotal * (discountPercent / 100);
                    items.push({ productCode, itemName, quantity, unitPrice, discountPercent, discountPerItemAmount, lineTotal: itemGrossTotal - discountPerItemAmount });
                }
            });
            if (!allItemsValid) return;
            if (items.length === 0) { alert("Add at least one valid item."); return; }

            const enteredNormalizedName = normalizeName(customerNameOriginal);
            if (!customerId) { // New customer OR existing customer typed out fully
                const existingCustomerInCity = customersCache.find(
                    c => c.normalizedName === enteredNormalizedName && (c.city || '').toLowerCase() === finalCustomerCity.toLowerCase()
                );
                if (existingCustomerInCity) {
                    customerId = existingCustomerInCity.id;
                    customerNameToSave = existingCustomerInCity.name;
                } else { // Truly a new customer
                    try {
                        const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                        customerId = newCustomerRef.key;
                        const customerDataToSave = { 
                            customerId, 
                            name: customerNameOriginal, 
                            normalizedName: enteredNormalizedName, 
                            city: finalCustomerCity, // Save with city
                            createdAt: firebase.database.ServerValue.TIMESTAMP 
                        };
                        await newCustomerRef.set(customerDataToSave);
                        await fetchCustomersForSuggestions(); // Refresh customer cache
                    } catch (customerError) { console.error("Error adding new customer:", customerError); alert("Could not save new customer."); return; }
                }
            } else { // Customer was selected from suggestions
                 const selectedCustomer = customersCache.find(c => c.id === customerId);
                 if (selectedCustomer) {
                     customerNameToSave = selectedCustomer.name;
                     // finalCustomerCity should ideally match selectedCustomer.city if selected.
                     // If user changed city input AFTER selecting customer, sale log takes current city input.
                 } else {
                    console.warn("Selected customer ID not found in cache. Proceeding with typed name.");
                    // This case should be rare if suggestions are working correctly.
                 }
            }
            
            const saleEntry = {
                saleDate, customerId, customerName: customerNameToSave, customerCity: finalCustomerCity, items,
                subTotal: parseFloat(subTotalInput.value),
                overallDiscountValue: parseFloat(overallDiscountValueInput.value) || 0, // Direct discount value
                grandTotal: parseFloat(grandTotalInput.value),
                paymentMethod: paymentMethodInput.value,
                saleNotes: saleNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            if (saleEntry.paymentMethod === 'Installment') {
                saleEntry.amountPaid = parseFloat(amountPaidInput.value) || 0;
                saleEntry.remainingBalance = parseFloat(remainingBalanceInput.value) || 0;
                if (saleEntry.amountPaid > saleEntry.grandTotal && saleEntry.grandTotal > 0) { // grandTotal check helps if it's 0
                    alert("Amount paid cannot be greater than Grand Total for installment."); return;
                }
                 if (saleEntry.amountPaid < 0) {
                    alert("Amount paid cannot be negative."); return;
                }
                // Allow zero initial payment if grand total is also zero or if it's a valid business case.
                // if (saleEntry.amountPaid <=0 && saleEntry.grandTotal > 0) {
                //    alert("For installment with a balance, amount paid should typically be greater than zero.");
                //    // return; // Uncomment if zero initial payment for non-zero total is not allowed
                // }
            }

            try {
                const newSaleRef = db.ref(SALES_LOG_PATH).push();
                saleEntry.saleId = newSaleRef.key;
                
                // Stock update logic (ensure this is robust, consider transactions if needed for multiple stock items)
                for (const item of items) {
                    const productRefPath = `${DEFINED_PRODUCTS_PATH}/${item.productCode}`; // Assuming productCode is the key/ID
                    // Using a transaction for each stock update is safer
                    await db.ref(productRefPath).transaction(currentProductData => {
                        if (currentProductData) {
                            if ((currentProductData.currentStock || 0) < item.quantity) {
                                console.error(`Stock update failed for ${item.itemName}: Not enough stock. Transaction aborted.`);
                                // To make the whole sale fail, you'd need a more complex multi-path update or rollback strategy
                                // For now, this transaction only aborts for this specific item.
                                return; // Abort this transaction
                            }
                            currentProductData.currentStock = (currentProductData.currentStock || 0) - item.quantity;
                            currentProductData.totalSold = (currentProductData.totalSold || 0) + item.quantity;
                            currentProductData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return currentProductData;
                        }
                        return currentProductData; // No data, do nothing
                    }, (error, committed, snapshot) => {
                        if (error) {
                            throw new Error(`Stock update transaction failed for ${item.itemName}: ${error.message}`);
                        }
                        if (!committed) {
                             throw new Error(`Stock update not committed for ${item.itemName} (likely due to insufficient stock).`);
                        }
                    });
                }
                // If all stock updates were successful (or errors handled), save the sale.
                await db.ref(`${SALES_LOG_PATH}/${saleEntry.saleId}`).set(saleEntry);

                alert(`Sale recorded! ID: ${saleEntry.saleId}`);
                generateAndShowInvoice(saleEntry);
                saleForm.reset(); 
                if(saleItemsContainer) saleItemsContainer.innerHTML = ''; 
                await fetchDefinedProductsForSelect(true); 
                addSaleItemRow();
                if(saleDateInput) saleDateInput.valueAsDate = new Date(); 
                
                if(customerCitySelect) customerCitySelect.value = '';
                if(newCityNameInput) newCityNameInput.value = '';
                if(customerNameInput) customerNameInput.value = '';
                if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
                if(selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = '';
                toggleCustomerNameInputState(); // Reset customer input state
                handlePaymentMethodChange(); // Reset payment fields

                calculateTotals(); // Recalculate to reset all totals to 0.00
            } catch (error) { console.error("Error recording sale or updating stock:", error); alert(`Error: ${error.message}`); }
        });
    }

    function loadSalesLog() {
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(50); 
        logRef.on('value', snapshot => {
            allSalesData = snapshot.exists() ? snapshot.val() : {};
            displayFilteredSales();
        }, error => {
            console.error("Error listening to sales log:", error);
            allSalesData = {}; displayFilteredSales(); 
        });
    }
    
    function displayFilteredSales() {
        if (!salesLogTableBody) { console.error("salesLogTableBody element not found!"); return; }
        salesLogTableBody.innerHTML = ''; 
        const searchTerm = searchSalesInput ? searchSalesInput.value.toLowerCase() : "";
        let salesDisplayed = 0;

        if (allSalesData && typeof allSalesData === 'object') {
            const salesArray = Object.keys(allSalesData)
                .map(key => ({ id: key, ...allSalesData[key] }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            salesArray.forEach(sale => {
                const customerNameMatches = sale.customerName && sale.customerName.toLowerCase().includes(searchTerm);
                const saleIdMatches = sale.saleId && sale.saleId.toLowerCase().includes(searchTerm);
                const cityMatches = sale.customerCity && sale.customerCity.toLowerCase().includes(searchTerm);
                if (!searchTerm || customerNameMatches || saleIdMatches || cityMatches) {
                    renderSaleLogRow(sale.id, sale); salesDisplayed++;
                }
            });
        } else { console.warn("allSalesData is null or not an object.", allSalesData); }

        if (salesDisplayed === 0) {
            const row = salesLogTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 7;
            cell.textContent = searchTerm ? 'No sales match your search.' : 'No sales recorded yet.';
            cell.style.textAlign = 'center'; cell.style.padding = '1rem';
        }
    }
    if(searchSalesInput) searchSalesInput.addEventListener('input', displayFilteredSales);
    
    function renderSaleLogRow(saleKey, data) {
        const row = salesLogTableBody.insertRow(); row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        row.insertCell().textContent = data.saleId ? data.saleId.slice(-6).toUpperCase() : (saleKey ? saleKey.slice(-6).toUpperCase() : 'N/A');
        
        const customerCell = row.insertCell();
        let customerDisplayText = data.customerName || 'N/A';
        if (data.customerCity) customerDisplayText += ` (${data.customerCity})`;

        if (data.customerId) {
            const customerLink = document.createElement('a');
            customerLink.href = `customer_data.html?id=${data.customerId}`; // Assuming you have this page
            customerLink.textContent = customerDisplayText;
            customerLink.classList.add('table-link');
            customerCell.appendChild(customerLink);
        } else {
            customerCell.textContent = customerDisplayText;
        }

        const itemsCell = row.insertCell();
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display'); // Ensure this class is styled for minimal space
            data.items.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.itemName || 'Item'} (Qty: ${item.quantity || 0})`; ul.appendChild(li); });
            itemsCell.appendChild(ul);
        } else itemsCell.textContent = 'N/A';
        
        const totalCell = row.insertCell(); totalCell.textContent = data.grandTotal ? parseFloat(data.grandTotal).toFixed(2) : '0.00'; totalCell.classList.add('text-right');
        
        const paymentCell = row.insertCell();
        let paymentMethodText = data.paymentMethod || 'N/A';
        if (data.paymentMethod === 'Installment') {
            paymentMethodText += ` (Paid: ${parseFloat(data.amountPaid || 0).toFixed(2)}, Due: ${parseFloat(data.remainingBalance || 0).toFixed(2)})`;
        }
        paymentCell.textContent = paymentMethodText;

        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button'); invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i> Invoice'; invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm'); invoiceBtn.onclick = () => generateAndShowInvoice(data); 
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteSale(saleKey, data);
        actionsCell.appendChild(invoiceBtn); actionsCell.appendChild(deleteBtn);
    }

    async function deleteSale(saleId, saleData) {
        // Note: Deleting a sale does NOT automatically revert stock changes. This must be done manually.
        if (!saleId) return;
        if (confirm(`DELETE Sale ID: ${saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : saleId.slice(-6).toUpperCase()} for "${saleData.customerName}"?\n\nWARNING: Inventory stock levels will NOT be automatically reverted for the sold items.`)) {
            try {
                await db.ref(`${SALES_LOG_PATH}/${saleId}`).remove();
                console.log(`Sale ${saleId} deleted.`);
                // No need to call loadSalesLog() here, .on('value') will trigger displayFilteredSales()
                alert("Sale log entry deleted. Remember to adjust stock manually if needed.");
            } catch (error) { console.error(`Error deleting sale ${saleId}:`, error); alert("Error deleting sale log entry."); }
        }
    }

    function generateAndShowInvoice(saleData) {
        const doc = new jsPDF();
        const companyName = "Amee-Tea Pvt Ltd"; const companyAddress = "123 Tea Lane, Colombo, Sri Lanka"; const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, 20); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(companyAddress, 14, 26); doc.text(companyContact, 14, 32);
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 140, 22); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(`Invoice ID: ${saleData.saleId ? saleData.saleId.slice(-10) : 'N/A'}`, 140, 30); doc.text(`Date: ${saleData.saleDate}`, 140, 35);
        
        doc.setFontSize(12); doc.text("Bill To:", 14, 45); 
        doc.setFontSize(10);
        let customerLine1 = saleData.customerName;
        if (saleData.customerId) customerLine1 += ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})`;
        doc.text(customerLine1, 14, 50);
        let currentYForBillTo = 50;
        if (saleData.customerCity) {
            currentYForBillTo += 5;
            doc.text(`City: ${saleData.customerCity}`, 14, currentYForBillTo);
        }
        const tableStartY = currentYForBillTo + 10;
        doc.line(14, tableStartY - 5, 196, tableStartY - 5);

        const tableColumn = ["#", "Item", "Qty", "Price (Rs.)", "Disc. (%)", "Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => {
            tableRows.push([itemNumber++, `${item.itemName} (${item.productCode})`, item.quantity, parseFloat(item.unitPrice).toFixed(2), (item.discountPercent || 0).toFixed(2), parseFloat(item.lineTotal).toFixed(2)]);
        });
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: tableStartY, theme: 'striped', headStyles: { fillColor: [22, 160, 133] }, margin: { top: 60 } });
        
        let finalY = doc.lastAutoTable.finalY || tableStartY + 20; // Fallback if table is empty
        finalY += 10; 
        doc.setFontSize(10); 
        doc.text(`Subtotal:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        
        if (saleData.overallDiscountValue > 0) { // Changed from overallDiscountPercent
            finalY += 5; 
            doc.text(`Overall Discount:`, 140, finalY); 
            doc.text(`- Rs. ${parseFloat(saleData.overallDiscountValue || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        
        finalY += 10; doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if (saleData.paymentMethod === 'Installment') {
            finalY += 5; doc.text(`Amount Paid: Rs. ${parseFloat(saleData.amountPaid || 0).toFixed(2)}`, 14, finalY);
            finalY += 5; doc.text(`Remaining Balance: Rs. ${parseFloat(saleData.remainingBalance || 0).toFixed(2)}`, 14, finalY);
        }

        if(saleData.saleNotes){ finalY += 7; doc.text("Notes:", 14, finalY); const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); doc.text(notesLines, 14, finalY + 4); }
        
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, pageHeight - 10); doc.text("Generated on: " + new Date().toLocaleString(), 130, pageHeight - 10, {align: 'right'});
        doc.save(`Invoice-${saleData.saleId || saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    initializeSalesPage();
});