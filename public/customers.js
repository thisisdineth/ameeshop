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
        mobileMenu.querySelectorAll('a.mobile-navbar-item').forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- DOM Elements ---
    const customersTableBody = document.getElementById('customersTableBody');
    const searchCustomersInput = document.getElementById('searchCustomersInput');

    const CUSTOMERS_PATH = 'customers';
    let allCustomersCache = []; // To store { id, name, createdAt, ... }

    // --- Load Customers ---
    function loadCustomers() {
        const customersRef = db.ref(CUSTOMERS_PATH).orderByChild('name'); // Order by name
        customersRef.on('value', snapshot => {
            allCustomersCache = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    allCustomersCache.push({ id: childSnapshot.key, ...childSnapshot.val() });
                });
            }
            displayFilteredCustomers(); // Initial display
        });
    }

    // --- Display Filtered Customers ---
    function displayFilteredCustomers() {
        if (!customersTableBody) return;
        customersTableBody.innerHTML = ''; // Clear current rows
        const searchTerm = searchCustomersInput.value.toLowerCase();
        let customersDisplayed = false;

        allCustomersCache
            .filter(customer => 
                customer.name.toLowerCase().includes(searchTerm) || 
                customer.id.toLowerCase().includes(searchTerm)
            )
            .forEach(customer => {
                renderCustomerRow(customer);
                customersDisplayed = true;
            });

        if (!customersDisplayed) {
            const row = customersTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4; // Customer ID, Name, Date Added, Actions
            cell.textContent = searchTerm ? 'No customers match your search.' : 'No customers found.';
            cell.style.textAlign = 'center';
            cell.style.padding = '1rem';
            cell.style.color = 'var(--text-color-muted)';
        }
    }
    if (searchCustomersInput) searchCustomersInput.addEventListener('input', displayFilteredCustomers);

    // --- Render a Single Customer Row ---
    function renderCustomerRow(customerData) {
        const row = customersTableBody.insertRow();
        row.setAttribute('data-id', customerData.id);

        // Customer ID
        const idCell = row.insertCell();
        idCell.textContent = customerData.customerId || customerData.id; // Use stored customerId field if available

        // Customer Name (Clickable)
        const nameCell = row.insertCell();
        const nameLink = document.createElement('a');
        nameLink.href = `customer_data.html?id=${customerData.customerId || customerData.id}`;
        nameLink.textContent = customerData.name || 'N/A';
        nameLink.classList.add('table-link'); // Add a class for styling if needed
        nameCell.appendChild(nameLink);

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
    async function deleteCustomer(customerId, customerName) {
        if (!customerId) return;

        if (confirm(`Are you sure you want to delete customer "${customerName}" (ID: ${customerId})?\nThis action cannot be undone. Past sales records will retain the customer name but this profile will be removed.`)) {
            try {
                await db.ref(`${CUSTOMERS_PATH}/${customerId}`).remove();
                console.log(`Customer "${customerName}" deleted successfully.`);
                // The real-time listener in loadCustomers will automatically refresh the table.
                // No need to manually call loadCustomers() here.
                alert(`Customer "${customerName}" deleted.`);
            } catch (error) {
                console.error(`Error deleting customer ${customerId}:`, error);
                alert('Error deleting customer. Check console.');
            }
        }
    }

    // --- Initial Load ---
    loadCustomers();
});