// === sales.js ===

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
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList'); // New div for suggestions
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId'); // Hidden input
    const saleItemsContainer = document.getElementById('saleItemsContainer');
    const addSaleItemButton = document.getElementById('addSaleItemButton');
    const subTotalInput = document.getElementById('subTotal');
    const overallDiscountInput = document.getElementById('overallDiscount');
    const grandTotalInput = document.getElementById('grandTotal');
    const paymentMethodInput = document.getElementById('paymentMethod');
    const saleNotesInput = document.getElementById('saleNotes');
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');

    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts';

    let definedProductsCache = [];
    let customersCache = []; // Array of { id, name, normalizedName }
    let allSalesData = {};

    async function initializeSalesPage() {
        saleDateInput.valueAsDate = new Date();
        await fetchDefinedProductsForSelect();
        await fetchCustomersForSuggestions(); // Fetch all customers for suggestions
        addSaleItemRow();
        loadSalesLog();
    }

    async function fetchDefinedProductsForSelect() {
        try {
            const snapshot = await db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName').once('value');
            definedProductsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => definedProductsCache.push({ id: child.key, ...child.val() }));
            }
        } catch (error) { console.error("Error fetching defined products:", error); }
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
                        normalizedName: child.val().normalizedName // Store normalized name for checks
                    });
                });
            }
        } catch (error) { console.error("Error fetching customers:", error); }
    }

    // --- Customer Input and Suggestions ---
    if (customerNameInput) {
        customerNameInput.addEventListener('input', () => {
            const searchTerm = customerNameInput.value.toLowerCase();
            customerSuggestionsListEl.innerHTML = '';
            selectedCustomerIdInput.value = ''; // Clear selected ID when typing

            if (searchTerm.length < 1) { // Minimum characters to trigger suggestions
                customerSuggestionsListEl.style.display = 'none';
                return;
            }

            const filteredCustomers = customersCache.filter(customer =>
                customer.name.toLowerCase().includes(searchTerm)
            ).slice(0, 5); // Limit suggestions

            if (filteredCustomers.length > 0) {
                const ul = document.createElement('ul');
                filteredCustomers.forEach(customer => {
                    const li = document.createElement('li');
                    li.textContent = customer.name;
                    li.addEventListener('click', () => {
                        customerNameInput.value = customer.name;
                        selectedCustomerIdInput.value = customer.id; // Store selected customer's ID
                        customerSuggestionsListEl.style.display = 'none';
                        customerSuggestionsListEl.innerHTML = '';
                    });
                    ul.appendChild(li);
                });
                customerSuggestionsListEl.appendChild(ul);
                customerSuggestionsListEl.style.display = 'block';
            } else {
                customerSuggestionsListEl.style.display = 'none';
            }
        });
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!customerNameInput.contains(event.target) && !customerSuggestionsListEl.contains(event.target)) {
                customerSuggestionsListEl.style.display = 'none';
            }
        });
    }
    
    // Normalize names for checking duplicates and for potential key usage (though IDs are better)
    function normalizeName(name) {
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_'); // Basic normalization
    }


    function addSaleItemRow() {
        const itemRowDiv = document.createElement('div'); itemRowDiv.classList.add('sale-item-row', 'form-grid');
        const productSelectDiv = document.createElement('div'); productSelectDiv.classList.add('form-group');
        const productSelect = document.createElement('select'); productSelect.classList.add('form-input', 'sale-item-product'); productSelect.required = true;
        let optionsHTML = '<option value="" disabled selected>-- Select Product --</option>';
        definedProductsCache.forEach(p => {
            optionsHTML += `<option value="${p.productCode}" data-price="${p.sellingPrice || 0}" data-name="${p.itemName}" data-stock="${p.currentStock || 0}">${p.itemName} (${p.productCode}) - Stock: ${p.currentStock || 0}</option>`;
        });
        productSelect.innerHTML = optionsHTML; productSelectDiv.appendChild(productSelect);
        const qtyDiv = document.createElement('div'); qtyDiv.classList.add('form-group');
        const qtyInput = document.createElement('input'); qtyInput.type = 'number'; qtyInput.min = "1"; qtyInput.classList.add('form-input', 'sale-item-qty'); qtyInput.placeholder = 'Qty'; qtyInput.required = true;
        qtyDiv.appendChild(qtyInput);
        const priceDiv = document.createElement('div'); priceDiv.classList.add('form-group');
        const priceInput = document.createElement('input'); priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.classList.add('form-input', 'sale-item-price'); priceInput.placeholder = 'Price'; priceInput.required = true;
        priceDiv.appendChild(priceInput);
        const itemDiscountDiv = document.createElement('div'); itemDiscountDiv.classList.add('form-group', 'item-discount-group');
        const itemDiscountInput = document.createElement('input'); itemDiscountInput.type = 'number'; itemDiscountInput.step = '0.01'; itemDiscountInput.classList.add('form-input', 'sale-item-discount'); itemDiscountInput.placeholder = 'Item Disc.'; itemDiscountInput.value = "0";
        itemDiscountDiv.appendChild(itemDiscountInput);
        const lineTotalDiv = document.createElement('div'); lineTotalDiv.classList.add('form-group', 'line-total-group');
        const lineTotalInput = document.createElement('input'); lineTotalInput.type = 'text'; lineTotalInput.classList.add('form-input', 'sale-item-linetotal'); lineTotalInput.placeholder = 'Total'; lineTotalInput.readOnly = true;
        lineTotalDiv.appendChild(lineTotalInput);
        const removeBtnDiv = document.createElement('div');
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger'); removeBtn.title="Remove Item";
        removeBtn.onclick = () => { itemRowDiv.remove(); calculateTotals(); }; removeBtnDiv.appendChild(removeBtn);
        itemRowDiv.appendChild(productSelectDiv); itemRowDiv.appendChild(qtyDiv); itemRowDiv.appendChild(priceDiv); itemRowDiv.appendChild(itemDiscountDiv); itemRowDiv.appendChild(lineTotalDiv); itemRowDiv.appendChild(removeBtnDiv);
        saleItemsContainer.appendChild(itemRowDiv);
        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStock = parseInt(selectedOption.dataset.stock || 0);
            qtyInput.max = maxStock;
            if (parseInt(qtyInput.value) > maxStock) qtyInput.value = maxStock > 0 ? maxStock : 1;
            if (!qtyInput.value && maxStock > 0) qtyInput.value = 1; else if (!qtyInput.value && maxStock === 0) qtyInput.value = 0;
            calculateTotals();
        });
        qtyInput.addEventListener('input', calculateTotals); priceInput.addEventListener('input', calculateTotals); itemDiscountInput.addEventListener('input', calculateTotals);
    }
    if (addSaleItemButton) addSaleItemButton.addEventListener('click', addSaleItemRow);
    if (overallDiscountInput) overallDiscountInput.addEventListener('input', calculateTotals);

    function calculateTotals() {
        let currentSubTotal = 0;
        document.querySelectorAll('.sale-item-row').forEach(row => {
            const qty = parseInt(row.querySelector('.sale-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.sale-item-price').value) || 0;
            const discount = parseFloat(row.querySelector('.sale-item-discount').value) || 0;
            const lineTotalField = row.querySelector('.sale-item-linetotal');
            if (qty > 0 && price >= 0) { // Price can be 0
                const itemTotal = (qty * price) - (qty * discount);
                lineTotalField.value = itemTotal.toFixed(2); currentSubTotal += itemTotal;
            } else { lineTotalField.value = "0.00"; }
        });
        subTotalInput.value = currentSubTotal.toFixed(2);
        const discountOverall = parseFloat(overallDiscountInput.value) || 0;
        grandTotalInput.value = (currentSubTotal - discountOverall).toFixed(2);
    }

    if (saleForm) {
        saleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saleDate = saleDateInput.value;
            let customerName = customerNameInput.value.trim();
            let customerId = selectedCustomerIdInput.value; // Use the ID if a customer was selected

            if (!saleDate || !customerName) { alert("Please fill Sale Date and Customer Name."); return; }

            const items = []; let allItemsValid = true;
            document.querySelectorAll('.sale-item-row').forEach(row => {
                if (!allItemsValid) return; // Skip further processing if an item is invalid
                const productSelect = row.querySelector('.sale-item-product');
                const productCode = productSelect.value;
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const itemName = selectedOption.dataset.name;
                const currentStock = parseInt(selectedOption.dataset.stock || 0);
                const quantity = parseInt(row.querySelector('.sale-item-qty').value) || 0;
                const unitPrice = parseFloat(row.querySelector('.sale-item-price').value) || 0;
                const discountPerItem = parseFloat(row.querySelector('.sale-item-discount').value) || 0;
                if (productCode && quantity > 0 && unitPrice >= 0) {
                    if (quantity > currentStock) {
                        alert(`Not enough stock for ${itemName}. Available: ${currentStock}, Requested: ${quantity}`);
                        allItemsValid = false; return;
                    }
                    items.push({ productCode, itemName, quantity, unitPrice, discountPerItem, lineTotal: (quantity * unitPrice) - (quantity * discountPerItem) });
                }
            });
            if (!allItemsValid) return;
            if (items.length === 0) { alert("Add at least one item to the sale."); return; }

            // Handle Customer: Check if existing by ID, then by name, then create new
            const enteredNormalizedName = normalizeName(customerName);
            if (!customerId) { // If no customer was selected from suggestions
                const existingCustomerByName = customersCache.find(c => c.normalizedName === enteredNormalizedName);
                if (existingCustomerByName) {
                    customerId = existingCustomerByName.id;
                    console.log("Existing customer found by name:", customerName);
                } else { // Create new customer
                    try {
                        const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                        customerId = newCustomerRef.key;
                        await newCustomerRef.set({
                            customerId: customerId, // Store key as a field
                            name: customerName,
                            normalizedName: enteredNormalizedName,
                            createdAt: firebase.database.ServerValue.TIMESTAMP
                        });
                        console.log("New customer added:", customerName, "ID:", customerId);
                        await fetchCustomersForSuggestions(); // Refresh cache and suggestions
                    } catch (customerError) {
                        console.error("Error adding new customer:", customerError);
                        alert("Could not save new customer. Sale not completed."); return;
                    }
                }
            }
            
            const saleEntry = {
                saleDate, customerId, customerName, items,
                subTotal: parseFloat(subTotalInput.value),
                overallDiscountAmount: parseFloat(overallDiscountInput.value) || 0,
                grandTotal: parseFloat(grandTotalInput.value),
                paymentMethod: paymentMethodInput.value,
                saleNotes: saleNotesInput.value.trim() || null,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                const newSaleRef = db.ref(SALES_LOG_PATH).push();
                saleEntry.saleId = newSaleRef.key;
                
                const stockUpdates = {};
                stockUpdates[`${SALES_LOG_PATH}/${saleEntry.saleId}`] = saleEntry; // Add sale to updates

                for (const item of items) {
                    const productRefPath = `${DEFINED_PRODUCTS_PATH}/${item.productCode}`;
                    // For transactions, it's better to use Firebase transactions on stock counts
                    await db.ref(productRefPath).transaction(currentProductData => {
                        if (currentProductData) {
                            currentProductData.currentStock = (currentProductData.currentStock || 0) - item.quantity;
                            currentProductData.totalSold = (currentProductData.totalSold || 0) + item.quantity;
                            currentProductData.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                            return currentProductData;
                        }
                        return currentProductData; // Abort if product somehow disappeared
                    });
                }
                // Set the sale log entry after all stock transactions are prepared or done
                // Using multi-path update to set the sale entry itself
                await db.ref(`${SALES_LOG_PATH}/${saleEntry.saleId}`).set(saleEntry);


                alert(`Sale recorded successfully! Sale ID: ${saleEntry.saleId}`);
                generateAndShowInvoice(saleEntry);
                
                saleForm.reset(); saleItemsContainer.innerHTML = ''; addSaleItemRow();
                saleDateInput.valueAsDate = new Date(); calculateTotals();
                fetchDefinedProductsForSelect(); // Refresh product stock in dropdowns
                selectedCustomerIdInput.value = ''; // Reset selected customer

            } catch (error) {
                console.error("Error recording sale or updating stock:", error);
                alert("Error recording sale. Some stock updates might have failed. Check console.");
            }
        });
    }

    function loadSalesLog() {
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(50);
        logRef.on('value', snapshot => {
            allSalesData = snapshot.val() || {}; displayFilteredSales();
        });
    }
    
    function displayFilteredSales() {
        salesLogTableBody.innerHTML = ''; const searchTerm = searchSalesInput.value.toLowerCase(); let salesDisplayed = false;
        const salesArray = Object.keys(allSalesData).map(key => ({ id: key, ...allSalesData[key] })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        salesArray.forEach(sale => {
            if (sale.customerName.toLowerCase().includes(searchTerm) || (sale.saleId && sale.saleId.toLowerCase().includes(searchTerm))) {
                renderSaleLogRow(sale.id, sale); salesDisplayed = true;
            }
        });
        if(!salesDisplayed){
            const row = salesLogTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 7;
            cell.textContent = searchTerm ? 'No sales match.' : 'No sales recorded.'; cell.style.textAlign = 'center'; cell.style.padding = '1rem'; cell.style.color = 'var(--text-color-muted)';
        }
    }
    if(searchSalesInput) searchSalesInput.addEventListener('input', displayFilteredSales);

    function renderSaleLogRow(saleKey, data) { // saleKey is now the actual push ID
        const row = salesLogTableBody.insertRow(); row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        row.insertCell().textContent = data.saleId || saleKey.slice(-6).toUpperCase() || 'N/A'; // Use the field if present, else part of key
        row.insertCell().textContent = data.customerName || 'N/A';
        const itemsCell = row.insertCell();
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul'); ul.classList.add('material-list-display');
            data.items.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.itemName} (Qty: ${item.quantity})`; ul.appendChild(li); });
            itemsCell.appendChild(ul);
        } else itemsCell.textContent = 'N/A';
        const totalCell = row.insertCell(); totalCell.textContent = data.grandTotal ? parseFloat(data.grandTotal).toFixed(2) : '0.00'; totalCell.classList.add('text-right');
        row.insertCell().textContent = data.paymentMethod || 'N/A';
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button'); invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i> Invoice'; invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm'); invoiceBtn.onclick = () => generateAndShowInvoice(data); actionsCell.appendChild(invoiceBtn);
    }

    function generateAndShowInvoice(saleData) {
        const doc = new jsPDF();
        const companyName = "Amee-Tea Pvt Ltd"; const companyAddress = "123 Tea Lane, Colombo, Sri Lanka"; const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, 20); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(companyAddress, 14, 26); doc.text(companyContact, 14, 32);
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 140, 22); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(`Invoice ID: ${saleData.saleId || 'N/A'}`, 140, 30); doc.text(`Date: ${saleData.saleDate}`, 140, 35);
        doc.setFontSize(12); doc.text("Bill To:", 14, 45); doc.setFontSize(10); doc.text(saleData.customerName, 14, 50);
        doc.line(14, 60, 196, 60);
        const tableColumn = ["#", "Item Description", "Qty", "Unit Price (Rs.)", "Discount (Rs.)", "Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        saleData.items.forEach(item => {
            tableRows.push([itemNumber++, `${item.itemName} (${item.productCode})`, item.quantity, parseFloat(item.unitPrice).toFixed(2), parseFloat(item.discountPerItem * item.quantity).toFixed(2), parseFloat(item.lineTotal).toFixed(2)]);
        });
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 65, theme: 'striped', headStyles: { fillColor: [22, 160, 133] }, margin: { top: 60 } });
        let finalY = doc.lastAutoTable.finalY || 70;
        finalY += 10; doc.setFontSize(10); doc.text(`Subtotal:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.subTotal).toFixed(2)}`, 196, finalY, { align: 'right' });
        if (saleData.overallDiscountAmount > 0) { finalY += 5; doc.text(`Overall Discount:`, 140, finalY); doc.text(`- Rs. ${parseFloat(saleData.overallDiscountAmount).toFixed(2)}`, 196, finalY, { align: 'right' }); }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.grandTotal).toFixed(2)}`, 196, finalY, { align: 'right' }); doc.setFont(undefined, 'normal');
        finalY += 10; doc.setFontSize(10); doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if(saleData.saleNotes){ finalY += 7; doc.text("Notes:", 14, finalY); const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); doc.text(notesLines, 14, finalY + 4); }
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, pageHeight - 10); doc.text("Generated on: " + new Date().toLocaleString(), 140, pageHeight - 10);
        doc.save(`Invoice-${saleData.saleId || saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    initializeSalesPage();
});