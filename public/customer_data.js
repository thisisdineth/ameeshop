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
    const storage = firebase.storage();
    const { jsPDF } = window.jspdf;

    // --- Navbar (example, ensure it matches your actual navbar logic if separate) ---
    const mobileMenuButton = document.getElementById('mobile-menu-button'); // Assuming these might exist
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    const pageTitleEl = document.getElementById('pageTitle');
    const customerCardTitleEl = document.getElementById('customerCardTitle');
    const customerIdDisplayEl = document.getElementById('customerIdDisplay');
    const customerCityDisplayEl = document.getElementById('customerCityDisplay'); // New
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
    const customerInstallmentsTableBodyEl = document.getElementById('customerInstallmentsTableBody'); // New
    const noInstallmentsMessageEl = document.getElementById('noInstallmentsMessage'); // New
    
    const customerDetailContainerEl = document.getElementById('customerDetailContainer');
    const loadingIndicatorEl = document.getElementById('loadingIndicator');
    const errorDisplayEl = document.getElementById('errorDisplay');

    const CUSTOMERS_PATH = 'customers';
    const SALES_LOG_PATH = 'salesLog';

    let currentCustomerId = null;
    let currentProfilePicFile = null;

    function getCustomerIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async function loadCustomerDetails(customerId) {
        if (!customerId) { showError("No customer ID provided in URL."); return; }
        // Expanded check for critical elements
        if (!pageTitleEl || !customerCardTitleEl || !customerIdDisplayEl || !customerCityDisplayEl || 
            !customerDateJoinedEl || !customerNameInput || !profilePicPreviewEl || 
            !addressTextInputEl || !googleMapsLinkInputEl || !phoneNumbersContainerEl || 
            !adminNotesInputEl || !adminNotesDisplayEl || !customerSalesTableBodyEl || 
            !customerInstallmentsTableBodyEl || !noInstallmentsMessageEl || !customerTotalSpentEl) {
            console.error("One or more critical HTML elements for customer data are missing.");
            showError("Page structure error. Cannot display details."); return;
        }

        loadingIndicatorEl.classList.remove('hidden');
        customerDetailContainerEl.classList.add('hidden');
        errorDisplayEl.classList.add('hidden');

        const customerRef = db.ref(`${CUSTOMERS_PATH}/${customerId}`);
        try {
            const snapshot = await customerRef.once('value');
            if (snapshot.exists()) {
                const customerData = snapshot.val();
                displayCustomerInfo(customerId, customerData);
                loadAdminNotes(customerData.adminNotes);
                loadCustomerSalesAndInstallmentHistory(customerId); // Unified function
                customerDetailContainerEl.classList.remove('hidden');
            } else { showError("Customer not found."); }
        } catch (error) {
            console.error("Error fetching customer details:", error);
            showError("Error loading customer data.");
        } finally {
            if(loadingIndicatorEl) loadingIndicatorEl.classList.add('hidden');
        }
    }
    
    function showError(message) {
        if (errorDisplayEl) { errorDisplayEl.innerHTML = `<p><i class="fas fa-exclamation-triangle"></i> ${message}</p>`; errorDisplayEl.classList.remove('hidden'); }
        if (loadingIndicatorEl) loadingIndicatorEl.classList.add('hidden');
        if (customerDetailContainerEl) customerDetailContainerEl.classList.add('hidden');
    }

    function displayCustomerInfo(customerId, data) {
        if(pageTitleEl) pageTitleEl.innerHTML = `<i class="fas fa-user-tie fa-fw"></i> Customer: ${data.name || 'N/A'}`;
        if(customerCardTitleEl) customerCardTitleEl.textContent = data.name || 'N/A';
        if(customerNameInput) customerNameInput.value = data.name || '';
        if(customerIdDisplayEl) customerIdDisplayEl.textContent = data.customerId || customerId;
        if(customerCityDisplayEl) customerCityDisplayEl.textContent = data.city || 'N/A'; // Display city
        if(customerDateJoinedEl) customerDateJoinedEl.textContent = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A';
        if(profilePicPreviewEl) profilePicPreviewEl.src = data.profilePicUrl || 'customer.png'; // Default placeholder
        if(addressTextInputEl) addressTextInputEl.value = data.addressText || '';
        if(googleMapsLinkInputEl) googleMapsLinkInputEl.value = data.googleMapsLink || '';
        
        if(phoneNumbersContainerEl) phoneNumbersContainerEl.innerHTML = ''; // Clear existing before adding
        if (data.phoneNumbers && Array.isArray(data.phoneNumbers) && data.phoneNumbers.length > 0) {
            data.phoneNumbers.forEach(phone => addPhoneNumberField(phone.type, phone.number));
        } else if (phoneNumbersContainerEl) { // Add one empty field if none exist
            addPhoneNumberField(); 
        }
    }

    function addPhoneNumberField(type = 'Mobile', number = '') {
        if (!phoneNumbersContainerEl) return;
        const entryDiv = document.createElement('div'); entryDiv.classList.add('phone-number-entry');
        
        const typeSelect = document.createElement('select'); typeSelect.classList.add('form-input', 'phone-type');
        ['Mobile', 'Home', 'Work', 'Other'].forEach(opt => {
            const option = document.createElement('option'); option.value = opt; option.textContent = opt;
            if (opt === type) option.selected = true; typeSelect.appendChild(option);
        });
        
        const numberInput = document.createElement('input'); numberInput.type = 'tel'; numberInput.classList.add('form-input', 'phone-number'); numberInput.placeholder = 'Phone Number'; numberInput.value = number;
        
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.innerHTML = '<i class="fas fa-times"></i>'; removeBtn.classList.add('btn', 'btn-remove-item', 'btn-danger', 'btn-sm'); removeBtn.title = "Remove Phone";
        removeBtn.onclick = () => entryDiv.remove();
        
        entryDiv.appendChild(typeSelect); entryDiv.appendChild(numberInput); entryDiv.appendChild(removeBtn);
        phoneNumbersContainerEl.appendChild(entryDiv);
    }
    if (addPhoneNumberBtn) addPhoneNumberBtn.addEventListener('click', () => addPhoneNumberField());

    if (profilePicInputEl) {
        profilePicInputEl.addEventListener('change', (e) => {
            currentProfilePicFile = e.target.files[0];
            if (currentProfilePicFile) {
                const reader = new FileReader();
                reader.onload = (event) => { if(profilePicPreviewEl) profilePicPreviewEl.src = event.target.result; }
                reader.readAsDataURL(currentProfilePicFile);
                if(uploadStatusEl) uploadStatusEl.textContent = 'Image selected. Click "Save Details" to upload.';
            } else { if(uploadStatusEl) uploadStatusEl.textContent = ''; }
        });
    }

    if (customerDetailsForm) {
        customerDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentCustomerId) { alert("Cannot save, customer ID is missing."); return; }
            if(uploadStatusEl) uploadStatusEl.textContent = 'Saving...';
            if(saveCustomerDetailsBtn) { saveCustomerDetailsBtn.disabled = true; saveCustomerDetailsBtn.innerHTML = '<i class="fas fa-spinner fa-spin fa-fw"></i> Saving...';}

            let profilePicUrlToSave = (await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}/profilePicUrl`).once('value')).val() || null;

            if (currentProfilePicFile) {
                if(uploadStatusEl) uploadStatusEl.textContent = 'Uploading picture...';
                const filePath = `customerProfilePictures/${currentCustomerId}/${Date.now()}_${currentProfilePicFile.name}`;
                const storageRef = storage.ref(filePath);
                try {
                    const uploadTask = await storageRef.put(currentProfilePicFile);
                    profilePicUrlToSave = await uploadTask.ref.getDownloadURL();
                    if(uploadStatusEl) uploadStatusEl.textContent = 'Picture uploaded!';
                    currentProfilePicFile = null; 
                } catch (error) {
                    console.error("Error uploading profile picture:", error);
                    if(uploadStatusEl) uploadStatusEl.textContent = 'Picture upload failed.';
                }
            }

            const phoneNumbers = [];
            if(phoneNumbersContainerEl) {
                phoneNumbersContainerEl.querySelectorAll('.phone-number-entry').forEach(entry => {
                    const type = entry.querySelector('.phone-type').value;
                    const number = entry.querySelector('.phone-number').value.trim();
                    if (number) phoneNumbers.push({ type, number });
                });
            }
            
            const customerUpdateData = {
                name: customerNameInput.value.trim(),
                normalizedName: normalizeName(customerNameInput.value.trim()),
                city: customerCityDisplayEl.textContent === '-' || customerCityDisplayEl.textContent === 'N/A' ? ( (await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}/city`).once('value')).val() || null ) : customerCityDisplayEl.textContent, // Preserve existing city if not editable here or set from sale
                phoneNumbers: phoneNumbers,
                addressText: addressTextInputEl.value.trim() || null,
                googleMapsLink: googleMapsLinkInputEl.value.trim() || null,
                profilePicUrl: profilePicUrlToSave,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
             // Important: If city is editable on this page, get value from an input.
             // For now, assuming city is primarily set via sales and displayed here.
             // If you add a city input field here: customerUpdateData.city = cityInputElement.value.trim();

            try {
                await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}`).update(customerUpdateData);
                alert("Customer details updated successfully!");
                if(uploadStatusEl) uploadStatusEl.textContent = 'Details saved.';
                // Update titles if name changed
                if(customerCardTitleEl && customerNameInput.value.trim() !== customerCardTitleEl.textContent) customerCardTitleEl.textContent = customerNameInput.value.trim();
                if(pageTitleEl && customerNameInput.value.trim() !== pageTitleEl.textContent.replace("Customer: ","").replace('<i class="fas fa-user-tie fa-fw"></i> ', '')) pageTitleEl.innerHTML = `<i class="fas fa-user-tie fa-fw"></i> Customer: ${customerNameInput.value.trim()}`;

            } catch (error) {
                console.error("Error updating customer details:", error);
                alert("Failed to update customer details.");
                if(uploadStatusEl) uploadStatusEl.textContent = 'Save failed.';
            } finally {
                if(saveCustomerDetailsBtn) { saveCustomerDetailsBtn.disabled = false; saveCustomerDetailsBtn.innerHTML = '<i class="fas fa-save fa-fw"></i> Save Customer Details'; }
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
            if (!currentCustomerId) { alert("Customer ID missing."); return; }
            const notesToSave = adminNotesInputEl.value.trim();
            try {
                await db.ref(`${CUSTOMERS_PATH}/${currentCustomerId}/adminNotes`).set(notesToSave || null);
                loadAdminNotes(notesToSave); // Re-display formatted notes
                alert("Admin notes saved!");
            } catch (error) { console.error("Error saving admin notes:", error); alert("Failed to save notes."); }
        });
    }

    function loadCustomerSalesAndInstallmentHistory(customerId) {
        if (!customerSalesTableBodyEl || !customerInstallmentsTableBodyEl || !customerTotalSpentEl || !noInstallmentsMessageEl) {
            console.error("Sales or Installment history table elements not found."); return;
        }
        
        const salesRef = db.ref(SALES_LOG_PATH).orderByChild('customerId').equalTo(customerId);
        salesRef.off('value'); // Detach previous listeners

        salesRef.on('value', snapshot => {
            customerSalesTableBodyEl.innerHTML = ''; 
            customerInstallmentsTableBodyEl.innerHTML = '';
            let totalSpent = 0;
            let hasInstallments = false;
            const salesEntries = [];

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    salesEntries.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
                salesEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
                
                salesEntries.forEach(sale => {
                    renderSaleRowForCustomer(sale); // For general sales history table
                    totalSpent += parseFloat(sale.grandTotal) || 0;

                    if (sale.paymentMethod === 'Installment') {
                        hasInstallments = true;
                        renderInstallmentRowForCustomer(sale); // For installment table
                    }
                });
            }
            
            if (salesEntries.length === 0 && customerSalesTableBodyEl.innerHTML === '') { // Check if table is still empty
                const row = customerSalesTableBodyEl.insertRow(); const cell = row.insertCell();
                cell.colSpan = 5; cell.textContent = 'No sales history for this customer.';
                cell.style.textAlign = 'center'; cell.style.padding = '1rem';
            }
            
            if(noInstallmentsMessageEl) noInstallmentsMessageEl.classList.toggle('hidden', hasInstallments);
            if(customerInstallmentsTableBodyEl && !hasInstallments && customerInstallmentsTableBodyEl.innerHTML === ''){
                // This is covered by the noInstallmentsMessageEl logic
            }

            if(customerTotalSpentEl) customerTotalSpentEl.textContent = `Rs. ${totalSpent.toFixed(2)}`;

        }, errorObject => { 
            console.error(`Error fetching sales history for customer ${customerId}:`, errorObject);
            if(customerSalesTableBodyEl) customerSalesTableBodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding:1rem;">Error loading sales history.</td></tr>`;
            if(customerInstallmentsTableBodyEl) customerInstallmentsTableBodyEl.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding:1rem;">Error loading installment history.</td></tr>`;
            if(customerTotalSpentEl) customerTotalSpentEl.textContent = 'Error';
        });
    }

    function renderSaleRowForCustomer(saleData) {
        if (!customerSalesTableBodyEl) return;
        const row = customerSalesTableBodyEl.insertRow(); 
        row.setAttribute('data-id', saleData.id || saleData.saleId);

        row.insertCell().textContent = saleData.saleDate || 'N/A';
        row.insertCell().textContent = saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : (saleData.id ? saleData.id.slice(-6).toUpperCase() : 'N/A');
        
        const totalCell = row.insertCell();
        totalCell.textContent = saleData.grandTotal ? parseFloat(saleData.grandTotal).toFixed(2) : '0.00';
        totalCell.classList.add('text-right');
        
        let paymentMethodDisplay = saleData.paymentMethod || 'N/A';
        if (saleData.paymentMethod === 'Installment' && saleData.remainingBalance <= 0) {
            paymentMethodDisplay += ' (Paid Off)';
        } else if (saleData.paymentMethod === 'Installment') {
            paymentMethodDisplay += ' (Ongoing)';
        }
        row.insertCell().textContent = paymentMethodDisplay;

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button');
        invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i> View';
        invoiceBtn.classList.add('btn', 'btn-primary', 'btn-sm');
        invoiceBtn.onclick = () => generateInvoiceForSale(saleData); 
        actionsCell.appendChild(invoiceBtn);
    }

    function renderInstallmentRowForCustomer(saleData) {
        if (!customerInstallmentsTableBodyEl) return;
        const row = customerInstallmentsTableBodyEl.insertRow();
        row.setAttribute('data-id', saleData.id || saleData.saleId);

        row.insertCell().textContent = saleData.saleDate || 'N/A';
        row.insertCell().textContent = saleData.saleId ? saleData.saleId.slice(-6).toUpperCase() : (saleData.id ? saleData.id.slice(-6).toUpperCase() : 'N/A');

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
        const totalSaleAmount = parseFloat(saleData.grandTotal || 0);

        if (totalSaleAmount <= 0 && remaining <=0) { // For 0 value sales, or already cleared.
            statusCell.textContent = 'Cleared';
            statusCell.classList.add('text-muted');
        } else if (remaining <= 0) {
            statusCell.textContent = 'Fully Paid';
            statusCell.classList.add('text-success', 'font-weight-bold');
        } else {
            statusCell.textContent = 'Partially Paid';
            statusCell.classList.add('text-warning');
        }

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        const invoiceBtn = document.createElement('button');
        invoiceBtn.innerHTML = '<i class="fas fa-file-pdf fa-fw"></i> View';
        invoiceBtn.classList.add('btn', 'btn-info', 'btn-sm');
        invoiceBtn.onclick = () => generateInvoiceForSale(saleData);
        actionsCell.appendChild(invoiceBtn);
    }


    function generateInvoiceForSale(saleData) {
        if (!saleData) { alert("Sale data missing for invoice generation."); return; }
        const doc = new jsPDF();
        const companyName = "Amee-Tea Pvt Ltd"; 
        const companyAddress = "123 Tea Lane, Colombo, Sri Lanka"; 
        const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, 20); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10); 
        doc.text(companyAddress, 14, 26); doc.text(companyContact, 14, 32);
        
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 140, 22); 
        doc.setFont(undefined, 'normal'); doc.setFontSize(10); 
        doc.text(`Invoice ID: ${saleData.saleId ? saleData.saleId.slice(-10) : 'N/A'}`, 140, 30); 
        doc.text(`Date: ${saleData.saleDate || 'N/A'}`, 140, 35);
        
        doc.setFontSize(12); doc.text("Bill To:", 14, 45); 
        doc.setFontSize(10);
        let customerLine1 = saleData.customerName || 'N/A Customer';
        if (saleData.customerId) customerLine1 += ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})`;
        doc.text(customerLine1, 14, 50);
        let currentYForBillTo = 50;
        if (saleData.customerCity) {
            currentYForBillTo += 5;
            doc.text(`City: ${saleData.customerCity}`, 14, currentYForBillTo);
        }
        const tableStartY = currentYForBillTo + 10;
        doc.line(14, tableStartY - 5, 196, tableStartY - 5);

        const tableColumn = ["#", "Item", "Qty", "Price (Rs.)", "Item Disc. (%)", "Line Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => {
            tableRows.push([
                itemNumber++, 
                `${item.itemName || 'Unknown Item'} (${item.productCode || 'N/A'})`, 
                item.quantity || 0, 
                parseFloat(item.unitPrice || 0).toFixed(2), 
                (item.discountPercent || 0).toFixed(2), // Item-level discount percentage
                parseFloat(item.lineTotal || 0).toFixed(2)
            ]);
        });
        doc.autoTable({ 
            head: [tableColumn], body: tableRows, startY: tableStartY, 
            theme: 'striped', headStyles: { fillColor: [22, 160, 133] }, margin: { top: tableStartY -5 } 
        });
        
        let finalY = doc.lastAutoTable.finalY || tableStartY + 20;
        finalY += 10; 
        doc.setFontSize(10); 
        doc.text(`Subtotal:`, 140, finalY); 
        doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        
        // Use overallDiscountValue (direct amount)
        if (typeof saleData.overallDiscountValue !== 'undefined' && saleData.overallDiscountValue > 0) { 
            finalY += 5; 
            doc.text(`Overall Discount:`, 140, finalY); 
            doc.text(`- Rs. ${parseFloat(saleData.overallDiscountValue).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        }
        
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); 
        doc.text(`Grand Total:`, 140, finalY); 
        doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); 
        
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        finalY += 10; 
        doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        
        if (saleData.paymentMethod === 'Installment') {
            finalY += 5; doc.text(`Amount Paid: Rs. ${parseFloat(saleData.amountPaid || 0).toFixed(2)}`, 14, finalY);
            finalY += 5; doc.text(`Remaining Balance: Rs. ${parseFloat(saleData.remainingBalance || 0).toFixed(2)}`, 14, finalY);
        }

        if(saleData.saleNotes){ 
            finalY += 7; 
            doc.text("Notes:", 14, finalY); 
            const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); 
            doc.text(notesLines, 14, finalY + 4); 
        }
        
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(8); 
        doc.text("Thank you for your business!", 14, pageHeight - 10); 
        doc.text("Generated on: " + new Date().toLocaleString(), 130, pageHeight - 10, {align: 'right'});
        
        doc.save(`Invoice-${saleData.saleId || saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }

    function initializePage() {
        currentCustomerId = getCustomerIdFromUrl();
        if (currentCustomerId) {
            loadCustomerDetails(currentCustomerId);
        } else {
            showError("No Customer ID specified in URL. Please go back to the customer list and select a customer.");
            if(pageTitleEl) pageTitleEl.textContent = "Invalid Customer";
        }
    }

    initializePage();
});