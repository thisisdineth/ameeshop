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
        // No need for the click listener on individual links as this page doesn't navigate away from itself via the mobile menu for core functionality.
    }

    // --- DOM Elements ---
    const customersTableBody = document.getElementById('customersTableBody');
    const searchCustomersInput = document.getElementById('searchCustomersInput');
    const cityFilterSelect = document.getElementById('cityFilterSelect');
    const cityTotalPaidDisplay = document.getElementById('cityTotalPaidDisplay');
    const noCustomersFoundText = document.getElementById('noCustomersFoundText');


    // Firebase Paths
    const CUSTOMERS_PATH = 'customers';
    const CITIES_PATH = 'cities'; // Assuming this path is maintained by sales.js or similar
    const SALES_LOG_PATH = 'salesLog';

    // Caches
    let allCustomersCache = []; 
    let citiesCache = [];
    let allSalesDataCache = []; // To store all sales log entries

    async function initializeCustomersPage() {
        await fetchCitiesAndPopulateFilter();
        await fetchSalesData(); // Fetch all sales data once for calculations
        loadCustomers(); // This will also trigger initial display

        if (searchCustomersInput) searchCustomersInput.addEventListener('input', displayFilteredCustomers);
        if (cityFilterSelect) cityFilterSelect.addEventListener('change', displayFilteredCustomers);
    }


    async function fetchCitiesAndPopulateFilter() {
        try {
            const snapshot = await db.ref(CITIES_PATH).orderByChild('name').once('value');
            citiesCache = [];
            let cityOptionsHTML = '<option value="">-- All Cities --</option>';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const cityData = child.val();
                    if (cityData && cityData.name) {
                        citiesCache.push({ id: child.key, name: cityData.name }); // Store city name
                        cityOptionsHTML += `<option value="${cityData.name}">${cityData.name}</option>`;
                    }
                });
            }
            if (cityFilterSelect) cityFilterSelect.innerHTML = cityOptionsHTML;
        } catch (error) {
            console.error("Error fetching cities:", error);
            if (cityFilterSelect) cityFilterSelect.innerHTML = '<option value="">-- Error Loading Cities --</option>';
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
            console.log("Sales data fetched for city total calculation:", allSalesDataCache.length);
        } catch (error) {
            console.error("Error fetching sales data:", error);
        }
    }


    // --- Load Customers ---
    function loadCustomers() {
        const customersRef = db.ref(CUSTOMERS_PATH).orderByChild('name');
        customersRef.on('value', snapshot => {
            allCustomersCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    allCustomersCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
            // Check if a specific customer ID is in the URL hash (e.g., from sales page link)
            if (window.location.hash) {
                const customerIdFromHash = window.location.hash.substring(1);
                if (customerIdFromHash && searchCustomersInput) {
                    searchCustomersInput.value = customerIdFromHash; // Pre-fill search
                    // Potentially highlight or scroll to the customer if needed here
                }
            }
            displayFilteredCustomers(); // Initial display after loading/hash check
        }, error => {
            console.error("Error loading customers:", error);
            allCustomersCache = [];
            displayFilteredCustomers();
        });
    }

    // --- Display Filtered Customers ---
    function displayFilteredCustomers() {
        if (!customersTableBody || !cityTotalPaidDisplay) return;
        customersTableBody.innerHTML = ''; 
        const searchTerm = searchCustomersInput.value.toLowerCase().trim();
        const selectedCity = cityFilterSelect.value;
        let customersDisplayedCount = 0;
        let totalPaidForCity = 0;

        // Filter customers based on search term and selected city
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

        // Calculate total paid for the selected city (if a city is selected)
        if (selectedCity) {
            const customerIdsInCity = allCustomersCache
                .filter(c => c.city === selectedCity)
                .map(c => c.customerId || c.id); // Use customerId if present, else fallback to firebase key

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
                noCustomersFoundText.textContent = (searchTerm || selectedCity) ? 'No customers match your criteria.' : 'No customers found. Add customers via the Sales page.';
                noCustomersFoundText.style.display = 'block';
            } else {
                noCustomersFoundText.style.display = 'none';
            }
        }
    }
    

    // --- Render a Single Customer Row ---
    function renderCustomerRow(customerData) {
        const row = customersTableBody.insertRow();
        row.setAttribute('data-id', customerData.id);

        // Customer ID
        const idCell = row.insertCell();
        idCell.textContent = customerData.customerId || customerData.id; 

        // Customer Name (Clickable)
        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        // Assuming customer_data.html is a future page for detailed view
        nameLink.href = `customer_data.html?id=${customerData.customerId || customerData.id}`; 
        nameLink.textContent = customerData.name || 'N/A';
        nameLink.classList.add('table-link'); 
        nameCell.appendChild(nameLink);

        // City
        const cityCell = row.insertCell();
        cityCell.textContent = customerData.city || 'N/A';

        // Date Added
        const dateCell = row.insertCell();
        if (customerData.createdAt) {
            dateCell.textContent = new Date(customerData.createdAt).toLocaleDateString();
        } else {
            dateCell.textContent = 'N/A';
        }
        
        // Actions
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteBtn.title = `Delete customer ${customerData.name}`;
        deleteBtn.onclick = () => deleteCustomer(customerData.id, customerData.name);
        actionsCell.appendChild(deleteBtn);
    }

    // --- Delete Customer ---
    async function deleteCustomer(firebaseKey, customerName) { // firebaseKey is the actual key from Firebase snapshot
        if (!firebaseKey) return;

        const customerToDelete = allCustomersCache.find(c => c.id === firebaseKey);
        const customerIdForDisplay = customerToDelete ? (customerToDelete.customerId || firebaseKey) : firebaseKey;


        if (confirm(`Are you sure you want to delete customer "${customerName}" (ID: ${customerIdForDisplay})?\nThis action cannot be undone. Past sales records will retain the customer name but this profile will be removed.`)) {
            try {
                await db.ref(`${CUSTOMERS_PATH}/${firebaseKey}`).remove();
                console.log(`Customer "${customerName}" deleted successfully.`);
                // Real-time listener in loadCustomers will refresh the table.
                // We also need to re-fetch sales data if we want the city total to update immediately after a customer affecting it is deleted,
                // although the current logic recalculates on filter change.
                // For simplicity, let's rely on the next filter change or page reload for city total if a customer is deleted.
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