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
    
    // Add Customer Form Elements
    const addCustomerForm = document.getElementById('addCustomerForm');
    const newCustomerNameInput = document.getElementById('newCustomerNameInput');
    const newCustomerCitySelect = document.getElementById('newCustomerCitySelect');
    const addNewCityInput = document.getElementById('addNewCityInput');

    // Cities Table Elements
    const citiesTableBody = document.getElementById('citiesTableBody');
    const noCitiesFoundText = document.getElementById('noCitiesFoundText');
    // **NEW**: Cities Search Input
    const searchCitiesInput = document.getElementById('searchCitiesInput'); 

    // Firebase Paths
    const CUSTOMERS_PATH = 'customers';
    const CITIES_PATH = 'cities';
    const SALES_LOG_PATH = 'salesLog';

    // Caches
    let allCustomersCache = []; 
    let allCitiesDataCache = []; // Renamed from citiesCache to be explicit for raw data
    let allSalesDataCache = [];

    async function initializeCustomersPage() {
        await fetchCitiesAndPopulateDropdowns(); 
        await fetchSalesData();
        loadCustomers(); 
        loadCities(); // Load cities for the new table

        // Attach Event Listeners
        if (searchCustomersInput) searchCustomersInput.addEventListener('input', displayFilteredCustomers);
        if (cityFilterSelect) cityFilterSelect.addEventListener('change', displayFilteredCustomers);
        if (addCustomerForm) addCustomerForm.addEventListener('submit', handleAddCustomerSubmit);
        // **NEW**: Event listener for cities search input
        if (searchCitiesInput) searchCitiesInput.addEventListener('input', displayFilteredCities);
    }

    async function fetchCitiesAndPopulateDropdowns() {
        try {
            const snapshot = await db.ref(CITIES_PATH).orderByChild('name').once('value');
            allCitiesDataCache = []; // Update the explicit cache
            let filterOptionsHTML = '<option value="">-- All Cities --</option>';
            let addFormOptionsHTML = '<option value="">-- Choose existing city --</option>';

            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const cityData = child.val();
                    if (cityData && cityData.name) {
                        allCitiesDataCache.push({ id: child.key, name: cityData.name });
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

    async function handleAddCustomerSubmit(e) {
        e.preventDefault();
        const customerName = newCustomerNameInput.value.trim();
        let customerCity = newCustomerCitySelect.value;
        const newCity = addNewCityInput.value.trim();

        if (!customerName) {
            alert("Please enter a customer name.");
            return;
        }

        if (newCity) {
            customerCity = newCity;
        }
        if (!customerCity) {
            alert("Please select an existing city or add a new one.");
            return;
        }

        try {
            if (newCity) {
                const normalizedNewCity = newCity.toLowerCase().trim();
                const cityExists = allCitiesDataCache.some(city => city.name.toLowerCase().trim() === normalizedNewCity);
                if (!cityExists) {
                    await db.ref(CITIES_PATH).push({ name: newCity });
                    await fetchCitiesAndPopulateDropdowns(); 
                    loadCities(); // Refresh the cities table as well
                }
            }
            
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
            addCustomerForm.reset(); 

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
                noCustomersFoundText.textContent = (searchTerm || selectedCity) ? 'No customers match your criteria.' : 'No customers found.';
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

    // --- City Management Functions ---

    function loadCities() {
        const citiesRef = db.ref(CITIES_PATH).orderByChild('name');
        citiesRef.on('value', snapshot => {
            allCitiesDataCache = []; // Update the explicit cache with raw data
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const cityData = childSnapshot.val();
                    if (cityData && cityData.name) {
                        const cityId = childSnapshot.key;
                        allCitiesDataCache.push({ id: cityId, name: cityData.name }); 
                    }
                });
            }
            displayFilteredCities(); // Now calls the filtered display
            fetchCitiesAndPopulateDropdowns(); // Re-populate dropdowns if cities list changes
        }, error => {
            console.error("Error loading cities:", error);
            allCitiesDataCache = [];
            displayFilteredCities(); // Ensure table is cleared/updated on error
        });
    }

    // **NEW**: Function to filter and display cities
    function displayFilteredCities() {
        if (!citiesTableBody) return;
        citiesTableBody.innerHTML = '';
        const searchTerm = searchCitiesInput.value.toLowerCase().trim();
        let citiesDisplayedCount = 0;

        const filteredCities = allCitiesDataCache.filter(city => {
            return city.name && city.name.toLowerCase().includes(searchTerm);
        });

        filteredCities.forEach(city => {
            renderCityRow(city);
            citiesDisplayedCount++;
        });

        if (noCitiesFoundText) {
            if (citiesDisplayedCount === 0) {
                noCitiesFoundText.textContent = searchTerm ? 'No cities match your search criteria.' : 'No cities found.';
                noCitiesFoundText.style.display = 'block';
            } else {
                noCitiesFoundText.style.display = 'none';
            }
        }
    }

    function renderCityRow(cityData) {
        const row = citiesTableBody.insertRow();
        row.setAttribute('data-id', cityData.id);

        const nameCell = row.insertCell();
        nameCell.textContent = cityData.name;

        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions', 'text-center');

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i> Edit';
        editBtn.classList.add('btn', 'btn-primary', 'btn-sm');
        editBtn.title = `Edit city ${cityData.name}`;
        editBtn.onclick = () => editCity(cityData.id, cityData.name);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete';
        deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'ml-1'); 
        deleteBtn.title = `Delete city ${cityData.name}`;
        deleteBtn.onclick = () => deleteCity(cityData.id, cityData.name);
        actionsCell.appendChild(deleteBtn);
    }

    async function editCity(cityId, currentCityName) {
        if (!cityId) return;

        const newCityName = prompt(`Edit city name for "${currentCityName}":`, currentCityName);
        if (newCityName === null || newCityName.trim() === '') {
            alert('City name cannot be empty. Edit cancelled.');
            return;
        }

        const trimmedNewCityName = newCityName.trim();
        if (trimmedNewCityName === currentCityName) {
            alert('No change made to city name.');
            return;
        }

        const isDuplicate = allCitiesDataCache.some(
            city => city.name.toLowerCase() === trimmedNewCityName.toLowerCase() && city.id !== cityId
        );
        if (isDuplicate) {
            alert(`A city named "${trimmedNewCityName}" already exists. Please choose a different name.`);
            return;
        }

        try {
            await db.ref(`${CITIES_PATH}/${cityId}`).update({ name: trimmedNewCityName });

            const customersToUpdate = allCustomersCache.filter(customer => customer.city === currentCityName);
            const updates = {};
            customersToUpdate.forEach(customer => {
                updates[`${CUSTOMERS_PATH}/${customer.id}/city`] = trimmedNewCityName;
            });

            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                console.log(`Updated ${Object.keys(updates).length} customers from "${currentCityName}" to "${trimmedNewCityName}".`);
            }
            
            alert(`City "${currentCityName}" updated to "${trimmedNewCityName}" successfully. All associated customers have also been updated.`);
        } catch (error) {
            console.error(`Error editing city ${cityId}:`, error);
            alert('Error editing city. Check console for details.');
        }
    }

    async function deleteCity(cityId, cityName) {
        if (!cityId) return;

        const customersInCity = allCustomersCache.filter(customer => customer.city === cityName);
        if (customersInCity.length > 0) {
            alert(`Cannot delete city "${cityName}". There are ${customersInCity.length} customers associated with this city. Please reassign or delete these customers first.`);
            return;
        }

        if (confirm(`Are you sure you want to delete city "${cityName}"?\nThis action cannot be undone.`)) {
            try {
                await db.ref(`${CITIES_PATH}/${cityId}`).remove();
                alert(`City "${cityName}" deleted successfully.`);
            } catch (error) {
                console.error(`Error deleting city ${cityId}:`, error);
                alert('Error deleting city. Check console.');
            }
        }
    }

    // --- Initial Load ---
    initializeCustomersPage();
});