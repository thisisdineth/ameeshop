document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = { // YOUR FIREBASE CONFIG
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    // --- Initialize Firebase and jsPDF ---
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    const { jsPDF } = window.jspdf;


    // --- DOM Element References ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const deliveryVehicleNumberInput = document.getElementById('deliveryVehicleNumberInput');
    const vehicleSuggestionsListEl = document.getElementById('vehicleSuggestionsList');
    const driverNameInput = document.getElementById('driverNameInput');
    const driverSuggestionsListEl = document.getElementById('driverSuggestionsList');
    const selectedDeliveryInfoEl = document.getElementById('selectedDeliveryInfo');
    const saleForm = document.getElementById('saleForm');
    const saleDateInput = document.getElementById('saleDate');
    const customerCitySelect = document.getElementById('customerCitySelect');
    const newCityNameInput = document.getElementById('newCityNameInput');
    const customerNameInput = document.getElementById('customerName');
    const customerSuggestionsListEl = document.getElementById('customerSuggestionsList');
    const selectedCustomerIdInput = document.getElementById('selectedCustomerId');
    const selectedCustomerCityNameInput = document.getElementById('selectedCustomerCityName');
    const installmentDueMessage = document.getElementById('installmentDueMessage');
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
    const salesLogTableBody = document.getElementById('salesLogTableBody');
    const searchSalesInput = document.getElementById('searchSalesInput');
    const noSalesHistoryText = document.getElementById('noSalesHistoryText');
    const exportSalesHistoryButton = document.getElementById('exportSalesHistoryButton');

    // --- Firebase Paths ---
    const SALES_LOG_PATH = 'salesLog';
    const CUSTOMERS_PATH = 'customers';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const DELIVERY_LOGS_PATH = 'deliveryLogs';
    const CITIES_PATH = 'cities';

    // --- In-Memory Caches & State ---
    let definedProductsCache = [];
    let deliveryLogsCache = [];
    let customersCache = [];
    let citiesCache = [];
    let allSalesData = {};
    let selectedDeliveryVehicleContext = null;
    let productsAvailableInSelectedVehicle = [];

    /**
     * Main initialization function that runs when the page loads.
     */
    async function initializeSalesPage() {
        if (saleDateInput) saleDateInput.valueAsDate = new Date();

        await fetchCitiesAndPopulateDropdown();
        await fetchDefinedProductsOnce();
        await fetchDeliveryLogs();
        await fetchCustomersForSuggestions();

        listenForProductUpdates();

        if (addSaleItemButton) addSaleItemButton.disabled = true;
        if (completeSaleButton) completeSaleButton.disabled = true;

        loadSalesLog();
        toggleCustomerNameInputState();
        handlePaymentMethodChange();

        attachEventListeners();
    }

    /**
     * Attaches all event listeners for the page.
     */
    function attachEventListeners() {
        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        }
        if (deliveryVehicleNumberInput) {
            deliveryVehicleNumberInput.addEventListener('input', () => handleDeliveryInput(deliveryVehicleNumberInput, 'vehicleNumber', vehicleSuggestionsListEl));
        }
        if (driverNameInput) {
            driverNameInput.addEventListener('input', () => handleDeliveryInput(driverNameInput, 'driverName', driverSuggestionsListEl));
        }
        if (customerCitySelect) {
            customerCitySelect.addEventListener('change', handleCityChange);
        }
        if (newCityNameInput) {
            newCityNameInput.addEventListener('input', handleNewCityInput);
        }
        if (customerNameInput) {
            customerNameInput.addEventListener('input', handleCustomerNameInput);
            customerNameInput.addEventListener('change', checkCustomerInstallmentStatus);
        }
        if (paymentMethodInput) {
            paymentMethodInput.addEventListener('change', handlePaymentMethodChange);
        }
        if (amountPaidInput) {
            amountPaidInput.addEventListener('input', calculateRemainingBalanceAndUpdateTotals);
        }
        if (overallDiscountValueInput) {
            overallDiscountValueInput.addEventListener('input', calculateTotals);
        }
        if (searchSalesInput) {
            searchSalesInput.addEventListener('input', displayFilteredSales);
        }
        if (addSaleItemButton) {
            addSaleItemButton.addEventListener('click', addSaleItemRow);
        }
        if (saleForm) {
            saleForm.addEventListener('submit', handleSaleFormSubmit);
        }
        if (exportSalesHistoryButton) {
            exportSalesHistoryButton.addEventListener('click', exportSalesHistoryToExcel);
        }

        document.addEventListener('click', (event) => {
            if (vehicleSuggestionsListEl && !vehicleSuggestionsListEl.contains(event.target) && !deliveryVehicleNumberInput.contains(event.target)) {
                vehicleSuggestionsListEl.style.display = 'none';
            }
            if (driverSuggestionsListEl && !driverSuggestionsListEl.contains(event.target) && !driverNameInput.contains(event.target)) {
                driverSuggestionsListEl.style.display = 'none';
            }
            if (customerSuggestionsListEl && !customerSuggestionsListEl.contains(event.target) && !customerNameInput.contains(event.target)) {
                customerSuggestionsListEl.style.display = 'none';
            }
        });
    }

    /**
     * Exports sales history to an Excel file.
     */
    function exportSalesHistoryToExcel() {
        if (typeof XLSX === 'undefined') {
            alert("Excel export library (SheetJS) is not loaded.");
            return;
        }
        if (!allSalesData || Object.keys(allSalesData).length === 0) {
            alert("No sales history to export.");
            return;
        }

        try {
            const salesArray = Object.values(allSalesData).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const dataToExport = salesArray.map(sale => {
                const itemsString = (sale.items || []).map(item => `${item.itemName || 'N/A'} (Qty: ${item.quantity}, Price: ${item.unitPrice})`).join('; ');
                return {
                    'Sale ID': sale.saleId,
                    'Date': sale.saleDate,
                    'Customer Name': sale.customerName,
                    'Customer City': sale.customerCity,
                    'Items': itemsString,
                    'Vehicle': sale.sourceVehicleNumber,
                    'Driver': sale.sourceDriverName,
                    'Subtotal': sale.subTotal,
                    'Discount': sale.overallDiscountValue,
                    'Grand Total': sale.grandTotal,
                    'Payment Method': sale.paymentMethod,
                    'Amount Paid': sale.paymentMethod === 'Installment' ? sale.amountPaid : sale.grandTotal,
                    'Remaining Balance': sale.paymentMethod === 'Installment' ? sale.remainingBalance : 0,
                    'Notes': sale.saleNotes,
                    'Timestamp': new Date(sale.timestamp).toLocaleString()
                };
            });

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sales History');
            const fileName = `Sales_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            alert("An error occurred while creating the Excel file.");
        }
    }

    /**
     * Generates a 58mm x 100mm PDF receipt.
     */
async function generateAndPrintReceipt(saleData) {
    try {
        // Using an 80mm wide format with a long page for dynamic height on thermal printers.
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 297] });
        
        const FONT_SIZE_NORMAL = 8;
        const FONT_SIZE_SMALL = 7;
        const FONT_SIZE_TOTAL = 10;

        const MARGIN_LEFT = 4;
        const MARGIN_RIGHT = 76;
        let currentY = 5;

        const centerText = (text, y) => {
            const textWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            doc.text(text, (80 - textWidth) / 2, y);
        };
        const rightAlignedText = (text, x, y) => doc.text(text, x, y, { align: 'right' });
        const drawLine = (y) => {
            doc.setLineDashPattern([0.5, 0.5], 0);
            doc.line(MARGIN_LEFT, y, MARGIN_RIGHT, y);
            doc.setLineDashPattern([], 0);
        };

        // Add Logo at the top
        try {
            doc.addImage('logo.jpeg', 'jpeg', 31, currentY, 18, 18);
            currentY += 24;
        } catch (e) {
            console.error("Could not add logo.jpeg. Make sure the file exists.", e);
            currentY += 5;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        centerText('Amee Store (PVT) LTD', currentY);
        currentY += 6;

        doc.setFontSize(FONT_SIZE_NORMAL);
        doc.setFont(undefined, 'normal');
        centerText('110/J/1 Sri Saddhananda Mawatha,', currentY);
        currentY += 4;
        centerText('Katuwela, Boralesgamuwa', currentY);
        currentY += 4;
        centerText('Phone: +94 701010018 | Fax: +94 112 518 386', currentY);
        currentY += 7;

        drawLine(currentY);
        currentY += 5;

        doc.text(`Date: ${saleData.saleDate || ''}`, MARGIN_LEFT, currentY);
        currentY += 5;

        if (saleData.customerName) {
            doc.text(`Customer: ${saleData.customerName}`, MARGIN_LEFT, currentY);
            currentY += 6;
        }

        drawLine(currentY);
        currentY += 2;
        
        (saleData.items || []).forEach(item => {
            currentY += 4;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(FONT_SIZE_NORMAL);
            doc.text(item.itemName || 'N/A', MARGIN_LEFT, currentY);
            currentY += 5;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(FONT_SIZE_SMALL);
            doc.text('Qty', MARGIN_LEFT, currentY);
            doc.text('U/Price', 40, currentY);
            rightAlignedText('Amount', MARGIN_RIGHT, currentY);
            currentY += 4;
            doc.setFontSize(FONT_SIZE_NORMAL);
            doc.text(String(parseInt(item.quantity || 0)), MARGIN_LEFT, currentY);
            doc.text(parseFloat(item.unitPrice || 0).toFixed(2), 40, currentY);
            rightAlignedText(parseFloat(item.lineTotal || 0).toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 5;
            drawLine(currentY);
        });

        currentY += 5;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(FONT_SIZE_NORMAL);
        doc.text('Subtotal', MARGIN_LEFT, currentY);
        rightAlignedText(parseFloat(saleData.subTotal || 0).toFixed(2), MARGIN_RIGHT, currentY);
        currentY += 5;

        if (saleData.overallDiscountValue > 0) {
            doc.text('Overall Discount', MARGIN_LEFT, currentY);
            rightAlignedText(`- ${parseFloat(saleData.overallDiscountValue).toFixed(2)}`, MARGIN_RIGHT, currentY);
            currentY += 5;
        }

        doc.setFont(undefined, 'bold');
        doc.text('Grand Total', MARGIN_LEFT, currentY);
        rightAlignedText(parseFloat(saleData.grandTotal || 0).toFixed(2), MARGIN_RIGHT, currentY);
        currentY += 5;
        doc.setFont(undefined, 'normal');
        
        drawLine(currentY);
        currentY += 5;

        if (saleData.paymentMethod === 'Installment') {
            doc.text('Paid (this bill)', MARGIN_LEFT, currentY);
            rightAlignedText(parseFloat(saleData.amountPaid || 0).toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 5;
            doc.text('To paid (this bill)', MARGIN_LEFT, currentY);
            rightAlignedText(parseFloat(saleData.remainingBalance || 0).toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 5;
        }

        if (saleData.previousInstallmentDue > 0) {
            doc.text('To paid (previous)', MARGIN_LEFT, currentY);
            rightAlignedText(saleData.previousInstallmentDue.toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 5;
        }

        const finalTotalToBePaid = (saleData.remainingBalance || 0) + (saleData.previousInstallmentDue || 0);

        // --- MODIFICATION: Only show the 'TOTAL DUE' line if the value is greater than 0 ---
        if (finalTotalToBePaid > 0) {
            drawLine(currentY);
            currentY += 5;
            doc.setFontSize(FONT_SIZE_TOTAL);
            doc.setFont(undefined, 'bold');
            doc.text('TOTAL DUE', MARGIN_LEFT, currentY);
            rightAlignedText(finalTotalToBePaid.toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 7;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(FONT_SIZE_NORMAL);
        }

        if (saleData.paymentMethod) {
            doc.text(`Payment Method: ${saleData.paymentMethod}`, MARGIN_LEFT, currentY);
        }
        currentY += 9;

        centerText('Thank You for shopping with us!', currentY);
        currentY += 5;
        centerText('Generated: ' + new Date().toLocaleDateString(), currentY);

        currentY += 8;
        doc.setFontSize(FONT_SIZE_SMALL);
        doc.text('I received all products in good quality.', MARGIN_LEFT, currentY);
        
        currentY += 15;
        drawLine(currentY);
        currentY += 4;
        doc.text('Customer Signature', MARGIN_LEFT, currentY);

        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');

    } catch (error) {
        console.error("Error generating PDF receipt:", error);
        alert("Could not generate the PDF receipt.");
    }
}


    // --- Delivery Vehicle Selection Logic ---
    async function fetchDeliveryLogs() {
        try {
            const snapshot = await db.ref(DELIVERY_LOGS_PATH).orderByChild('loadedAtTimestamp').once('value');
            deliveryLogsCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    if ((child.val().stockInVehicle || 0) > 0) {
                         deliveryLogsCache.push({ deliveryLogId: child.key, ...child.val() });
                    }
                });
                deliveryLogsCache.reverse();
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
            clearDeliverySelection();
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
            suggestions.slice(0, 7).forEach(sugg => {
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
        if(saleItemsContainer) saleItemsContainer.innerHTML = '';
        if(addSaleItemButton) addSaleItemButton.disabled = true;
        if(completeSaleButton) completeSaleButton.disabled = true;
        calculateTotals();
    }

    function confirmDeliveryVehicleSelection(vehicleNo, driverName) {
        vehicleNo = vehicleNo.trim();
        driverName = driverName.trim();

        if (!vehicleNo && !driverName) {
            clearDeliverySelection();
            return;
        }

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
            clearDeliverySelection();
            return;
        }

        const aggregatedStock = {};
        relevantLogs.forEach(log => {
            const productDef = definedProductsCache.find(p => p.productCode === log.productCode);
            const sellingPrice = productDef ? productDef.sellingPrice : 0;

            if (!aggregatedStock[log.productCode]) {
                aggregatedStock[log.productCode] = {
                    productCode: log.productCode,
                    productName: log.productName || (productDef ? productDef.itemName : 'Unknown Product'),
                    totalStockInVehicle: 0,
                    sellingPrice: sellingPrice,
                    sourceDeliveryLogDetails: []
                };
            }
            aggregatedStock[log.productCode].totalStockInVehicle += log.stockInVehicle;
            aggregatedStock[log.productCode].sourceDeliveryLogDetails.push({
                deliveryLogId: log.deliveryLogId,
                stock: log.stockInVehicle,
                loadedAtTimestamp: log.loadedAtTimestamp
            });
        });

        for (const code in aggregatedStock) {
            aggregatedStock[code].sourceDeliveryLogDetails.sort((a,b) => (a.loadedAtTimestamp || 0) - (b.loadedAtTimestamp || 0));
        }

        productsAvailableInSelectedVehicle = Object.values(aggregatedStock).filter(p => p.totalStockInVehicle > 0);
        productsAvailableInSelectedVehicle.sort((a,b) => (a.productName || "").localeCompare(b.productName || ""));


        selectedDeliveryVehicleContext = {
            vehicleNumber: relevantLogs[0].vehicleNumber,
            driverName: relevantLogs[0].driverName,
        };

        if (selectedDeliveryInfoEl) {
             selectedDeliveryInfoEl.textContent = `Selected Vehicle: ${selectedDeliveryVehicleContext.vehicleNumber}, Driver: ${selectedDeliveryVehicleContext.driverName}. ${productsAvailableInSelectedVehicle.length} product(s) available.`;
             selectedDeliveryInfoEl.style.display = 'block';
        }

        if (addSaleItemButton) addSaleItemButton.disabled = productsAvailableInSelectedVehicle.length === 0;
        if (completeSaleButton) completeSaleButton.disabled = productsAvailableInSelectedVehicle.length === 0;

        if(saleItemsContainer) saleItemsContainer.innerHTML = '';
        updateAllProductDropdownsBasedOnVehicle();
        calculateTotals();

        if (productsAvailableInSelectedVehicle.length === 0) {
             if(selectedDeliveryInfoEl) selectedDeliveryInfoEl.textContent += " No items with stock found.";
        }
    }

    function updateAllProductDropdownsBasedOnVehicle() {
        document.querySelectorAll('.sale-item-product').forEach(selectElement => {
            const currentSelectedProductCode = selectElement.value;
            populateProductSelectFromVehicle(selectElement);
            if (productsAvailableInSelectedVehicle.some(p => p.productCode === currentSelectedProductCode)) {
                 selectElement.value = currentSelectedProductCode;
            } else {
                selectElement.value = "";
            }
            selectElement.dispatchEvent(new Event('change'));
        });
    }

    function populateProductSelectFromVehicle(selectElement) {
        if (!selectElement) return;
        let optionsHTML = '<option value="" data-price="0" data-stock="0" data-name="">-- Select Product from Vehicle --</option>';

        if (productsAvailableInSelectedVehicle.length > 0) {
            productsAvailableInSelectedVehicle.forEach(p => {
                const stock = p.totalStockInVehicle || 0;
                const disabled = stock <= 0 ? 'disabled' : '';
                const stockDisplay = stock <= 0 ? 'Out of Stock' : `Stock: ${stock}`;
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
        const itemRowDiv = document.createElement('div');
        itemRowDiv.classList.add('sale-item-row', 'form-grid');

        const productSelectDiv = document.createElement('div');
        productSelectDiv.classList.add('form-group');
        productSelectDiv.innerHTML = '<label class="form-label form-label-sm">Product (from Vehicle)</label>';
        const productSelect = document.createElement('select');
        productSelect.classList.add('form-input', 'sale-item-product');
        productSelect.required = true;
        populateProductSelectFromVehicle(productSelect);
        productSelectDiv.appendChild(productSelect);

        const qtyDiv = document.createElement('div');
        qtyDiv.classList.add('form-group');
        qtyDiv.innerHTML = '<label class="form-label form-label-sm">Qty</label>';
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = "1";
        qtyInput.classList.add('form-input', 'sale-item-qty');
        qtyInput.placeholder = 'Qty';
        qtyInput.required = true;
        qtyInput.value = "1";
        qtyDiv.appendChild(qtyInput);

        const priceDiv = document.createElement('div');
        priceDiv.classList.add('form-group');
        priceDiv.innerHTML = '<label class="form-label form-label-sm">Price/Unit</label>';
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.step = '0.01';
        priceInput.classList.add('form-input', 'sale-item-price');
        priceInput.placeholder = 'Price';
        priceInput.required = true;
        priceDiv.appendChild(priceInput);

        const lineTotalDiv = document.createElement('div');
        lineTotalDiv.classList.add('form-group', 'line-total-group');
        lineTotalDiv.innerHTML = '<label class="form-label form-label-sm">Line Total</label>';
        const lineTotalInput = document.createElement('input');
        lineTotalInput.type = 'text';
        lineTotalInput.classList.add('form-input', 'sale-item-linetotal');
        lineTotalInput.placeholder = 'Total';
        lineTotalInput.readOnly = true;
        lineTotalDiv.appendChild(lineTotalInput);

        const removeBtnDiv = document.createElement('div');
        removeBtnDiv.classList.add('form-group');
        removeBtnDiv.style.paddingTop = '1.5em';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm');
        removeBtn.title = "Remove Item";
        removeBtn.onclick = () => {
            itemRowDiv.remove();
            calculateTotals();
        };
        removeBtnDiv.appendChild(removeBtn);

        itemRowDiv.appendChild(productSelectDiv);
        itemRowDiv.appendChild(qtyDiv);
        itemRowDiv.appendChild(priceDiv);
        itemRowDiv.appendChild(lineTotalDiv);
        itemRowDiv.appendChild(removeBtnDiv);
        saleItemsContainer.appendChild(itemRowDiv);

        productSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption || !selectedOption.value) {
                priceInput.value = '';
                qtyInput.value = '1';
                qtyInput.max = '';
                calculateTotals();
                return;
            }
            priceInput.value = parseFloat(selectedOption.dataset.price || 0).toFixed(2);
            const maxStockInVehicle = parseInt(selectedOption.dataset.stock || 0);
            qtyInput.max = maxStockInVehicle;
            if (parseInt(qtyInput.value) > maxStockInVehicle || parseInt(qtyInput.value) <= 0) {
                qtyInput.value = maxStockInVehicle > 0 ? 1 : 0;
            }
            if (maxStockInVehicle === 0) {
                qtyInput.value = 0;
                if (selectedOption.dataset.name) alert(`"${selectedOption.dataset.name}" is out of stock in this vehicle.`);
            }
            calculateTotals();
        });

        qtyInput.addEventListener('input', calculateTotals);
        priceInput.addEventListener('input', calculateTotals);
        if (productSelect.value) {
            productSelect.dispatchEvent(new Event('change'));
        }
    }

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
                if (qtyInput) qtyInput.value = qty;
            }
            if (qty < 0) {
                qty = 0;
                if (qtyInput) qtyInput.value = qty;
            }

            const price = parseFloat(row.querySelector('.sale-item-price')?.value || 0);
            const lineTotalField = row.querySelector('.sale-item-linetotal');

            if (qty > 0 && price >= 0) {
                const itemNetTotal = qty * price;
                if (lineTotalField) lineTotalField.value = itemNetTotal.toFixed(2);
                currentSubTotal += itemNetTotal;
            } else {
                if (lineTotalField) lineTotalField.value = "0.00";
            }
        });
        if (subTotalInput) subTotalInput.value = currentSubTotal.toFixed(2);

        const directDiscountAmount = parseFloat(overallDiscountValueInput?.value || 0);
        const calculatedGrandTotal = currentSubTotal - directDiscountAmount;
        if (grandTotalInput) grandTotalInput.value = calculatedGrandTotal > 0 ? calculatedGrandTotal.toFixed(2) : "0.00";

        if (paymentMethodInput && paymentMethodInput.value === 'Installment') {
            calculateRemainingBalance();
        }
    }

    async function handleSaleFormSubmit(e) {
        e.preventDefault();
        if (!selectedDeliveryVehicleContext) {
            alert("Please select a delivery vehicle/driver before completing the sale.");
            return;
        }

        const saleDateVal = saleDateInput.value;
        let customerNameOriginal = customerNameInput.value.trim();
        let customerId = selectedCustomerIdInput.value;
        let customerNameToSave = customerNameOriginal;
        let finalCustomerCity = (customerCitySelect.value || newCityNameInput.value.trim());

        if (!saleDateVal || !customerNameOriginal || !finalCustomerCity) {
            alert("Please fill Sale Date, Customer City, and Customer Name.");
            return;
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
        
        document.querySelectorAll('.sale-item-row').forEach(row => {
            if (!allItemsValid) return;
            const productSelect = row.querySelector('.sale-item-product');
            if (!productSelect || !productSelect.value) return;

            const productCode = productSelect.value;
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            const itemName = selectedOption?.dataset.name;
            const stockInVehicleForThisProduct = parseInt(selectedOption?.dataset.stock || 0);
            let quantity = parseInt(row.querySelector('.sale-item-qty')?.value || 0);
            const unitPrice = parseFloat(row.querySelector('.sale-item-price')?.value || 0);

            if (quantity <= 0 ) { alert(`Quantity for ${itemName || 'selected item'} must be > 0.`); allItemsValid = false; return; }
            if (quantity > stockInVehicleForThisProduct) {
                alert(`Not enough stock for ${itemName}. Available: ${stockInVehicleForThisProduct}, Requested: ${quantity}.`);
                allItemsValid = false; return;
            }

            const productAggregatedInfo = productsAvailableInSelectedVehicle.find(p => p.productCode === productCode);
            if (!productAggregatedInfo) {
                alert(`Product ${productCode} not in vehicle context. Please re-select vehicle.`);
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

            if (quantityToDeductRemaining > 0) {
                alert(`Error allocating stock for ${itemName}. Please refresh.`);
                allItemsValid = false; return;
            }
            itemsToSave.push({ productCode, itemName, quantity, unitPrice, lineTotal: quantity * unitPrice, sourceLogDebits });
        });

        if (!allItemsValid) return;
        if (itemsToSave.length === 0) { alert("Please add at least one valid item to the sale."); return; }

        const enteredNormalizedName = normalizeName(customerNameOriginal);
        if (!customerId) {
            const existingCustomerInCity = customersCache.find( c => c.normalizedName === enteredNormalizedName && (c.city || '').toLowerCase() === finalCustomerCity.toLowerCase());
            if (existingCustomerInCity) {
                customerId = existingCustomerInCity.id;
                customerNameToSave = existingCustomerInCity.name;
            } else {
                try {
                    const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
                    customerId = newCustomerRef.key;
                    await newCustomerRef.set({ customerId, name: customerNameOriginal, normalizedName: enteredNormalizedName, city: finalCustomerCity, createdAt: firebase.database.ServerValue.TIMESTAMP });
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
            if (match && match[1]) currentCustomerPreviousDue = parseFloat(match[1].replace(/,/g, ''));
        }

        const saleEntry = {
            saleDate: saleDateVal, customerId, customerName: customerNameToSave, customerCity: finalCustomerCity,
            items: itemsToSave.map(item => ({ productCode: item.productCode, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })),
            sourceVehicleNumber: selectedDeliveryVehicleContext.vehicleNumber, sourceDriverName: selectedDeliveryVehicleContext.driverName,
            subTotal: parseFloat(subTotalInput.value), overallDiscountValue: parseFloat(overallDiscountValueInput.value) || 0,
            grandTotal: parseFloat(grandTotalInput.value), paymentMethod: paymentMethodInput.value,
            saleNotes: saleNotesInput.value.trim() || null, previousInstallmentDue: currentCustomerPreviousDue,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        if (saleEntry.paymentMethod === 'Installment') {
            saleEntry.amountPaid = parseFloat(amountPaidInput.value) || 0;
            saleEntry.remainingBalance = parseFloat(remainingBalanceInput.value) || 0;
            if (saleEntry.amountPaid > saleEntry.grandTotal && saleEntry.grandTotal > 0) { alert("Amount paid cannot exceed Grand Total."); return; }
            if (saleEntry.amountPaid < 0) { alert("Amount paid cannot be negative."); return; }
        }

        try {
            const transactionPromises = [];
            itemsToSave.forEach(item => {
                item.sourceLogDebits.forEach(debit => {
                    const logRef = db.ref(`${DELIVERY_LOGS_PATH}/${debit.deliveryLogId}`);
                    transactionPromises.push(logRef.transaction(currentLog => {
                        if (currentLog) {
                            currentLog.stockInVehicle = (currentLog.stockInVehicle || 0) - debit.qtyToDeduct;
                            currentLog.quantitySold = (currentLog.quantitySold || 0) + debit.qtyToDeduct;
                            return currentLog;
                        }
                        return currentLog;
                    }));
                });
                const productTotalSoldRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${item.productCode}/totalSold`);
                const productUpdatedAtRef = db.ref(`${DEFINED_PRODUCTS_PATH}/${item.productCode}/updatedAt`);
                transactionPromises.push(productTotalSoldRef.transaction(currentTotalSold => (currentTotalSold || 0) + item.quantity));
                transactionPromises.push(productUpdatedAtRef.set(firebase.database.ServerValue.TIMESTAMP));
            });

            await Promise.all(transactionPromises);

            const newSaleRef = db.ref(SALES_LOG_PATH).push();
            saleEntry.saleId = newSaleRef.key;
            await newSaleRef.set(saleEntry);

            alert(`Sale recorded! ID: ${saleEntry.saleId}`);
            await generateAndPrintReceipt(saleEntry);

            if(saleForm) saleForm.reset();
            if(saleItemsContainer) saleItemsContainer.innerHTML = '';
            if(saleDateInput) saleDateInput.valueAsDate = new Date();
            clearCustomerInput();
            clearDeliverySelection();
            await fetchDeliveryLogs();
            toggleCustomerNameInputState();
            handlePaymentMethodChange();
            calculateTotals();
            displayInstallmentDueMessage(0);

        } catch (error) {
            console.error("CRITICAL ERROR during sale processing:", error);
            alert(`Sale not recorded. An error occurred: ${error.message}.`);
            await fetchDeliveryLogs();
            if (selectedDeliveryVehicleContext) {
                confirmDeliveryVehicleSelection(selectedDeliveryVehicleContext.vehicleNumber, selectedDeliveryVehicleContext.driverName);
            }
        }
    }
    
    function renderSaleLogRow(saleKey, data) {
        const row = salesLogTableBody.insertRow();
        row.setAttribute('data-id', saleKey);
        row.insertCell().textContent = data.saleDate || '';
        const customerNameCell = row.insertCell();
        let customerNameDisplayText = data.customerName || 'N/A';
        if (data.customerId) {
            const customerLink = document.createElement('a');
          customerLink.href = `/public/customer_data.html?id=${data.customerId}`;
            customerLink.textContent = customerNameDisplayText;
            customerLink.classList.add('table-link');
            customerNameCell.appendChild(customerLink);
        } else {
            customerNameCell.textContent = customerNameDisplayText;
        }
        row.insertCell().textContent = data.customerCity || 'N/A';
        const itemsCell = row.insertCell();
        if (data.items && data.items.length > 0) {
            const ul = document.createElement('ul');
            ul.classList.add('material-list-display');
            data.items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.itemName || 'Item'} (Qty: ${item.quantity || 0} @ Rs. ${parseFloat(item.unitPrice || 0).toFixed(2)}/unit)`;
                ul.appendChild(li);
            });
            itemsCell.appendChild(ul);
        } else itemsCell.textContent = 'N/A';
        row.insertCell().textContent = `${data.sourceVehicleNumber || 'N/A'} (${data.sourceDriverName || 'N/A'})`;
        const totalCell = row.insertCell();
        totalCell.textContent = data.grandTotal ? parseFloat(data.grandTotal).toFixed(2) : '0.00';
        totalCell.classList.add('text-right');
        const paymentCell = row.insertCell();
        let paymentMethodText = data.paymentMethod || 'N/A';
        if (data.paymentMethod === 'Installment') {
            paymentMethodText += ` (Paid: ${parseFloat(data.amountPaid || 0).toFixed(2)}, Due: ${parseFloat(data.remainingBalance || 0).toFixed(2)})`;
        }
        paymentCell.textContent = paymentMethodText;
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button');
        invoiceBtn.innerHTML = '<i class="fas fa-receipt fa-fw"></i>';
        invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm');
        invoiceBtn.title = "View/Print Receipt";
        invoiceBtn.onclick = () => generateAndPrintReceipt(data);
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i>';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.title = "Delete Sale";
        deleteBtn.onclick = () => deleteSale(saleKey, data);
        actionsCell.appendChild(invoiceBtn);
        actionsCell.appendChild(deleteBtn);
    }

    function displayFilteredSales() {
        if (!salesLogTableBody) return;
        salesLogTableBody.innerHTML = '';
        const searchTerm = searchSalesInput ? searchSalesInput.value.toLowerCase().trim() : "";
        let salesDisplayed = 0;
        if (allSalesData && typeof allSalesData === 'object' && Object.keys(allSalesData).length > 0) {
            Object.keys(allSalesData).map(key => ({ id: key, ...allSalesData[key] }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .forEach(sale => {
                const customerNameMatches = sale.customerName?.toLowerCase().includes(searchTerm);
                const saleIdMatches = sale.saleId?.toLowerCase().includes(searchTerm);
                const cityMatches = sale.customerCity?.toLowerCase().includes(searchTerm);
                const vehicleMatches = sale.sourceVehicleNumber?.toLowerCase().includes(searchTerm);
                const driverMatches = sale.sourceDriverName?.toLowerCase().includes(searchTerm);
                if (!searchTerm || customerNameMatches || saleIdMatches || cityMatches || vehicleMatches || driverMatches) {
                    renderSaleLogRow(sale.id, sale);
                    salesDisplayed++;
                }
            });
        }
        if (noSalesHistoryText) {
            noSalesHistoryText.style.display = salesDisplayed === 0 ? 'block' : 'none';
            noSalesHistoryText.textContent = searchTerm ? 'No sales match your search.' : 'No sales recorded yet.';
        }
    }
    
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
    
    function listenForProductUpdates() {
        db.ref(DEFINED_PRODUCTS_PATH).on('value', snapshot => {
            definedProductsCache = [];
            if(snapshot.exists()){
                snapshot.forEach(child => definedProductsCache.push({id: child.key, ...child.val()}));
            }
        });
    }

    async function fetchCitiesAndPopulateDropdown() {
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
                        city: child.val().city || ""
                    });
                });
            }
        } catch (error) { console.error("Error fetching customers:", error); }
    }

    function normalizeName(name) {
        if (typeof name !== 'string') return "";
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_');
    }

    function handleCityChange() {
        if (customerCitySelect && customerCitySelect.value) {
            if (newCityNameInput) newCityNameInput.value = '';
            if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customerCitySelect.value;
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
        displayInstallmentDueMessage(0);
    }

    function handleNewCityInput() {
        if (newCityNameInput && newCityNameInput.value.trim()) {
            if (customerCitySelect) customerCitySelect.value = '';
        }
        clearCustomerInput();
        toggleCustomerNameInputState();
        displayInstallmentDueMessage(0);
    }

    function clearCustomerInput(){
        if(customerNameInput) customerNameInput.value = '';
        if(customerSuggestionsListEl) customerSuggestionsListEl.innerHTML = '';
        if(selectedCustomerIdInput) selectedCustomerIdInput.value = '';
        displayInstallmentDueMessage(0);
    }

    function toggleCustomerNameInputState() {
        const citySelected = customerCitySelect && customerCitySelect.value;
        const newCityEntered = newCityNameInput && newCityNameInput.value.trim();
        if (customerNameInput) {
            const isDisabled = !(citySelected || newCityEntered);
            customerNameInput.disabled = isDisabled;
            customerNameInput.placeholder = isDisabled ? "Select/Enter route first..." : "Type customer name...";
            if (isDisabled) clearCustomerInput();
        }
    }

    function handleCustomerNameInput() {
        const searchTerm = customerNameInput.value.toLowerCase();
        customerSuggestionsListEl.innerHTML = '';
        selectedCustomerIdInput.value = '';
        displayInstallmentDueMessage(0);

        const currentCityValue = (customerCitySelect.value || newCityNameInput.value.trim());
        const selectedCityNormalized = currentCityValue.toLowerCase();

        if (!selectedCityNormalized && searchTerm.length > 0) {
            customerSuggestionsListEl.innerHTML = '<li>Select or enter a city first.</li>';
            customerSuggestionsListEl.style.display = 'block';
            return;
        }
        if (searchTerm.length < 1) {
            customerSuggestionsListEl.style.display = 'none';
            return;
        }

        const filteredCustomers = customersCache.filter(customer => {
            const customerCityLower = (customer.city || '').toLowerCase();
            const cityMatch = customerCityLower === selectedCityNormalized;
            const nameMatch = customer.name && customer.name.toLowerCase().includes(searchTerm);
            return cityMatch && nameMatch;
        }).slice(0, 5);

        if (filteredCustomers.length > 0) {
            const ul = document.createElement('ul');
            filteredCustomers.forEach(customer => {
                const li = document.createElement('li');
                li.textContent = `${customer.name} (${customer.city || 'N/A'})`;
                li.addEventListener('click', () => {
                    customerNameInput.value = customer.name;
                    selectedCustomerIdInput.value = customer.id;
                    if (selectedCustomerCityNameInput) selectedCustomerCityNameInput.value = customer.city;

                    if (customerCitySelect && customer.city && citiesCache.some(c => c.name === customer.city)) {
                        customerCitySelect.value = customer.city;
                        if (newCityNameInput) newCityNameInput.value = '';
                    } else if (newCityNameInput && customer.city) {
                        newCityNameInput.value = customer.city;
                        if (customerCitySelect) customerCitySelect.value = '';
                    }
                    customerSuggestionsListEl.style.display = 'none';
                    customerSuggestionsListEl.innerHTML = '';
                    checkCustomerInstallmentStatus();
                });
                ul.appendChild(li);
            });
            customerSuggestionsListEl.appendChild(ul);
            customerSuggestionsListEl.style.display = 'block';
        } else {
            customerSuggestionsListEl.innerHTML = `<li>No customers matching "${customerNameInput.value}" in ${currentCityValue}. Type full name to add.</li>`;
            customerSuggestionsListEl.style.display = 'block';
        }
    }

    async function checkCustomerInstallmentStatus() {
        const customerId = selectedCustomerIdInput.value;
        if (!customerId) {
            displayInstallmentDueMessage(0);
            return;
        }

        try {
            const snapshot = await db.ref(SALES_LOG_PATH).orderByChild('customerId').equalTo(customerId).once('value');
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
            displayInstallmentDueMessage(0);
        }
    }

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

    function handlePaymentMethodChange() {
        if (!paymentMethodInput || !installmentFieldsContainer) return;
        if (paymentMethodInput.value === 'Installment') {
            installmentFieldsContainer.style.display = 'grid';
            calculateRemainingBalance();
        } else {
            installmentFieldsContainer.style.display = 'none';
            if (amountPaidInput) amountPaidInput.value = '0';
            if (remainingBalanceInput) remainingBalanceInput.value = '0.00';
        }
    }

    function calculateRemainingBalanceAndUpdateTotals() {
        calculateTotals();
    }

    function calculateRemainingBalance() {
        if (!grandTotalInput || !amountPaidInput || !remainingBalanceInput) return;
        const grandTotal = parseFloat(grandTotalInput.value) || 0;
        const paidAmount = parseFloat(amountPaidInput.value) || 0;
        const balance = grandTotal - paidAmount;
        remainingBalanceInput.value = balance.toFixed(2);
    }

    function loadSalesLog() {
        const logRef = db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(200);
        logRef.on('value', snapshot => {
            allSalesData = snapshot.exists() ? snapshot.val() : {};
            displayFilteredSales();
        }, error => {
            console.error("Error listening to sales log:", error);
            allSalesData = {};
            displayFilteredSales();
        });
    }

    async function deleteSale(saleId, saleData) {
        if (!saleId) return;
        const confirmationMessage = `DELETE Sale ID: ${saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : saleId.slice(-6).toUpperCase()} for "${saleData.customerName}"?\n
        !!! CRITICAL WARNING !!!
        This action is IRREVERSIBLE and WILL NOT automatically revert stock levels. This can lead to data inconsistency.
        Are you absolutely sure you want to proceed?`;

        if (confirm(confirmationMessage)) {
            try {
                console.warn("Manual reversal of stock is REQUIRED for deleted sale ID:", saleId);
                await db.ref(`${SALES_LOG_PATH}/${saleId}`).remove();
                alert("Sale log entry deleted. REMEMBER TO MANUALLY ADJUST STOCK.");
            } catch (error) {
                console.error(`Error deleting sale ${saleId}:`, error);
                alert("Error deleting sale log entry.");
            }
        }
    }

    
    initializeSalesPage();
});