// === customers.js ===

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

    // --- Navbar Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements ---
    const customersTableBody = document.getElementById('customersTableBody');
    const searchCustomersInput = document.getElementById('searchCustomersInput');
    const cityFilterSelect = document.getElementById('cityFilterSelect');
    const cityTotalPaidDisplay = document.getElementById('cityTotalPaidDisplay');
    const noCustomersFoundText = document.getElementById('noCustomersFoundText');
    
    // **NEW**: Add Customer Form Elements
    const addCustomerForm = document.getElementById('addCustomerForm');
    const newCustomerNameInput = document.getElementById('newCustomerNameInput');
    const newCustomerCitySelect = document.getElementById('newCustomerCitySelect');
    const addNewCityInput = document.getElementById('addNewCityInput');

    // Firebase Paths
    const CUSTOMERS_PATH = 'customers';
    const CITIES_PATH = 'cities';
    const SALES_LOG_PATH = 'salesLog';

    // Caches
    let allCustomersCache = []; 
    let citiesCache = [];
    let allSalesDataCache = [];

    async function initializeCustomersPage() {
        await fetchCitiesAndPopulateDropdowns();
        await fetchSalesData();
        loadCustomers(); 

        // Attach Event Listeners
        if (searchCustomersInput) searchCustomersInput.addEventListener('input', displayFilteredCustomers);
        if (cityFilterSelect) cityFilterSelect.addEventListener('change', displayFilteredCustomers);
        if (addCustomerForm) addCustomerForm.addEventListener('submit', handleAddCustomerSubmit);
    }

    // **UPDATED**: This function now populates both the filter and the new customer form dropdowns.
    async function fetchCitiesAndPopulateDropdowns() {
        try {
            const snapshot = await db.ref(CITIES_PATH).orderByChild('name').once('value');
            citiesCache = [];
            let filterOptionsHTML = '<option value="">-- All Cities --</option>';
            let addFormOptionsHTML = '<option value="">-- Choose existing city --</option>';

            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const cityData = child.val();
                    if (cityData && cityData.name) {
                        citiesCache.push({ id: child.key, name: cityData.name });
                        filterOptionsHTML += `<option value="${cityData.name}">${cityData.name}</option>`;
                        addFormOptionsHTML += `<option value="${cityData.name}">${cityData.name}</option>`;
                    }
                });
            }
            if (cityFilterSelect) cityFilterSelect.innerHTML = filterOptionsHTML;
            if (newCustomerCitySelect) newCustomerCitySelect.innerHTML = addFormOptionsHTML;
        } catch (error) {
            console.error("Error fetching cities:", error);
            if (cityFilterSelect) cityFilterSelect.innerHTML = '<option value="">-- Error Loading --</option>';
            if (newCustomerCitySelect) newCustomerCitySelect.innerHTML = '<option value="">-- Error Loading --</option>';
        }
    }

    async function fetchSalesData() {
        try {
            const snapshot = await db.ref(SALES_LOG_PATH).once('value');
            allSalesDataCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    allSalesDataCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
        } catch (error) {
            console.error("Error fetching sales data:", error);
        }
    }

    // **NEW**: Handles the submission of the "Add New Customer" form.
    async function handleAddCustomerSubmit(e) {
        e.preventDefault();
        const customerName = newCustomerNameInput.value.trim();
        let customerCity = newCustomerCitySelect.value;
        const newCity = addNewCityInput.value.trim();

        if (!customerName) {
            alert("Please enter a customer name.");
            return;
        }

        // Logic to decide which city to use
        if (newCity) {
            customerCity = newCity;
        }
        if (!customerCity) {
            alert("Please select an existing city or add a new one.");
            return;
        }

        try {
            // If a new city was entered, check if it exists and add it if not.
            if (newCity) {
                const normalizedNewCity = newCity.toLowerCase().trim();
                const cityExists = citiesCache.some(city => city.name.toLowerCase().trim() === normalizedNewCity);
                if (!cityExists) {
                    await db.ref(CITIES_PATH).push({ name: newCity });
                    await fetchCitiesAndPopulateDropdowns(); // Refresh dropdowns
                }
            }
            
            // Proceed to add the customer
            const normalizedName = customerName.toLowerCase().replace(/\s+/g, ' ').trim();
            const newCustomerRef = db.ref(CUSTOMERS_PATH).push();
            const newCustomer = {
                customerId: newCustomerRef.key,
                name: customerName,
                normalizedName: normalizedName,
                city: customerCity,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            await newCustomerRef.set(newCustomer);
            alert(`Customer "${customerName}" added successfully!`);
            addCustomerForm.reset(); // Clear the form

            // The real-time listener on 'loadCustomers' will automatically update the table.
        } catch (error) {
            console.error("Error adding customer:", error);
            alert("Failed to add customer. Check the console for more details.");
        }
    }


    function loadCustomers() {
        const customersRef = db.ref(CUSTOMERS_PATH).orderByChild('name');
        customersRef.on('value', snapshot => {
            allCustomersCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    allCustomersCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
            if (window.location.hash) {
                const customerIdFromHash = window.location.hash.substring(1);
                if (customerIdFromHash && searchCustomersInput) {
                    searchCustomersInput.value = customerIdFromHash;
                }
            }
            displayFilteredCustomers();
        }, error => {
            console.error("Error loading customers:", error);
            allCustomersCache = [];
            displayFilteredCustomers();
        });
    }

    function displayFilteredCustomers() {
        if (!customersTableBody || !cityTotalPaidDisplay) return;
        customersTableBody.innerHTML = ''; 
        const searchTerm = searchCustomersInput.value.toLowerCase().trim();
        const selectedCity = cityFilterSelect.value;
        let customersDisplayedCount = 0;
        let totalPaidForCity = 0;

        const filteredCustomers = allCustomersCache.filter(customer => {
            const nameMatches = customer.name && customer.name.toLowerCase().includes(searchTerm);
            const idMatches = (customer.customerId || customer.id).toLowerCase().includes(searchTerm);
            const cityMatches = !selectedCity || (customer.city && customer.city === selectedCity);
            return (nameMatches || idMatches) && cityMatches;
        });

        filteredCustomers.forEach(customer => {
            renderCustomerRow(customer);
            customersDisplayedCount++;
        });

        if (selectedCity) {
            const customerIdsInCity = allCustomersCache
                .filter(c => c.city === selectedCity)
                .map(c => c.customerId || c.id);

            allSalesDataCache.forEach(sale => {
                if (customerIdsInCity.includes(sale.customerId)) {
                    totalPaidForCity += parseFloat(sale.grandTotal || 0);
                }
            });
            cityTotalPaidDisplay.textContent = `Total business from ${selectedCity}: Rs. ${totalPaidForCity.toFixed(2)}`;
            cityTotalPaidDisplay.style.display = 'block';
        } else {
            cityTotalPaidDisplay.style.display = 'none';
        }

        if (noCustomersFoundText) {
            if (customersDisplayedCount === 0) {
                noCustomersFoundText.textContent = (searchTerm || selectedCty) ? 'No customers match your criteria.' : 'No customers found.';
                noCustomersFoundText.style.display = 'block';
            } else {
                noCustomersFoundText.style.display = 'none';
            }
        }
    }
    
    function renderCustomerRow(customerData) {
        const row = customersTableBody.insertRow();
        row.setAttribute('data-id', customerData.id);

        const idCell = row.insertCell();
        idCell.textContent = customerData.customerId || customerData.id; 

        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = `customer_data.html?id=${customerData.customerId || customerData.id}`; 
        nameLink.textContent = customerData.name || 'N/A';
        nameLink.classList.add('table-link'); 
        nameCell.appendChild(nameLink);

        const cityCell = row.insertCell();
        cityCell.textContent = customerData.city || 'N/A';

        const dateCell = row.insertCell();
        if (customerData.createdAt) {
            dateCell.textContent = new Date(customerData.createdAt).toLocaleDateString();
        } else {
            dateCell.textContent = 'N/A';
        }
        
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.title = `Delete customer ${customerData.name}`;
        deleteBtn.onclick = () => deleteCustomer(customerData.id, customerData.name);
        actionsCell.appendChild(deleteBtn);
    }

    async function deleteCustomer(firebaseKey, customerName) {
        if (!firebaseKey) return;

        const customerToDelete = allCustomersCache.find(c => c.id === firebaseKey);
        const customerIdForDisplay = customerToDelete ? (customerToDelete.customerId || firebaseKey) : firebaseKey;

        if (confirm(`Are you sure you want to delete customer "${customerName}" (ID: ${customerIdForDisplay})?\nThis action cannot be undone.`)) {
            try {
                await db.ref(`${CUSTOMERS_PATH}/${firebaseKey}`).remove();
                alert(`Customer "${customerName}" deleted.`);
            } catch (error) {
                console.error(`Error deleting customer ${firebaseKey}:`, error);
                alert('Error deleting customer. Check console.');
            }
        }
    }

    // --- Initial Load ---
    initializeCustomersPage();
});