document.addEventListener('DOMContentLoaded', () => {
    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM", // Replace with your actual API key if different
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    // Initialize Firebase (ensure it's only done once)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database(); // Use Realtime Database

    // DOM Elements
    const addNewTableBtn = document.getElementById('addNewTableBtn');
    const newTableModal = document.getElementById('newTableModal');
    const closeButton = document.querySelector('.modal .close-button'); // Specific selector
    const tableNameInput = document.getElementById('tableNameInput');
    const existingTableSuggestions = document.getElementById('existingTableSuggestions');
    const createOrUpdateTableBtn = document.getElementById('createOrUpdateTableBtn');
    const currentTableSection = document.getElementById('currentTableSection');
    const currentTableNameDisplay = document.getElementById('currentTableName');
    const materialTableBody = document.getElementById('materialTableBody');
    const addRowForm = document.getElementById('addRowForm');
    const allTablesList = document.getElementById('allTablesList');
    const searchTableInput = document.getElementById('searchTableInput');

    let activeTableName = null;
    let existingTableNames = [];

    // --- Modal Functionality ---
    if (addNewTableBtn) {
        addNewTableBtn.onclick = () => {
            if (newTableModal) newTableModal.style.display = 'block';
            if (tableNameInput) tableNameInput.value = '';
            if (existingTableSuggestions) existingTableSuggestions.innerHTML = '';
            fetchExistingTableNames();
        };
    }

    if (closeButton) {
        closeButton.onclick = () => {
            if (newTableModal) newTableModal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (newTableModal && event.target == newTableModal) {
            newTableModal.style.display = 'none';
        }
    };

    // --- Table Name Input and Suggestions ---
    if (tableNameInput) {
        tableNameInput.addEventListener('input', () => {
            const inputText = tableNameInput.value.toLowerCase();
            if (existingTableSuggestions) existingTableSuggestions.innerHTML = '';

            if (inputText.length > 0 && Array.isArray(existingTableNames)) {
                const suggestions = existingTableNames.filter(name => name.toLowerCase().includes(inputText));
                suggestions.forEach(name => {
                    const li = document.createElement('li');
                    li.textContent = name;
                    li.onclick = () => {
                        tableNameInput.value = name;
                        if (existingTableSuggestions) existingTableSuggestions.innerHTML = '';
                    };
                    if (existingTableSuggestions) existingTableSuggestions.appendChild(li);
                });
            }
        });
    }

    // --- Fetch Existing Table Names from RTDB ---
    async function fetchExistingTableNames() {
        try {
            const snapshot = await db.ref('inventoryTables').once('value');
            const data = snapshot.val();
            existingTableNames = data ? Object.keys(data) : [];
        } catch (error) {
            console.error("Error fetching table names: ", error);
            existingTableNames = []; // Ensure it's an array on error
        }
        populateAllTablesList(); // Always attempt to populate the list
    }

    // --- Create or Update Table (Metadata in RTDB) ---
    if (createOrUpdateTableBtn) {
        createOrUpdateTableBtn.onclick = async () => {
            if (!tableNameInput) return;
            const tableName = tableNameInput.value.trim();
            if (!tableName) {
                alert('Table name cannot be empty.');
                return;
            }

            activeTableName = tableName;
            if (currentTableNameDisplay) currentTableNameDisplay.textContent = tableName;
            if (currentTableSection) currentTableSection.classList.remove('hidden');
            if (newTableModal) newTableModal.style.display = 'none';

            if (!existingTableNames.includes(tableName)) {
                try {
                    await db.ref(`inventoryTables/${tableName}`).set({ createdAt: firebase.database.ServerValue.TIMESTAMP });
                    existingTableNames.push(tableName); // Update local cache
                    populateAllTablesList(); // Refresh the list at the bottom
                    console.log(`Table metadata for '${tableName}' created.`);
                } catch (error) {
                    console.error("Error creating table metadata: ", error);
                    alert('Error creating table metadata.');
                    return;
                }
            }
            loadTableData(tableName);
        };
    }

    // --- Load Table Data from RTDB ---
    async function loadTableData(tableName) {
        if (!tableName || !materialTableBody) return;
        materialTableBody.innerHTML = ''; // Clear existing rows
        try {
            const snapshot = await db.ref(tableName).orderByChild('inflowDate').once('value'); // Assuming inflowDate is primary sort key
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => { // .forEach maintains order from orderByChild
                    renderRow(childSnapshot.key, childSnapshot.val());
                });
            } else {
                console.log(`No data found for table ${tableName}`);
            }
        } catch (error) {
            console.error(`Error loading data for table ${tableName}: `, error);
        }
    }

    // --- Render a Single Row in the Table ---
    function renderRow(docId, data) {
        if (!materialTableBody) return;
        const row = materialTableBody.insertRow();
        row.setAttribute('data-id', docId);

        // Match cells to your table structure (1 main date + 6 inflow + 5 outflow + 3 balance + 1 actions = 16 cells)
        row.insertCell().textContent = data.inflowDate || ''; // Main date, assumed to be inflow date

        // Inflow
        row.insertCell().textContent = data.inflowSupplier || '';
        row.insertCell().textContent = data.inflowEstate || '';
        row.insertCell().textContent = data.inflowGrade || '';
        row.insertCell().textContent = data.inflowBagWeight || '';
        row.insertCell().textContent = data.inflowBags || '';
        const totalInflowWeight = (parseFloat(data.inflowBagWeight) && parseInt(data.inflowBags))
            ? (parseFloat(data.inflowBagWeight) * parseInt(data.inflowBags)).toFixed(2) // .toFixed(2) for consistency
            : (data.inflowTotalWeight || '');
        row.insertCell().textContent = totalInflowWeight;

        // Outflow
        row.insertCell().textContent = data.outflowDate || ''; // Outflow Date
        row.insertCell().textContent = data.outflowEstate || '';
        row.insertCell().textContent = data.outflowGrade || '';
        row.insertCell().textContent = data.outflowProduct || '';
        row.insertCell().textContent = data.outflowWeight || '';

        // Balance
        row.insertCell().textContent = data.balanceEstate || '';
        row.insertCell().textContent = data.balanceGrade || '';
        row.insertCell().textContent = data.balanceQty || '';

        // Actions
        const actionsCell = row.insertCell();
        actionsCell.classList.add('actions');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.onclick = () => editRow(docId, data);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => deleteRow(docId);

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    }

    // --- Add New Row to RTDB ---
    if (addRowForm) {
        addRowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeTableName) {
                alert('Please select or create a table first.');
                return;
            }

            const inflowBagWeightVal = parseFloat(document.getElementById('inflowBagWeight').value) || 0;
            const inflowBagsVal = parseInt(document.getElementById('inflowBags').value) || 0;
            const inflowTotalWeightVal = inflowBagWeightVal * inflowBagsVal;

            const rowData = {
                inflowDate: document.getElementById('inflowDate').value, // Main date for the transaction
                inflowSupplier: document.getElementById('inflowSupplier').value,
                inflowEstate: document.getElementById('inflowEstate').value,
                inflowGrade: document.getElementById('inflowGrade').value,
                inflowBagWeight: inflowBagWeightVal || null,
                inflowBags: inflowBagsVal || null,
                inflowTotalWeight: inflowTotalWeightVal ? inflowTotalWeightVal.toFixed(2) : null,

                outflowDate: document.getElementById('outflowDate').value, // Specific date for outflow if different
                outflowEstate: document.getElementById('outflowEstate').value,
                outflowGrade: document.getElementById('outflowGrade').value,
                outflowProduct: document.getElementById('outflowProduct').value,
                outflowWeight: parseFloat(document.getElementById('outflowWeight').value) || null,

                balanceEstate: document.getElementById('balanceEstate').value,
                balanceGrade: document.getElementById('balanceGrade').value,
                balanceQty: parseFloat(document.getElementById('balanceQty').value) || null,
                createdAt: firebase.database.ServerValue.TIMESTAMP // Timestamp for record creation
            };

            try {
                const newRowRef = db.ref(activeTableName).push(); // Generates a unique ID
                await newRowRef.set(rowData);
                // renderRow(newRowRef.key, rowData); // Optimistic render
                loadTableData(activeTableName); // Or reload to ensure server values like timestamp are correct
                addRowForm.reset();
                console.log("Row added with ID: ", newRowRef.key);
            } catch (error) {
                console.error("Error adding new row: ", error);
                alert('Error adding row.');
            }
        });
    }

    // --- Edit Row (RTDB) ---
    function editRow(docId, currentData) {
        // This is a basic prompt-based edit. For a better UX, populate the addRowForm or a dedicated edit modal.
        const newInflowSupplier = prompt("Enter new Inflow Supplier:", currentData.inflowSupplier || "");
        // ... prompt for ALL other editable fields from your form ...
        const newOutflowProduct = prompt("Enter new Outflow Product:", currentData.outflowProduct || "");
        const newInflowDate = prompt("Enter new Inflow Date (YYYY-MM-DD):", currentData.inflowDate || "");


        const updatedFields = {};
        let hasChanges = false;

        // Example for one field, repeat for all fields you want to make editable
        if (newInflowSupplier !== null && newInflowSupplier !== (currentData.inflowSupplier || "")) {
            updatedFields.inflowSupplier = newInflowSupplier;
            hasChanges = true;
        }
        if (newOutflowProduct !== null && newOutflowProduct !== (currentData.outflowProduct || "")) {
            updatedFields.outflowProduct = newOutflowProduct;
            hasChanges = true;
        }
        if (newInflowDate !== null && newInflowDate !== (currentData.inflowDate || "")) {
            updatedFields.inflowDate = newInflowDate; // Update the date field
            hasChanges = true;
        }
        // ... and so on for all other fields from your form ...

        if (!hasChanges) {
            console.log("No changes made or dialog cancelled.");
            return; // User cancelled or made no changes
        }

        // Construct the full update object, preserving non-updated fields
        const updatePayload = { ...currentData, ...updatedFields, updatedAt: firebase.database.ServerValue.TIMESTAMP };


        db.ref(`${activeTableName}/${docId}`).update(updatePayload)
            .then(() => {
                console.log("Row updated successfully");
                loadTableData(activeTableName); // Reload to show changes
            })
            .catch(error => {
                console.error("Error updating row: ", error);
                alert('Error updating row.');
            });
    }

    // --- Delete Row (RTDB) ---
    async function deleteRow(docId) {
        if (!activeTableName) return;
        if (confirm('Are you sure you want to delete this row?')) {
            try {
                await db.ref(`${activeTableName}/${docId}`).remove();
                console.log("Row deleted successfully");
                loadTableData(activeTableName); // Reload table to reflect deletion
            } catch (error) {
                console.error("Error deleting row: ", error);
                alert('Error deleting row.');
            }
        }
    }

    // --- Populate "All Created Tables" List ---
    function populateAllTablesList() {
        if (!allTablesList || !searchTableInput || !Array.isArray(existingTableNames)) return;
        allTablesList.innerHTML = '';
        const searchTerm = searchTableInput.value.toLowerCase();

        existingTableNames
            .filter(name => name.toLowerCase().includes(searchTerm))
            .forEach(tableName => {
                const li = document.createElement('li');
                li.textContent = tableName;
                li.onclick = () => {
                    activeTableName = tableName;
                    if (currentTableNameDisplay) currentTableNameDisplay.textContent = tableName;
                    if (currentTableSection) currentTableSection.classList.remove('hidden');
                    loadTableData(tableName);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                const deleteTableBtn = document.createElement('button');
                deleteTableBtn.textContent = 'Delete Table';
                deleteTableBtn.onclick = (event) => {
                    event.stopPropagation(); // Prevent li click event when button is clicked
                    deleteEntireTable(tableName);
                };
                li.appendChild(deleteTableBtn);
                allTablesList.appendChild(li);
            });
    }

    // --- Delete Entire Table (Metadata and Data from RTDB) ---
    async function deleteEntireTable(tableNameToDelete) {
        if (confirm(`Are you sure you want to delete the entire table "${tableNameToDelete}" and all its data? This cannot be undone.`)) {
            try {
                // 1. Delete all data within the table's path in RTDB
                await db.ref(tableNameToDelete).remove();
                console.log(`All data in table '${tableNameToDelete}' deleted.`);

                // 2. Delete the table metadata from 'inventoryTables' in RTDB
                await db.ref(`inventoryTables/${tableNameToDelete}`).remove();
                console.log(`Metadata for table '${tableNameToDelete}' deleted.`);

                // 3. Update UI
                existingTableNames = existingTableNames.filter(name => name !== tableNameToDelete);
                populateAllTablesList();
                if (activeTableName === tableNameToDelete) {
                    if (currentTableSection) currentTableSection.classList.add('hidden');
                    activeTableName = null;
                    if (currentTableNameDisplay) currentTableNameDisplay.textContent = '';
                }
                alert(`Table "${tableNameToDelete}" deleted successfully.`);
            } catch (error) {
                console.error(`Error deleting table ${tableNameToDelete}: `, error);
                alert(`Error deleting table ${tableNameToDelete}. Check console for details.`);
            }
        }
    }

    // --- Search Table Functionality ---
    if (searchTableInput) {
        searchTableInput.addEventListener('input', populateAllTablesList);
    }

    // --- Initial Load ---
    fetchExistingTableNames(); // Fetch table names when the page loads and DOM is ready
});
// --- Navbar Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            // Toggle the 'hidden' class on the mobile menu
            mobileMenu.classList.toggle('hidden');
        });
        const mobileNavLinks = mobileMenu.querySelectorAll('a.mobile-navbar-item');

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Check if the menu is currently visible before trying to hide it
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                }
            });
        });
    } else {
        if (!mobileMenuButton) {
            console.warn('Mobile menu button with ID "mobile-menu-button" not found.');
        }
        if (!mobileMenu) {
            console.warn('Mobile menu with ID "mobile-menu" not found.');
        }
    }
