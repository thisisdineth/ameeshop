// === sales.js (Complete and Updated with Debugging for Sales History) ===

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
    const customerNameInput = document.getElementById('customerName');
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const saleItemsContainer = document.getElementById('saleItemsContainer');
    const addSaleItemButton = document.getElementById('addSaleItemButton');
    const subTotalInput = document.getElementById('subTotal');
    const overallDiscountPercentInput = document.getElementById('overallDiscountPercent');
    const overallDiscountAmountInput = document.getElementById('overallDiscountAmount'); // Hidden
    const grandTotalInput = document.getElementById('grandTotal');
    const paymentMethodInput = document.getElementById('paymentMethod');
    const saleNotesInput = document.getElementById('saleNotes');
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');

    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts';

    let definedProductsCache = [];
    let customersCache = [];
    let allSalesData = {}; // This will store the fetched sales data object

    async function initializeSalesPage() {
        console.log("Initializing Sales Page...");
        if(saleDateInput) saleDateInput.valueAsDate = new Date();
        await fetchDefinedProductsForSelect(true); // Force refresh on initial load
        await fetchCustomersForSuggestions();
        if (saleItemsContainer && saleItemsContainer.children.length === 0) {
            addSaleItemRow();
        }
        loadSalesLog();
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
            console.log("Fetched products for sale dropdown:", definedProductsCache.length, "items.", definedProductsCache);
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
            // Trigger change to auto-fill price if a valid product is (re)selected
            if (selectElement.value && selectElement.selectedIndex > 0) { // Check if not the placeholder
                const event = new Event('change', { bubbles: true });
                selectElement.dispatchEvent(event);
            } else { // If placeholder is selected, clear price and recalculate
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
        } else {
             console.log("No products in cache to populate select. Path:", DEFINED_PRODUCTS_PATH);
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
                        normalizedName: child.val().normalizedName 
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
            if (searchTerm.length < 1) { customerSuggestionsListEl.style.display = 'none'; return; }
            const filteredCustomers = customersCache.filter(customer =>
                customer.name && customer.name.toLowerCase().includes(searchTerm)
            ).slice(0, 5); 
            if (filteredCustomers.length > 0) {
                const ul = document.createElement('ul');
                filteredCustomers.forEach(customer => {
                    const li = document.createElement('li'); li.textContent = customer.name;
                    li.addEventListener('click', () => {
                        customerNameInput.value = customer.name;
                        selectedCustomerIdInput.value = customer.id; 
                        customerSuggestionsListEl.style.display = 'none'; customerSuggestionsListEl.innerHTML = '';
                    });
                    ul.appendChild(li);
                });
                customerSuggestionsListEl.appendChild(ul); customerSuggestionsListEl.style.display = 'block';
            } else { customerSuggestionsListEl.style.display = 'none'; }
        });
        document.addEventListener('click', (event) => {
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
        const productSelect = document.createElement('select'); productSelect.classList.add('form-input', 'sale-item-product'); productSelect.required = true;
        populateProductSelect(productSelect); 
        productSelectDiv.appendChild(productSelect);
        const qtyDiv = document.createElement('div'); qtyDiv.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.min = "1"; qtyInput.classList.add('form-input', 'sale-item-qty'); qtyInput.placeholder = 'Qty'; qtyInput.required = true; qtyInput.value = "1";
        qtyDiv.appendChild(qtyInput);
        const priceDiv = document.createElement('div'); priceDiv.classList.add('form-group');
        const priceInput = document.createElement('input'); priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.classList.add('form-input', 'sale-item-price'); priceInput.placeholder = 'Price'; priceInput.required = true;
        priceDiv.appendChild(priceInput);
        const itemDiscountDiv = document.createElement('div'); itemDiscountDiv.classList.add('form-group', 'item-discount-group');
        const itemDiscountLabel = document.createElement('label'); itemDiscountLabel.textContent = 'Item Disc. (%)'; itemDiscountLabel.classList.add('form-label', 'form-label-sm');
        const itemDiscountInput = document.createElement('input'); itemDiscountInput.type = 'number'; itemDiscountInput.step = '0.01'; itemDiscountInput.min="0"; itemDiscountInput.max="100"; itemDiscountInput.classList.add('form-input', 'sale-item-discount-percent'); itemDiscountInput.placeholder = '%'; itemDiscountInput.value = "0";
        itemDiscountDiv.appendChild(itemDiscountLabel); itemDiscountDiv.appendChild(itemDiscountInput);
        const lineTotalDiv = document.createElement('div'); lineTotalDiv.classList.add('form-group', 'line-total-group');
        const lineTotalLabel = document.createElement('label'); lineTotalLabel.textContent = 'Line Total'; lineTotalLabel.classList.add('form-label', 'form-label-sm');
        const lineTotalInput = document.createElement('input'); lineTotalInput.type = 'text'; lineTotalInput.classList.add('form-input', 'sale-item-linetotal'); lineTotalInput.placeholder = 'Total'; lineTotalInput.readOnly = true;
        lineTotalDiv.appendChild(lineTotalLabel); lineTotalDiv.appendChild(lineTotalInput);
        const removeBtnDiv = document.createElement('div');
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger'); removeBtn.title="Remove Item";
        removeBtn.onclick = () => { itemRowDiv.remove(); calculateTotals(); }; removeBtnDiv.appendChild(removeBtn);
        itemRowDiv.appendChild(productSelectDiv); itemRowDiv.appendChild(qtyDiv); itemRowDiv.appendChild(priceDiv); itemRowDiv.appendChild(itemDiscountDiv); itemRowDiv.appendChild(lineTotalDiv); itemRowDiv.appendChild(removeBtnDiv);
        if (saleItemsContainer) saleItemsContainer.appendChild(itemRowDiv);

        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if(priceInput) priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStock = parseInt(selectedOption.dataset.stock || 0);
            if(qtyInput) {
                qtyInput.max = maxStock;
                if (!qtyInput.value || parseInt(qtyInput.value) === 0 || parseInt(qtyInput.value) > maxStock ) qtyInput.value = maxStock > 0 ? 1 : 0;
                if(maxStock === 0) qtyInput.value = 0;
            }
            calculateTotals();
        });
        if (productSelect.value) { // Auto-trigger change for pre-selected values if any (usually for the first row if cache is ready)
            const event = new Event('change', { bubbles: true });
            productSelect.dispatchEvent(event);
        }
        if(qtyInput) qtyInput.addEventListener('input', calculateTotals); 
        if(priceInput) priceInput.addEventListener('input', calculateTotals); 
        if(itemDiscountInput) itemDiscountInput.addEventListener('input', calculateTotals);
    }
    if (addSaleItemButton) {
        addSaleItemButton.addEventListener('click', async () => {
            await fetchDefinedProductsForSelect(true); 
            addSaleItemRow();
        });
    }
    if (overallDiscountPercentInput) overallDiscountPercentInput.addEventListener('input', calculateTotals);

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
        const discountOverallPercent = parseFloat(overallDiscountPercentInput.value) || 0;
        const overallDiscountValue = currentSubTotal * (discountOverallPercent / 100);
        if(overallDiscountAmountInput) overallDiscountAmountInput.value = overallDiscountValue.toFixed(2); 
        if(grandTotalInput) grandTotalInput.value = (currentSubTotal - overallDiscountValue).toFixed(2);
    }

    if (saleForm) {
        saleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saleDate = saleDateInput.value;
            let customerNameOriginal = customerNameInput.value.trim(); // Use this for saving if new
            let customerId = selectedCustomerIdInput.value; 
            let customerNameToSave = customerNameOriginal; // This will be the name saved in the sale log

            if (!saleDate || !customerNameOriginal) { alert("Please fill Sale Date and Customer Name."); return; }

            const items = []; let allItemsValid = true;
            document.querySelectorAll('.sale-item-row').forEach(row => {
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
            if (!customerId) {
                const existingCustomerByName = customersCache.find(c => c.normalizedName === enteredNormalizedName);
                if (existingCustomerByName) {
                    customerId = existingCustomerByName.id;
                    customerNameToSave = existingCustomerByName.name; // Use canonical name from DB
                } else {
                    if (!customerNameOriginal) { alert("Customer name empty."); return; }
                    try {
                        const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                        customerId = newCustomerRef.key;
                        const customerDataToSave = { customerId, name: customerNameOriginal, normalizedName: enteredNormalizedName, createdAt: firebase.database.ServerValue.TIMESTAMP };
                        if (typeof customerDataToSave.normalizedName === 'undefined') { console.error("CRITICAL: normalizedName undefined. Original:", customerNameOriginal); alert("Error processing customer name."); return; }
                        await newCustomerRef.set(customerDataToSave);
                        await fetchCustomersForSuggestions(); 
                    } catch (customerError) { console.error("Error adding customer:", customerError); alert("Could not save customer."); return; }
                }
            } else { // Customer was selected from suggestions, use their canonical name
                 const selectedCustomer = customersCache.find(c => c.id === customerId);
                 if (selectedCustomer) customerNameToSave = selectedCustomer.name;
            }
            
            const saleEntry = {
                saleDate, customerId, customerName: customerNameToSave, items,
                subTotal: parseFloat(subTotalInput.value),
                overallDiscountPercent: parseFloat(overallDiscountPercentInput.value) || 0,
                overallDiscountAmount: parseFloat(overallDiscountAmountInput.value) || 0,
                grandTotal: parseFloat(grandTotalInput.value),
                paymentMethod: paymentMethodInput.value,
                saleNotes: saleNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                const newSaleRef = db.ref(SALES_LOG_PATH).push();
                saleEntry.saleId = newSaleRef.key;
                const updates = {};
                updates[`${SALES_LOG_PATH}/${saleEntry.saleId}`] = saleEntry;
                for (const item of items) {
                    const productRefPath = `${DEFINED_PRODUCTS_PATH}/${item.productCode}`;
                    await db.ref(productRefPath).transaction(currentProductData => {
                        if (currentProductData) {
                            if ((currentProductData.currentStock || 0) < item.quantity) { return; } // Abort
                            currentProductData.currentStock = (currentProductData.currentStock || 0) - item.quantity;
                            currentProductData.totalSold = (currentProductData.totalSold || 0) + item.quantity;
                            currentProductData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return currentProductData;
                        } return currentProductData;
                    });
                }
                // It's better to perform sale log write after stock transactions if possible, or use multi-path update for sale log as well if non-transactional stock update
                // For now, assuming transactions for stock, then write sale log.
                // If any stock transaction failed, the sale log shouldn't ideally be written.
                // The current code structure will write the sale log regardless of transaction success.
                // A better way: use the updates object for stock, then db.ref().update(updates) if all stock checks pass.
                // But transactions are per-path. So, we update stock with transactions, then save the sale.

                await db.ref(`${SALES_LOG_PATH}/${saleEntry.saleId}`).set(saleEntry); // Set sale data after stock updates attempted

                alert(`Sale recorded! ID: ${saleEntry.saleId}`);
                generateAndShowInvoice(saleEntry);
                saleForm.reset(); saleItemsContainer.innerHTML = ''; 
                await fetchDefinedProductsForSelect(true); 
                addSaleItemRow();
                saleDateInput.valueAsDate = new Date(); calculateTotals();
                selectedCustomerIdInput.value = ''; customerNameInput.value = '';
            } catch (error) { console.error("Error recording sale:", error); alert("Error recording sale."); }
        });
    }

    // --- Load and Display Sales Log (WITH ENHANCED LOGGING) ---
    function loadSalesLog() {
        // console.log(`Attempting to load sales log from path: ${SALES_LOG_PATH}`);
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(50); 
        logRef.on('value', snapshot => {
            // console.log("Sales Log snapshot received from Firebase.");
            if (snapshot.exists()) {
                allSalesData = snapshot.val();
                // console.log("Sales data fetched:", allSalesData);
            } else {
                allSalesData = {};
                // console.log("No sales data found at path:", SALES_LOG_PATH);
            }
            displayFilteredSales();
        }, error => {
            console.error("Error listening to sales log:", error);
            allSalesData = {};
            displayFilteredSales(); 
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
            // console.log("Processed sales array for display:", salesArray.length, "items");

            salesArray.forEach(sale => {
                const customerNameMatches = sale.customerName && sale.customerName.toLowerCase().includes(searchTerm);
                const saleIdMatches = sale.saleId && sale.saleId.toLowerCase().includes(searchTerm);
                if (!searchTerm || customerNameMatches || saleIdMatches) {
                    renderSaleLogRow(sale.id, sale); salesDisplayed++;
                }
            });
        } else { console.warn("allSalesData is null or not an object. Cannot display sales.", allSalesData); }

        if (salesDisplayed === 0) {
            const row = salesLogTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 7;
            cell.textContent = searchTerm ? 'No sales match your search.' : 'No sales recorded yet.';
            cell.style.textAlign = 'center'; cell.style.padding = '1rem'; cell.style.color = 'var(--text-color-muted)';
        }
    }
    if(searchSalesInput) searchSalesInput.addEventListener('input', displayFilteredSales);
    
    function renderSaleLogRow(saleKey, data) {
        const row = salesLogTableBody.insertRow(); row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        row.insertCell().textContent = data.saleId || (saleKey ? saleKey.slice(-6).toUpperCase() : 'N/A');
        const customerCell = row.insertCell();
        if (data.customerId) { // Only make it a link if customerId exists
            const customerLink = document.createElement('a');
            customerLink.href = `customer_data.html?id=${data.customerId}`;
            customerLink.textContent = data.customerName || 'N/A';
            customerLink.classList.add('table-link');
            customerCell.appendChild(customerLink);
        } else {
            customerCell.textContent = data.customerName || 'N/A';
        }
        const itemsCell = row.insertCell();
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display');
            data.items.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.itemName || 'Item'} (Qty: ${item.quantity || 0})`; ul.appendChild(li); });
            itemsCell.appendChild(ul);
        } else itemsCell.textContent = 'N/A';
        const totalCell = row.insertCell(); totalCell.textContent = data.grandTotal ? parseFloat(data.grandTotal).toFixed(2) : '0.00'; totalCell.classList.add('text-right');
        row.insertCell().textContent = data.paymentMethod || 'N/A';
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button'); invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i> Invoice'; invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm'); invoiceBtn.onclick = () => generateAndShowInvoice(data); 
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteSale(saleKey, data);
        actionsCell.appendChild(invoiceBtn); actionsCell.appendChild(deleteBtn);
    }

    async function deleteSale(saleId, saleData) {
        if (!saleId) return;
        if (confirm(`DELETE Sale ID: ${saleData.saleId || saleId.slice(-6).toUpperCase()} for "${saleData.customerName}"?\n\nWARNING: Inventory NOT automatically reverted.`)) {
            try {
                await db.ref(`${SALES_LOG_PATH}/${saleId}`).remove();
                console.log(`Sale ${saleId} deleted.`);
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
        doc.setFontSize(10); doc.text(`Invoice ID: ${saleData.saleId || 'N/A'}`, 140, 30); doc.text(`Date: ${saleData.saleDate}`, 140, 35);
        doc.setFontSize(12); doc.text("Bill To:", 14, 45); doc.setFontSize(10); doc.text(saleData.customerName + (saleData.customerId ? ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})` : ""), 14, 50);
        doc.line(14, 60, 196, 60);
        const tableColumn = ["#", "Item", "Qty", "Price (Rs.)", "Disc. (%)", "Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => {
            tableRows.push([itemNumber++, `${item.itemName} (${item.productCode})`, item.quantity, parseFloat(item.unitPrice).toFixed(2), (item.discountPercent || 0).toFixed(2), parseFloat(item.lineTotal).toFixed(2)]);
        });
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 65, theme: 'striped', headStyles: { fillColor: [22, 160, 133] }, margin: { top: 60 } });
        let finalY = doc.lastAutoTable.finalY || 70;
        finalY += 10; doc.setFontSize(10); doc.text(`Subtotal:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        if (saleData.overallDiscountPercent > 0) { 
            finalY += 5; 
            doc.text(`Overall Discount (${saleData.overallDiscountPercent.toFixed(2)}%):`, 140, finalY); 
            doc.text(`- Rs. ${parseFloat(saleData.overallDiscountAmount || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        finalY += 10; doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if(saleData.saleNotes){ finalY += 7; doc.text("Notes:", 14, finalY); const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); doc.text(notesLines, 14, finalY + 4); }
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, pageHeight - 10); doc.text("Generated on: " + new Date().toLocaleString(), 130, pageHeight - 10, {align: 'right'});
        doc.save(`Invoice-${saleData.saleId || saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    initializeSalesPage();
});