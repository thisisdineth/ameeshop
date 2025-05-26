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
    const { jsPDF } = window.jspdf;

    // --- Navbar ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    const saleForm = document.getElementById('saleForm');
    const saleDateInput = document.getElementById('saleDate');
    const customerCitySelect = document.getElementById('customerCitySelect');
    const newCityNameInput = document.getElementById('newCityNameInput');
    const customerNameInput = document.getElementById('customerName');
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const selectedCustomerCityNameInput = document.getElementById('selectedCustomerCityName');
    const saleItemsContainer = document.getElementById('saleItemsContainer');
    const addSaleItemButton = document.getElementById('addSaleItemButton');
    const subTotalInput = document.getElementById('subTotal');
    const overallDiscountValueInput = document.getElementById('overallDiscountValueInput');
    const grandTotalInput = document.getElementById('grandTotal');
    const paymentMethodInput = document.getElementById('paymentMethod');
    const installmentFieldsContainer = document.getElementById('installmentFieldsContainer');
    const amountPaidInput = document.getElementById('amountPaid');
    const remainingBalanceInput = document.getElementById('remainingBalance');
    const saleNotesInput = document.getElementById('saleNotes');
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');
    const noSalesHistoryText = document.getElementById('noSalesHistoryText');


    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    // IMPORTANT: Use the same path as your production_v2.js for finished products
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const CITIES_PATH = 'cities';

    let definedProductsCache = [];
    let customersCache = [];
    let citiesCache = [];
    let allSalesData = {}; // For client-side search

    async function initializeSalesPage() {
        if (saleDateInput) saleDateInput.valueAsDate = new Date();
        
        await fetchCitiesAndPopulateDropdown();
        await fetchDefinedProductsForSelect(true); // Force refresh on init
        await fetchCustomersForSuggestions();

        if (saleItemsContainer.children.length === 0) addSaleItemRow();
        
        loadSalesLog();
        toggleCustomerNameInputState();
        handlePaymentMethodChange();

        if (customerCitySelect) customerCitySelect.addEventListener('change', handleCityChange);
        if (newCityNameInput) newCityNameInput.addEventListener('input', handleNewCityInput);
        if (paymentMethodInput) paymentMethodInput.addEventListener('change', handlePaymentMethodChange);
        if (amountPaidInput) amountPaidInput.addEventListener('input', calculateRemainingBalanceAndUpdateTotals);
        if (overallDiscountValueInput) overallDiscountValueInput.addEventListener('input', calculateTotals);
        if (searchSalesInput) searchSalesInput.addEventListener('input', displayFilteredSales);

    }

    function handleCityChange() {
        if (customerCitySelect.value) {
            if (newCityNameInput) newCityNameInput.value = '';
            if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customerCitySelect.value;
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
    }

    function handleNewCityInput() {
        if (newCityNameInput.value.trim()) {
            if (customerCitySelect) customerCitySelect.value = '';
            // selectedCustomerCityNameInput will be set when new city is confirmed or customer selected
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
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
            if (isDisabled) clearCustomerInput();
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

    async function fetchDefinedProductsForSelect(forceRefresh = false) {
        if (!forceRefresh && definedProductsCache.length > 0) {
            updateAllProductDropdowns(); return;
        }
        try {
            // Fetch from the updated path: definedFinishedProducts_v2
            const snapshot = await db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName').once('value');
            definedProductsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const productData = child.val();
                    // Ensure product has necessary fields for sale, especially currentStock
                    if (productData.productCode && productData.itemName) {
                        definedProductsCache.push({ 
                            id: child.key, // productCode is typically the key here
                            ...productData,
                            currentStock: productData.currentStock || 0 // Ensure currentStock is a number
                        });
                    }
                });
            }
            updateAllProductDropdowns();
        } catch (error) { 
            console.error("Error fetching defined products for sales:", error); 
            definedProductsCache = []; 
            updateAllProductDropdowns(); // Still update to show empty or error state
        }
    }
    
    function updateAllProductDropdowns() {
        document.querySelectorAll('.sale-item-product').forEach(selectElement => {
            const currentValue = selectElement.value; // Preserve selected value if possible
            populateProductSelect(selectElement);
            // Try to reselect if product still exists and has stock
            const productExists = definedProductsCache.some(p => p.productCode === currentValue && (p.currentStock || 0) > 0);
            if (productExists) {
                selectElement.value = currentValue;
            } else {
                selectElement.selectedIndex = 0; // Default to "-- Select Product --"
            }
             // Trigger change to update price and other dependent fields
            const event = new Event('change', { bubbles: true });
            selectElement.dispatchEvent(event);
        });
         if(saleItemsContainer.children.length === 0 && definedProductsCache.length > 0) {
            // If no items and products are loaded, add an initial row
           // addSaleItemRow(); // This might be too aggressive, let user click "Add Item"
        }
    }

    function populateProductSelect(selectElement) {
        if (!selectElement) return;
        let optionsHTML = '<option value="" disabled selected>-- Select Product --</option>';
        if (Array.isArray(definedProductsCache) && definedProductsCache.length > 0) {
            definedProductsCache.forEach(p => {
                // Only list products with sellable stock > 0
                if (p && p.productCode && p.itemName && (p.currentStock || 0) > 0) { 
                    optionsHTML += `<option value="${p.productCode}" data-price="${p.sellingPrice || 0}" data-name="${p.itemName}" data-stock="${p.currentStock || 0}">${p.itemName} (${p.productCode}) - Stock: ${p.currentStock || 0}</option>`;
                } else if (p && p.productCode && p.itemName && (p.currentStock || 0) <= 0) {
                    // Optionally show out-of-stock items but disabled
                    // optionsHTML += `<option value="${p.productCode}" data-price="${p.sellingPrice || 0}" data-name="${p.itemName}" data-stock="0" disabled>${p.itemName} (${p.productCode}) - Out of Stock</option>`;
                }
            });
        } else {
            optionsHTML = '<option value="" disabled selected>-- No Products Available --</option>';
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
                        normalizedName: child.val().normalizedName, // Assuming you have this field
                        city: child.val().city || "" 
                    });
                });
            }
        } catch (error) { console.error("Error fetching customers:", error); }
    }

    if (customerNameInput) {
        customerNameInput.addEventListener('input', () => {
            const searchTerm = customerNameInput.value.toLowerCase();
            customerSuggestionsListEl.innerHTML = '';
            selectedCustomerIdInput.value = ''; 
            
            const currentCityValue = customerCitySelect.value || newCityNameInput.value.trim();
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
                    });
                    ul.appendChild(li);
                });
                customerSuggestionsListEl.appendChild(ul); customerSuggestionsListEl.style.display = 'block';
            } else { 
                customerSuggestionsListEl.innerHTML = `<li>No customers matching "${customerNameInput.value}" in ${currentCityValue || 'this city'}. Type full name to add.</li>`;
                customerSuggestionsListEl.style.display = 'block';
            }
        });
        document.addEventListener('click', (event) => { 
            if (customerSuggestionsListEl && customerNameInput && !customerNameInput.contains(event.target) && !customerSuggestionsListEl.contains(event.target)) {
                customerSuggestionsListEl.style.display = 'none';
            }
        });
    }
    
    function normalizeName(name) {
        if (typeof name !== 'string') return "";
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_');
    }

    function addSaleItemRow() {
        const itemRowDiv = document.createElement('div'); itemRowDiv.classList.add('sale-item-row', 'form-grid');
        
        const productSelectDiv = document.createElement('div'); productSelectDiv.classList.add('form-group');
        productSelectDiv.innerHTML = '<label class="form-label form-label-sm">Product</label>';
        const productSelect = document.createElement('select'); productSelect.classList.add('form-input', 'sale-item-product'); productSelect.required = true;
        populateProductSelect(productSelect); // Populate with currently cached products
        productSelectDiv.appendChild(productSelect);

        const qtyDiv = document.createElement('div'); qtyDiv.classList.add('form-group');
        qtyDiv.innerHTML = '<label class="form-label form-label-sm">Qty</label>';
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.min = "1"; qtyInput.classList.add('form-input', 'sale-item-qty'); qtyInput.placeholder = 'Qty'; qtyInput.required = true; qtyInput.value = "1";
        qtyDiv.appendChild(qtyInput);

        const priceDiv = document.createElement('div'); priceDiv.classList.add('form-group');
        priceDiv.innerHTML = '<label class="form-label form-label-sm">Price/Unit</label>';
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

        const removeBtnDiv = document.createElement('div'); removeBtnDiv.classList.add('form-group'); 
        removeBtnDiv.style.paddingTop = '1.5em'; 
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm'); removeBtn.title="Remove Item";
        removeBtn.onclick = () => { itemRowDiv.remove(); calculateTotals(); }; 
        removeBtnDiv.appendChild(removeBtn);

        itemRowDiv.appendChild(productSelectDiv); itemRowDiv.appendChild(qtyDiv); itemRowDiv.appendChild(priceDiv); itemRowDiv.appendChild(itemDiscountDiv); itemRowDiv.appendChild(lineTotalDiv); itemRowDiv.appendChild(removeBtnDiv);
        saleItemsContainer.appendChild(itemRowDiv);

        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption || !selectedOption.value) { // Handle "-- Select Product --"
                priceInput.value = '';
                qtyInput.value = '1';
                qtyInput.max = ''; // Reset max
                calculateTotals();
                return;
            }
            priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStock = parseInt(selectedOption.dataset.stock || 0);
            qtyInput.max = maxStock; // Set max based on stock
             if (parseInt(qtyInput.value) > maxStock || parseInt(qtyInput.value) <= 0 ) {
                qtyInput.value = maxStock > 0 ? 1 : 0; // Default to 1 if stock available, else 0
            }
            if (maxStock === 0) {
                qtyInput.value = 0; // Cannot sell if no stock
                alert(`"${selectedOption.dataset.name}" is out of stock.`);
            }
            calculateTotals();
        });
        // Initialize price if a product is pre-selected (e.g. if logic changes to pre-fill first row)
        if (productSelect.value) productSelect.dispatchEvent(new Event('change'));

        qtyInput.addEventListener('input', calculateTotals); 
        priceInput.addEventListener('input', calculateTotals); 
        itemDiscountInput.addEventListener('input', calculateTotals);
        if (productSelect.value) { // If a product is selected by default (e.g. first in list with stock)
             productSelect.dispatchEvent(new Event('change'));
        }
    }

    if (addSaleItemButton) {
        addSaleItemButton.addEventListener('click', async () => {
            // It's good practice to ensure product list is fresh if it could change often
            // await fetchDefinedProductsForSelect(true); // Uncomment if you want to force refresh every time
            if (definedProductsCache.length === 0) {
                await fetchDefinedProductsForSelect(true); // Fetch if empty
            }
            addSaleItemRow();
        });
    }

    function calculateTotals() {
        let currentSubTotal = 0;
        document.querySelectorAll('.sale-item-row').forEach(row => {
            const productSelect = row.querySelector('.sale-item-product');
            const selectedOption = productSelect ? productSelect.options[productSelect.selectedIndex] : null;
            const currentStock = selectedOption ? parseInt(selectedOption.dataset.stock || 0) : 0;

            const qtyInput = row.querySelector('.sale-item-qty');
            let qty = parseInt(qtyInput.value) || 0;
            
            if (qty > currentStock && selectedOption && selectedOption.value) { // Check if a product is actually selected
                alert(`Quantity for ${selectedOption.dataset.name} exceeds available stock (${currentStock}). Adjusting to max available.`);
                qty = currentStock;
                qtyInput.value = qty;
            }
            if (qty < 0) { // Prevent negative quantities
                qty = 0;
                qtyInput.value = qty;
            }


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
        
        const directDiscountAmount = parseFloat(overallDiscountValueInput.value) || 0;
        const calculatedGrandTotal = currentSubTotal - directDiscountAmount;
        if(grandTotalInput) grandTotalInput.value = calculatedGrandTotal > 0 ? calculatedGrandTotal.toFixed(2) : "0.00";

        if (paymentMethodInput && paymentMethodInput.value === 'Installment') {
            calculateRemainingBalance();
        }
    }

    function handlePaymentMethodChange() {
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
    
    function calculateRemainingBalanceAndUpdateTotals() {
        calculateTotals(); // Recalculate totals first as grand total might affect this
    }

    function calculateRemainingBalance() {
        if (!grandTotalInput || !amountPaidInput || !remainingBalanceInput) return;
        const grandTotal = parseFloat(grandTotalInput.value) || 0;
        const paidAmount = parseFloat(amountPaidInput.value) || 0;
        const balance = grandTotal - paidAmount;
        remainingBalanceInput.value = balance.toFixed(2);
    }

    if (saleForm) {
        saleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saleDate = saleDateInput.value;
            let customerNameOriginal = customerNameInput.value.trim();
            let customerId = selectedCustomerIdInput.value;
            let customerNameToSave = customerNameOriginal; // Default to typed name

            let finalCustomerCity = "";
            if (customerCitySelect && customerCitySelect.value) {
                finalCustomerCity = customerCitySelect.value;
            } else if (newCityNameInput && newCityNameInput.value.trim()) {
                finalCustomerCity = newCityNameInput.value.trim();
            }

            if (!saleDate || !customerNameOriginal || !finalCustomerCity) {
                alert("Please fill Sale Date, Customer City (select or add new), and Customer Name."); return;
            }
            finalCustomerCity = finalCustomerCity.trim();
            let cityNormalizedForCheck = normalizeName(finalCustomerCity);

            // Save new city if entered
            const cityExists = citiesCache.some(city => normalizeName(city.name) === cityNormalizedForCheck);
            if (newCityNameInput.value.trim() && !cityExists) {
                 try {
                    const newCityRef = db.ref(CITIES_PATH).push();
                    await newCityRef.set({ name: finalCustomerCity });
                    await fetchCitiesAndPopulateDropdown(); // Refresh dropdown and cache
                 } catch (cityError) { console.error("Error saving new city:", cityError); alert("Could not save new city."); return; }
            } else if (cityExists) { // If city exists, use canonical name from cache
                const existingCityObj = citiesCache.find(city => normalizeName(city.name) === cityNormalizedForCheck);
                if(existingCityObj) finalCustomerCity = existingCityObj.name;
            }


            const items = []; let allItemsValid = true;
            document.querySelectorAll('.sale-item-row').forEach(row => {
                if (!allItemsValid) return;
                const productSelect = row.querySelector('.sale-item-product');
                const productCode = productSelect.value;
                if (!productCode) { return; } // Skip if no product selected in a row
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const itemName = selectedOption.dataset.name;
                const currentStock = parseInt(selectedOption.dataset.stock || 0); // Fetched from DEFINED_PRODUCTS_PATH
                const quantity = parseInt(row.querySelector('.sale-item-qty').value) || 0;
                const unitPrice = parseFloat(row.querySelector('.sale-item-price').value) || 0;
                const discountPercent = parseFloat(row.querySelector('.sale-item-discount-percent').value) || 0;

                if (quantity <= 0 ) { alert(`Quantity for ${itemName || 'selected item'} must be > 0.`); allItemsValid = false; return; }
                if (quantity > currentStock) { alert(`Not enough stock for ${itemName}. Available: ${currentStock}, Requested: ${quantity}.`); allItemsValid = false; return; }
                
                const itemGrossTotal = quantity * unitPrice;
                const discountPerItemAmount = itemGrossTotal * (discountPercent / 100);
                items.push({ productCode, itemName, quantity, unitPrice, discountPercent, discountPerItemAmount, lineTotal: itemGrossTotal - discountPerItemAmount });
            });

            if (!allItemsValid) return;
            if (items.length === 0) { alert("Please add at least one valid item to the sale."); return; }

            // Customer handling (existing logic seems fine)
            const enteredNormalizedName = normalizeName(customerNameOriginal);
            if (!customerId) { // New customer OR existing customer typed out fully
                const existingCustomerInCity = customersCache.find(
                    c => c.normalizedName === enteredNormalizedName && (c.city || '').toLowerCase() === finalCustomerCity.toLowerCase()
                );
                if (existingCustomerInCity) {
                    customerId = existingCustomerInCity.id;
                    customerNameToSave = existingCustomerInCity.name; // Use canonical name
                } else { // Truly a new customer
                    try {
                        const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                        customerId = newCustomerRef.key;
                        await newCustomerRef.set({ 
                            customerId, name: customerNameOriginal, normalizedName: enteredNormalizedName, 
                            city: finalCustomerCity, createdAt: firebase.database.ServerValue.TIMESTAMP 
                        });
                        await fetchCustomersForSuggestions(); // Refresh cache
                    } catch (customerError) { console.error("Error adding new customer:", customerError); alert("Could not save new customer."); return; }
                }
            } else { // Customer was selected
                 const selectedCustomer = customersCache.find(c => c.id === customerId);
                 if (selectedCustomer) customerNameToSave = selectedCustomer.name; // Use canonical name
            }
            
            const saleEntry = {
                saleDate, customerId, customerName: customerNameToSave, customerCity: finalCustomerCity, items,
                subTotal: parseFloat(subTotalInput.value),
                overallDiscountValue: parseFloat(overallDiscountValueInput.value) || 0,
                grandTotal: parseFloat(grandTotalInput.value),
                paymentMethod: paymentMethodInput.value,
                saleNotes: saleNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            if (saleEntry.paymentMethod === 'Installment') {
                saleEntry.amountPaid = parseFloat(amountPaidInput.value) || 0;
                saleEntry.remainingBalance = parseFloat(remainingBalanceInput.value) || 0;
                if (saleEntry.amountPaid > saleEntry.grandTotal && saleEntry.grandTotal > 0) { alert("Amount paid cannot exceed Grand Total for installment."); return; }
                if (saleEntry.amountPaid < 0) { alert("Amount paid cannot be negative."); return; }
            }

            // --- Transactional Stock Update and Sale Record ---
            try {
                const stockUpdatePromises = items.map(item => {
                    const productRefPath = `${DEFINED_PRODUCTS_PATH}/${item.productCode}`;
                    return db.ref(productRefPath).transaction(currentProductData => {
                        if (currentProductData) {
                            if ((currentProductData.currentStock || 0) < item.quantity) {
                                // This specific transaction will abort due to insufficient stock.
                                // The error will be caught by the Promise.all or individual promise.
                                return; // Abort by returning undefined
                            }
                            currentProductData.currentStock = (currentProductData.currentStock || 0) - item.quantity;
                            currentProductData.totalSold = (currentProductData.totalSold || 0) + item.quantity;
                            currentProductData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return currentProductData;
                        }
                        return undefined; // Product not found, abort
                    }, (error, committed, snapshot) => {
                        if (error) throw new Error(`Stock update transaction failed for ${item.itemName}: ${error.message}`);
                        if (!committed && snapshot && (snapshot.val().currentStock + item.quantity) < item.quantity) { 
                            // Check if not committed due to stock condition. This check can be tricky.
                            // A more robust way is to check if the original condition (stock < quantity) was met.
                            // For simplicity, if !committed, we assume stock issue for now.
                            throw new Error(`Stock update not committed for ${item.itemName} (likely insufficient stock). Sale cannot proceed.`);
                        }
                         if (!committed && !snapshot) { // Product likely didn't exist at path
                            throw new Error(`Product ${item.itemName} (${item.productCode}) not found for stock update.`);
                        }

                    }, false); // ApplyLocally set to false if issues with immediate UI updates, true by default
                });

                await Promise.all(stockUpdatePromises); // Wait for all stock updates

                // If all stock updates were successful (no errors thrown from Promises.all), save the sale.
                const newSaleRef = db.ref(SALES_LOG_PATH).push();
                saleEntry.saleId = newSaleRef.key;
                await newSaleRef.set(saleEntry);

                alert(`Sale recorded! ID: ${saleEntry.saleId}`);
                generateAndShowInvoice(saleEntry); // Generate invoice after successful save
                
                saleForm.reset(); 
                saleItemsContainer.innerHTML = ''; 
                await fetchDefinedProductsForSelect(true); // Refresh product list for next sale (shows updated stock)
                addSaleItemRow(); // Add a fresh row
                if(saleDateInput) saleDateInput.valueAsDate = new Date();
                
                // Reset customer fields
                customerCitySelect.value = ''; newCityNameInput.value = ''; customerNameInput.value = '';
                selectedCustomerIdInput.value = ''; selectedCustomerCityNameInput.value = '';
                toggleCustomerNameInputState();
                handlePaymentMethodChange(); // Reset payment fields
                calculateTotals(); // Reset totals

            } catch (error) { 
                console.error("Error during sale processing (stock update or sale save):", error); 
                alert(`Sale not recorded. Error: ${error.message}. Please check stock and try again.`); 
                // IMPORTANT: Consider if any partial stock updates need manual rollback or a more complex compensation transaction.
                // For now, it alerts the user that the sale failed.
                await fetchDefinedProductsForSelect(true); // Refresh product list to show potentially unchanged stock.
            }
        });
    }

    function loadSalesLog() {
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(100); // Increased limit slightly
        logRef.on('value', snapshot => {
            allSalesData = snapshot.exists() ? snapshot.val() : {};
            displayFilteredSales();
        }, error => {
            console.error("Error listening to sales log:", error);
            allSalesData = {}; displayFilteredSales(); 
        });
    }
    
    function displayFilteredSales() {
        if (!salesLogTableBody) return;
        salesLogTableBody.innerHTML = ''; 
        const searchTerm = searchSalesInput ? searchSalesInput.value.toLowerCase().trim() : "";
        let salesDisplayed = 0;

        if (allSalesData && typeof allSalesData === 'object' && Object.keys(allSalesData).length > 0) {
            const salesArray = Object.keys(allSalesData)
                .map(key => ({ id: key, ...allSalesData[key] }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Newest first

            salesArray.forEach(sale => {
                const customerNameMatches = sale.customerName && sale.customerName.toLowerCase().includes(searchTerm);
                const saleIdMatches = sale.saleId && sale.saleId.toLowerCase().includes(searchTerm);
                const cityMatches = sale.customerCity && sale.customerCity.toLowerCase().includes(searchTerm);
                if (!searchTerm || customerNameMatches || saleIdMatches || cityMatches) {
                    renderSaleLogRow(sale.id, sale); salesDisplayed++;
                }
            });
        }
        noSalesHistoryText.style.display = salesDisplayed === 0 ? 'block' : 'none';
        if (salesDisplayed === 0) {
            noSalesHistoryText.textContent = searchTerm ? 'No sales match your search.' : 'No sales recorded yet.';
        }
    }
    
    function renderSaleLogRow(saleKey, data) {
        const row = salesLogTableBody.insertRow(); row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        row.insertCell().textContent = data.saleId ? data.saleId.slice(-6).toUpperCase() : (saleKey ? saleKey.slice(-6).toUpperCase() : 'N/A');
        
        const customerCell = row.insertCell();
        let customerDisplayText = data.customerName || 'N/A';
        if (data.customerCity) customerDisplayText += ` (${data.customerCity})`;

        if (data.customerId) { // Link to customer details page if available
            const customerLink = document.createElement('a');
            // Assuming you might have a customer_details.html or similar
            customerLink.href = `customers.html#${data.customerId}`; // Link to customers page, could refine to specific customer view
            customerLink.textContent = customerDisplayText;
            customerLink.classList.add('table-link');
            customerCell.appendChild(customerLink);
        } else {
            customerCell.textContent = customerDisplayText;
        }

        const itemsCell = row.insertCell();
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display'); 
            data.items.forEach(item => { 
                const li = document.createElement('li'); 
                li.textContent = `${item.itemName || 'Item'} (Qty: ${item.quantity || 0})`; 
                ul.appendChild(li); 
            });
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
        const invoiceBtn = document.createElement('button'); invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i>'; invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm'); invoiceBtn.title="View/Print Invoice"; invoiceBtn.onclick = () => generateAndShowInvoice(data); 
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');  deleteBtn.title="Delete Sale"; deleteBtn.onclick = () => deleteSale(saleKey, data);
        actionsCell.appendChild(invoiceBtn); actionsCell.appendChild(deleteBtn);
    }

    async function deleteSale(saleId, saleData) {
        if (!saleId) return;
        const confirmationMessage = `DELETE Sale ID: ${saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : saleId.slice(-6).toUpperCase()} for "${saleData.customerName}"?\n
        !!! IMPORTANT WARNING !!!
        This action is IRREVERSIBLE and WILL NOT automatically revert the stock levels for the items sold in this transaction.
        If this sale is deleted, you must MANUALLY ADJUST the stock for each product involved.\n
        Are you absolutely sure you want to proceed with deleting this sale log?`;

        if (confirm(confirmationMessage)) {
            try {
                await db.ref(`${SALES_LOG_PATH}/${saleId}`).remove();
                alert("Sale log entry deleted. REMEMBER TO MANUALLY ADJUST STOCK LEVELS IF THIS SALE WAS ALREADY ACCOUNTED FOR IN INVENTORY.");
                // The live listener on salesLog will automatically refresh the table.
                // Refresh product list to reflect any (manually reverted) stock changes if needed for immediate next sale.
                await fetchDefinedProductsForSelect(true);
            } catch (error) { console.error(`Error deleting sale ${saleId}:`, error); alert("Error deleting sale log entry."); }
        }
    }

    function generateAndShowInvoice(saleData) {
        const doc = new jsPDF();
        const companyName = "Amee-Tea Pvt Ltd"; const companyAddress = "123 Tea Lane, Colombo, Sri Lanka"; const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        let currentY = 15; // Start Y position
        
        // Header
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, currentY); 
        currentY += 6; doc.setFontSize(10); doc.setFont(undefined, 'normal');
        doc.text(companyAddress, 14, currentY);
        currentY += 5; doc.text(companyContact, 14, currentY);
        
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 196, 18, { align: 'right' }); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        doc.text(`Invoice ID: ${saleData.saleId ? saleData.saleId.slice(-10).toUpperCase() : 'N/A'}`, 196, 26, { align: 'right' });
        doc.text(`Date: ${saleData.saleDate}`, 196, 31, { align: 'right' });
        currentY += 10; // Space after header

        // Bill To
        doc.setLineWidth(0.2); doc.line(14, currentY, 196, currentY); currentY += 5;
        doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text("Bill To:", 14, currentY); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10); currentY += 5;
        let customerLine1 = saleData.customerName;
        if (saleData.customerId) customerLine1 += ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})`;
        doc.text(customerLine1, 14, currentY);
        if (saleData.customerCity) { currentY += 5; doc.text(`City: ${saleData.customerCity}`, 14, currentY); }
        currentY += 8; // Space before table
        
        // Table
        const tableColumn = ["#", "Item Description", "Qty", "Price (Rs.)", "Disc. (%)", "Line Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => {
            tableRows.push([
                itemNumber++, 
                `${item.itemName || 'N/A'} (${item.productCode || 'N/A'})`, 
                item.quantity, 
                parseFloat(item.unitPrice || 0).toFixed(2), 
                (item.discountPercent || 0).toFixed(2), 
                parseFloat(item.lineTotal || 0).toFixed(2)
            ]);
        });
        doc.autoTable({ 
            head: [tableColumn], body: tableRows, startY: currentY, 
            theme: 'striped', headStyles: { fillColor: [22, 160, 133], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, // #
                1: { cellWidth: 'auto' },             // Item
                2: { cellWidth: 15, halign: 'right' }, // Qty
                3: { cellWidth: 25, halign: 'right' }, // Price
                4: { cellWidth: 20, halign: 'right' }, // Disc %
                5: { cellWidth: 30, halign: 'right' }  // Line Total
            }
        });
        
        let finalY = doc.lastAutoTable.finalY || currentY + 20;
        finalY += 7; 
        doc.setFontSize(10); 
        doc.text(`Subtotal:`, 150, finalY, {align: 'right'}); doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        
        if (saleData.overallDiscountValue > 0) {
            finalY += 5; 
            doc.text(`Overall Discount:`, 150, finalY, {align: 'right'}); 
            doc.text(`- Rs. ${parseFloat(saleData.overallDiscountValue || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 150, finalY, {align: 'right'}); doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        
        finalY += 10; doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if (saleData.paymentMethod === 'Installment') {
            finalY += 5; doc.text(`Amount Paid: Rs. ${parseFloat(saleData.amountPaid || 0).toFixed(2)}`, 14, finalY);
            finalY += 5; doc.text(`Remaining Balance: Rs. ${parseFloat(saleData.remainingBalance || 0).toFixed(2)}`, 14, finalY);
        }

        if(saleData.saleNotes){ 
            finalY += 7; 
            doc.setFont(undefined, 'bold'); doc.text("Notes:", 14, finalY); doc.setFont(undefined, 'normal');
            const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); 
            doc.text(notesLines, 14, finalY + 4); 
            finalY += (notesLines.length * 4) + 4; // Adjust Y based on notes length
        }
        
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const footerY = pageHeight - 15;
        doc.setLineWidth(0.2); doc.line(14, footerY - 2, 196, footerY - 2);
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, footerY); 
        doc.text("Generated: " + new Date().toLocaleString(), 196, footerY, {align: 'right'});
        
        doc.save(`Invoice-${(saleData.saleId || 'SALE').slice(-6)}-${saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    initializeSalesPage();
});