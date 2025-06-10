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
    const storage = firebase.storage();
    const { jsPDF } = window.jspdf;

    // --- Navbar ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    const pageTitleEl = document.getElementById('pageTitle');
    const customerCardTitleEl = document.getElementById('customerCardTitle');
    const customerIdDisplayEl = document.getElementById('customerIdDisplay');
    const customerCityDisplayEl = document.getElementById('customerCityDisplay');
    const customerDateJoinedEl = document.getElementById('customerDateJoined');
    const customerTotalSpentEl = document.getElementById('customerTotalSpent');
    const customerDetailsForm = document.getElementById('customerDetailsForm');
    const customerNameInput = document.getElementById('customerNameInput');
    const profilePicPreviewEl = document.getElementById('profilePicPreview');
    const profilePicInputEl = document.getElementById('profilePicInput');
    const uploadStatusEl = document.getElementById('uploadStatus');
    const phoneNumbersContainerEl = document.getElementById('phoneNumbersContainer');
    const addPhoneNumberBtn = document.getElementById('addPhoneNumberBtn');
    const addressTextInputEl = document.getElementById('addressTextInput');
    const googleMapsLinkInputEl = document.getElementById('googleMapsLinkInput');
    const saveCustomerDetailsBtn = document.getElementById('saveCustomerDetailsBtn');
    const adminNotesDisplayEl = document.getElementById('adminNotesDisplay');
    const adminNotesInputEl = document.getElementById('adminNotesInput');
    const saveAdminNotesBtn = document.getElementById('saveAdminNotesBtn');
    const customerSalesTableBodyEl = document.getElementById('customerSalesTableBody');
    const customerInstallmentsTableBodyEl = document.getElementById('customerInstallmentsTableBody');
    const noInstallmentsMessageEl = document.getElementById('noInstallmentsMessage');
    const customerDetailContainerEl = document.getElementById('customerDetailContainer');
    const loadingIndicatorEl = document.getElementById('loadingIndicator');
    const errorDisplayEl = document.getElementById('errorDisplay');

    // Balance Settlement Elements
    const balanceSettlementContainer = document.getElementById('balanceSettlementContainer');
    const totalBalanceDisplay = document.getElementById('totalBalanceDisplay');
    const settleBalanceForm = document.getElementById('settleBalanceForm');
    const settlementAmountInput = document.getElementById('settlementAmountInput');
    const settlementPaymentMethod = document.getElementById('settlementPaymentMethod');
    const settleBalanceBtn = document.getElementById('settleBalanceBtn');

    // --- Firebase Paths & State ---
    const CUSTOMERS_PATH = 'customers';
    const SALES_LOG_PATH = 'salesLog';
    let currentCustomerId = null;
    let currentCustomerData = null;
    let currentProfilePicFile = null;

    // --- Initialization ---
    function getCustomerIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async function initializePage() {
        const idFromUrl = getCustomerIdFromUrl();
        if (idFromUrl) {
            await loadCustomerDetails(idFromUrl);
            if (settleBalanceForm) {
                settleBalanceForm.addEventListener('submit', handleSettleBalance);
            }
        } else {
            showError("No Customer ID specified. Please select a customer from the list.");
            if (pageTitleEl) pageTitleEl.textContent = "Invalid Customer";
        }
    }

    async function loadCustomerDetails(idFromUrl) {
        if (!idFromUrl) {
            showError("No customer ID provided.");
            return;
        }
        loadingIndicatorEl.classList.remove('hidden');
        customerDetailContainerEl.classList.add('hidden');
        errorDisplayEl.classList.add('hidden');

        try {
            const query = db.ref(CUSTOMERS_PATH).orderByChild('customerId').equalTo(idFromUrl);
            let snapshot = await query.once('value');
            let customerFound = false;

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    if (!customerFound) {
                        currentCustomerId = childSnapshot.key;
                        currentCustomerData = childSnapshot.val();
                        customerFound = true;
                    }
                });
            }

            if (!customerFound) {
                const directSnapshot = await db.ref(`${CUSTOMERS_PATH}/${idFromUrl}`).once('value');
                if (directSnapshot.exists()) {
                    currentCustomerId = directSnapshot.key;
                    currentCustomerData = directSnapshot.val();
                    customerFound = true;
                }
            }

            if (customerFound) {
                displayCustomerInfo(currentCustomerId, currentCustomerData);
                loadAdminNotes(currentCustomerData.adminNotes);
                loadCustomerSalesAndInstallmentHistory(currentCustomerId);
                customerDetailContainerEl.classList.remove('hidden');
            } else {
                showError("Customer not found.");
            }

        } catch (error) {
            console.error("Error fetching customer details:", error);
            showError("Error loading customer data.");
        } finally {
            if (loadingIndicatorEl) loadingIndicatorEl.classList.add('hidden');
        }
    }

    function loadCustomerSalesAndInstallmentHistory(customerId) {
        const salesRef = db.ref(SALES_LOG_PATH).orderByChild('customerId').equalTo(customerId);
        salesRef.off('value'); 

        salesRef.on('value', snapshot => {
            if (!customerSalesTableBodyEl || !customerInstallmentsTableBodyEl) return;
            
            customerSalesTableBodyEl.innerHTML = '';
            customerInstallmentsTableBodyEl.innerHTML = '';
            let totalSpent = 0;
            let totalRemainingBalance = 0;
            let hasInstallments = false;
            const salesEntries = [];

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const sale = { id: childSnapshot.key, ...childSnapshot.val() };
                    if (sale.type !== 'settlement') {
                        salesEntries.push(sale);
                    }
                });

                salesEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                salesEntries.forEach(sale => {
                    renderSaleRowForCustomer(sale);
                    totalSpent += parseFloat(sale.grandTotal) || 0;
                    if (sale.paymentMethod === 'Installment') {
                        hasInstallments = true;
                        renderInstallmentRowForCustomer(sale);
                        totalRemainingBalance += parseFloat(sale.remainingBalance || 0);
                    }
                });
            }

            if (customerSalesTableBodyEl.innerHTML === '') {
                const row = customerSalesTableBodyEl.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 5;
                cell.textContent = 'No sales history for this customer.';
                cell.classList.add('text-center', 'p-4');
            }
            if (noInstallmentsMessageEl) noInstallmentsMessageEl.classList.toggle('hidden', hasInstallments);
            if (customerTotalSpentEl) customerTotalSpentEl.textContent = `Rs. ${totalSpent.toFixed(2)}`;
            
            if (totalBalanceDisplay) totalBalanceDisplay.textContent = `Rs. ${totalRemainingBalance.toFixed(2)}`;
            if (settlementAmountInput) settlementAmountInput.value = totalRemainingBalance > 0 ? totalRemainingBalance.toFixed(2) : '';
            if (balanceSettlementContainer) balanceSettlementContainer.classList.toggle('hidden', totalRemainingBalance <= 0);
            if (settleBalanceBtn) settleBalanceBtn.disabled = totalRemainingBalance <= 0;

        }, errorObject => {
            console.error(`Error fetching sales history for customer ${customerId}:`, errorObject);
        });
    }

    async function handleSettleBalance(e) {
        e.preventDefault();
        const amountToSettle = parseFloat(settlementAmountInput.value);
        const paymentMethod = settlementPaymentMethod.value;

        if (!amountToSettle || amountToSettle <= 0) {
            alert("Settlement amount must be greater than zero.");
            return;
        }
        
        const salesSnapshot = await db.ref(SALES_LOG_PATH).orderByChild('customerId').equalTo(currentCustomerId).once('value');
        const openInstallments = [];
        if (salesSnapshot.exists()) {
            salesSnapshot.forEach(child => {
                const sale = { id: child.key, ...child.val() };
                if (sale.paymentMethod === 'Installment' && (sale.remainingBalance || 0) > 0) {
                    openInstallments.push(sale);
                }
            });
        }
        
        const totalDue = openInstallments.reduce((acc, sale) => acc + sale.remainingBalance, 0);
        if (amountToSettle > totalDue) {
            alert(`Amount exceeds total due of Rs. ${totalDue.toFixed(2)}.`);
            return;
        }

        if (confirm(`Are you sure you want to settle a balance of Rs. ${amountToSettle.toFixed(2)} for this customer?`)) {
            settleBalanceBtn.disabled = true;
            settleBalanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            try {
                if (openInstallments.length === 0) {
                    throw new Error("No open installments found to settle.");
                }

                const updates = {};
                let paymentToApply = amountToSettle;
                openInstallments.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));

                for(const sale of openInstallments) {
                    if (paymentToApply <= 0) break;
                    const paymentForThisSale = Math.min(paymentToApply, sale.remainingBalance);
                    updates[`${SALES_LOG_PATH}/${sale.id}/amountPaid`] = (sale.amountPaid || 0) + paymentForThisSale;
                    updates[`${SALES_LOG_PATH}/${sale.id}/remainingBalance`] = sale.remainingBalance - paymentForThisSale;
                    paymentToApply -= paymentForThisSale;
                }

                const newSettlementRef = db.ref(SALES_LOG_PATH).push();
                const settlementRecord = {
                    type: 'settlement',
                    saleId: newSettlementRef.key, // Ensure the new key is part of the record
                    customerId: currentCustomerId,
                    customerName: currentCustomerData.name,
                    customerCity: currentCustomerData.city,
                    saleDate: new Date().toISOString().slice(0, 10),
                    items: [{
                        itemName: 'Balance Settlement Payment',
                        quantity: 1,
                        lineTotal: amountToSettle,
                        unitPrice: amountToSettle
                    }],
                    paymentMethod: paymentMethod,
                    grandTotal: amountToSettle,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                updates[`${SALES_LOG_PATH}/${newSettlementRef.key}`] = settlementRecord;

                await db.ref().update(updates);
                
                // This call is now correct and passes the complete settlement record
                await generateSettlementReceipt(settlementRecord);
                alert("Balance settled successfully!");

            } catch (error) {
                console.error("Error settling balance:", error);
                alert("An error occurred during settlement: " + error.message);
            } finally {
                settleBalanceBtn.disabled = false;
                settleBalanceBtn.innerHTML = '<i class="fas fa-check-circle fa-fw"></i> Settle Balance';
            }
        }
    }
    
    // --- Other Display & Helper Functions ---

    function showError(message) {
        if (errorDisplayEl) { errorDisplayEl.innerHTML = `<p><i class="fas fa-exclamation-triangle"></i> ${message}</p>`; errorDisplayEl.classList.remove('hidden'); }
        if (loadingIndicatorEl) loadingIndicatorEl.classList.add('hidden');
        if (customerDetailContainerEl) customerDetailContainerEl.classList.add('hidden');
    }

    function displayCustomerInfo(customerId, data) {
        if (pageTitleEl) pageTitleEl.innerHTML = `<i class="fas fa-user-tie fa-fw"></i> Customer: ${data.name || 'N/A'}`;
        if (customerCardTitleEl) customerCardTitleEl.textContent = data.name || 'N/A';
        if (customerNameInput) customerNameInput.value = data.name || '';
        if (customerIdDisplayEl) customerIdDisplayEl.textContent = data.customerId || customerId;
        if (customerCityDisplayEl) customerCityDisplayEl.textContent = data.city || 'N/A';
        if (customerDateJoinedEl) customerDateJoinedEl.textContent = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';
        if (profilePicPreviewEl) profilePicPreviewEl.src = data.profilePicUrl || 'customer.png';
        if (addressTextInputEl) addressTextInputEl.value = data.addressText || '';
        if (googleMapsLinkInputEl) googleMapsLinkInputEl.value = data.googleMapsLink || '';
        if (phoneNumbersContainerEl) {
            phoneNumbersContainerEl.innerHTML = '';
            if (data.phoneNumbers && Array.isArray(data.phoneNumbers) && data.phoneNumbers.length > 0) {
                data.phoneNumbers.forEach(phone => addPhoneNumberField(phone.type, phone.number));
            } else {
                addPhoneNumberField();
            }
        }
    }

    function addPhoneNumberField(type = 'Mobile', number = '') {
        if (!phoneNumbersContainerEl) return;
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('phone-number-entry');
        const typeSelect = document.createElement('select');
        typeSelect.classList.add('form-input', 'phone-type');
        ['Mobile', 'Home', 'Work', 'Other'].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === type) option.selected = true;
            typeSelect.appendChild(option);
        });
        const numberInput = document.createElement('input');
        numberInput.type = 'tel';
        numberInput.classList.add('form-input', 'phone-number');
        numberInput.placeholder = 'Phone Number';
        numberInput.value = number;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm');
        removeBtn.title = "Remove Phone";
        removeBtn.onclick = () => entryDiv.remove();
        entryDiv.appendChild(typeSelect);
        entryDiv.appendChild(numberInput);
        entryDiv.appendChild(removeBtn);
        phoneNumbersContainerEl.appendChild(entryDiv);
    }

    if (addPhoneNumberBtn) addPhoneNumberBtn.addEventListener('click', () => addPhoneNumberField());
    
    if (profilePicInputEl) {
        profilePicInputEl.addEventListener('change', (e) => {
            currentProfilePicFile = e.target.files[0];
            if (currentProfilePicFile && profilePicPreviewEl) {
                const reader = new FileReader();
                reader.onload = (event) => { profilePicPreviewEl.src = event.target.result; };
                reader.readAsDataURL(currentProfilePicFile);
                if (uploadStatusEl) uploadStatusEl.textContent = 'Image selected. Click "Save Details" to upload.';
            } else if (uploadStatusEl) {
                uploadStatusEl.textContent = '';
            }
        });
    }

    if (customerDetailsForm) {
        customerDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId || !customerNameInput) { alert("Cannot save, customer ID is missing."); return; }
            if (uploadStatusEl) uploadStatusEl.textContent = 'Saving...';
            if (saveCustomerDetailsBtn) { saveCustomerDetailsBtn.disabled = true; saveCustomerDetailsBtn.innerHTML = '<i class="fas fa-spinner fa-spin fa-fw"></i> Saving...'; }

            let profilePicUrlToSave = (await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}/profilePicUrl`).once('value')).val() || null;
            if (currentProfilePicFile) {
                if (uploadStatusEl) uploadStatusEl.textContent = 'Uploading picture...';
                const filePath = `customerProfilePictures/${currentCustomerId}/${Date.now()}_${currentProfilePicFile.name}`;
                const storageRef = storage.ref(filePath);
                try {
                    const uploadTask = await storageRef.put(currentProfilePicFile);
                    profilePicUrlToSave = await uploadTask.ref.getDownloadURL();
                    if (uploadStatusEl) uploadStatusEl.textContent = 'Picture uploaded!';
                    currentProfilePicFile = null;
                } catch (error) {
                    console.error("Error uploading profile picture:", error);
                    if (uploadStatusEl) uploadStatusEl.textContent = 'Picture upload failed.';
                }
            }

            const phoneNumbers = [];
            if (phoneNumbersContainerEl) {
                phoneNumbersContainerEl.querySelectorAll('.phone-number-entry').forEach(entry => {
                    const type = entry.querySelector('.phone-type').value;
                    const number = entry.querySelector('.phone-number').value.trim();
                    if (number) phoneNumbers.push({ type, number });
                });
            }

            const customerUpdateData = {
                name: customerNameInput.value.trim(),
                normalizedName: normalizeName(customerNameInput.value.trim()),
                phoneNumbers: phoneNumbers,
                addressText: addressTextInputEl.value.trim() || null,
                googleMapsLink: googleMapsLinkInputEl.value.trim() || null,
                profilePicUrl: profilePicUrlToSave,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            try {
                await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}`).update(customerUpdateData);
                alert("Customer details updated successfully!");
                if (uploadStatusEl) uploadStatusEl.textContent = 'Details saved.';
                if (pageTitleEl) pageTitleEl.innerHTML = `<i class="fas fa-user-tie fa-fw"></i> Customer: ${customerNameInput.value.trim()}`;
            } catch (error) {
                console.error("Error updating customer details:", error);
                alert("Failed to update customer details.");
                if (uploadStatusEl) uploadStatusEl.textContent = 'Save failed.';
            } finally {
                if (saveCustomerDetailsBtn) { saveCustomerDetailsBtn.disabled = false; saveCustomerDetailsBtn.innerHTML = '<i class="fas fa-save fa-fw"></i> Save Customer Details'; }
            }
        });
    }

    function normalizeName(name) {
        if (typeof name !== 'string') { return ""; }
        return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.#$[\]]/g, '_');
    }

    function loadAdminNotes(notes) {
        if (adminNotesDisplayEl && adminNotesInputEl) {
            adminNotesDisplayEl.innerHTML = notes ? `<p>${notes.replace(/\n/g, '<br>')}</p>` : '<p class="text-muted">No notes yet.</p>';
            adminNotesInputEl.value = notes || '';
        }
    }

    if (saveAdminNotesBtn) {
        saveAdminNotesBtn.addEventListener('click', async () => {
            if (!currentCustomerId || !adminNotesInputEl) { alert("Customer ID missing."); return; }
            const notesToSave = adminNotesInputEl.value.trim();
            try {
                await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}/adminNotes`).set(notesToSave || null);
                loadAdminNotes(notesToSave);
                alert("Admin notes saved!");
            } catch (error) { console.error("Error saving admin notes:", error); alert("Failed to save notes."); }
        });
    }

    function renderSaleRowForCustomer(saleData) {
        if (!customerSalesTableBodyEl) return;
        const row = customerSalesTableBodyEl.insertRow();
        row.setAttribute('data-id', saleData.id || saleData.saleId);
        row.insertCell().textContent = saleData.saleDate || 'N/A';
        row.insertCell().textContent = saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : 'N/A';
        const totalCell = row.insertCell();
        totalCell.textContent = saleData.grandTotal ? parseFloat(saleData.grandTotal).toFixed(2) : '0.00';
        totalCell.classList.add('text-right');
        let paymentMethodDisplay = saleData.paymentMethod || 'N/A';
        if (saleData.paymentMethod === 'Installment') {
            paymentMethodDisplay += (saleData.remainingBalance <= 0) ? ' (Paid Off)' : ' (Ongoing)';
        }
        row.insertCell().textContent = paymentMethodDisplay;
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button');
        invoiceBtn.innerHTML = '<i class="fas fa-receipt fa-fw"></i> View';
        invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm');
        invoiceBtn.onclick = () => generateAndPrintReceipt(saleData);
        actionsCell.appendChild(invoiceBtn);
    }

    function renderInstallmentRowForCustomer(saleData) {
        if (!customerInstallmentsTableBodyEl) return;
        const row = customerInstallmentsTableBodyEl.insertRow();
        row.setAttribute('data-id', saleData.id || saleData.saleId);
        row.insertCell().textContent = saleData.saleDate || 'N/A';
        row.insertCell().textContent = saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : 'N/A';
        const totalAmountCell = row.insertCell();
        totalAmountCell.textContent = saleData.grandTotal ? parseFloat(saleData.grandTotal).toFixed(2) : '0.00';
        totalAmountCell.classList.add('text-right');
        const paidAmountCell = row.insertCell();
        paidAmountCell.textContent = saleData.amountPaid ? parseFloat(saleData.amountPaid).toFixed(2) : '0.00';
        paidAmountCell.classList.add('text-right');
        const remainingAmountCell = row.insertCell();
        remainingAmountCell.textContent = saleData.remainingBalance ? parseFloat(saleData.remainingBalance).toFixed(2) : '0.00';
        remainingAmountCell.classList.add('text-right');
        const statusCell = row.insertCell();
        const remaining = parseFloat(saleData.remainingBalance || 0);
        if (remaining <= 0) {
            statusCell.textContent = 'Fully Paid';
            statusCell.classList.add('text-success', 'font-weight-bold');
        } else {
            statusCell.textContent = 'Partially Paid';
            statusCell.classList.add('text-warning');
        }
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button');
        invoiceBtn.innerHTML = '<i class="fas fa-receipt fa-fw"></i> View';
        invoiceBtn.classList.add('btn', 'btn-info', 'btn-sm');
        invoiceBtn.onclick = () => generateAndPrintReceipt(saleData);
        actionsCell.appendChild(invoiceBtn);
    }


    // --- [UPDATED] RECEIPT GENERATION FUNCTIONS ---

    /**
     * Generates and prints a sales receipt with the new Amee Store branding.
     * @param {object} saleData - The data for the sale.
     */
    async function generateAndPrintReceipt(saleData) {
        try {
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
            doc.text(`Customer: ${saleData.customerName || 'N/A'}`, MARGIN_LEFT, currentY);
            currentY += 6;
    
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
    
            drawLine(currentY);
            currentY += 5;
    
            doc.setFontSize(FONT_SIZE_TOTAL);
            doc.setFont(undefined, 'bold');
            const finalTotalToBePaid = (saleData.remainingBalance || 0) + (saleData.previousInstallmentDue || 0);
            doc.text('TOTAL DUE', MARGIN_LEFT, currentY);
            rightAlignedText(finalTotalToBePaid.toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 7;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(FONT_SIZE_NORMAL);
            doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, MARGIN_LEFT, currentY);
            currentY += 9;
    
            centerText('Thank You for shopping with us!', currentY);
            currentY += 5;
            centerText('Generated: ' + new Date().toLocaleDateString(), currentY);
    
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
    
        } catch (error) {
            console.error("Error generating PDF receipt:", error);
            alert("Could not generate the PDF receipt.");
        }
    }
    
    /**
     * Generates and prints a settlement receipt with the new Amee Store branding.
     * @param {object} settlementData - The data for the settlement.
     */
    async function generateSettlementReceipt(settlementData) {
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 297] });
    
            const FONT_SIZE_NORMAL = 8;
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
    
            doc.setFont(undefined, 'bold');
            centerText('SETTLEMENT RECEIPT', currentY);
            currentY += 6;
            doc.setFont(undefined, 'normal');
    
            drawLine(currentY);
            currentY += 5;
    
            doc.text(`Date: ${settlementData.saleDate || ''}`, MARGIN_LEFT, currentY);
            rightAlignedText(`Receipt No: ${settlementData.saleId.slice(-6).toUpperCase()}`, MARGIN_RIGHT, currentY);
            currentY += 5;
            doc.text(`Customer: ${settlementData.customerName || 'N/A'}`, MARGIN_LEFT, currentY);
            currentY += 6;
    
            drawLine(currentY);
            currentY += 5;
    
            doc.setFont(undefined, 'bold');
            doc.text('Description', MARGIN_LEFT, currentY);
            rightAlignedText('Amount (Rs.)', MARGIN_RIGHT, currentY);
            currentY += 5;
            
            // This now correctly uses a fixed string for the description
            doc.setFont(undefined, 'normal');
            doc.text('Outstanding Balance Settlement', MARGIN_LEFT, currentY);
            rightAlignedText(parseFloat(settlementData.grandTotal || 0).toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 6;
            
            drawLine(currentY);
            currentY += 6;
            
            doc.setFontSize(FONT_SIZE_TOTAL);
            doc.setFont(undefined, 'bold');
            doc.text('TOTAL PAID', MARGIN_LEFT, currentY);
            rightAlignedText(parseFloat(settlementData.grandTotal || 0).toFixed(2), MARGIN_RIGHT, currentY);
            currentY += 7;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(FONT_SIZE_NORMAL);
            doc.text(`Payment Method: ${settlementData.paymentMethod || 'N/A'}`, MARGIN_LEFT, currentY);
            currentY += 10;
            
            centerText('Thank You!', currentY);
            currentY += 5;
            centerText('Generated: ' + new Date().toLocaleDateString(), currentY);
    
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
    
        } catch (error) {
            console.error("Error generating PDF settlement receipt:", error);
            alert("Could not generate the PDF settlement receipt.");
        }
    }
    
    // Initialize the page
    initializePage();
});