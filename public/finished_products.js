// === finished_products.js ===

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

    const addNewProductBtn = document.getElementById('addNewProductBtn');
    const productFormModal = document.getElementById('productFormModal');
    const closeModalButton = document.querySelector('#productFormModal .modal-close-button');
    const productForm = document.getElementById('productForm');
    const productFormTitle = document.getElementById('productFormTitle');
    const saveProductBtn = document.getElementById('saveProductBtn');
    
    const productCodeInput = document.getElementById('productCode');
    const itemNameInput = document.getElementById('itemName');
    const standardWeightInput = document.getElementById('standardWeight');
    const weightUnitInput = document.getElementById('weightUnit');
    const mrpInput = document.getElementById('mrp');
    const sellingPriceInput = document.getElementById('sellingPrice');
    const unitOfMeasureInput = document.getElementById('unitOfMeasure');
    const openingStockInput = document.getElementById('openingStock'); // New
    const openingStockGroup = document.getElementById('openingStockGroup'); // New
    const productEditIdInput = document.getElementById('productEditId');

    const finishedProductsTableBody = document.getElementById('finishedProductsTableBody');
    const searchProductsInput = document.getElementById('searchProductsInput');

    const lookupProductCodeInput = document.getElementById('lookupProductCode');
    const lookupProductNameInput = document.getElementById('lookupProductName');
    const lookupBatchNumberInput = document.getElementById('lookupBatchNumber');
    const lookupSuggestionsListEl = document.getElementById('lookupSuggestionsList');

    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts';
    const PRODUCTION_LOG_PATH = 'productionLog'; 

    let allDefinedProducts = {}; 
    let productionLogCacheForLookup = [];

    // --- Modal Functionality ---
    if (addNewProductBtn) {
        addNewProductBtn.onclick = () => {
            productForm.reset();
            productEditIdInput.value = ''; 
            productCodeInput.disabled = false; 
            productFormTitle.textContent = 'Add New Finished Product';
            saveProductBtn.innerHTML = '<i class="fas fa-save fa-fw"></i> Save Product Definition';
            openingStockGroup.style.display = 'block'; // Show opening stock for new product
            openingStockInput.value = '0'; // Default opening stock to 0
            lookupSuggestionsListEl.innerHTML = '';
            lookupProductCodeInput.value = ''; lookupProductNameInput.value = ''; lookupBatchNumberInput.value = '';
            productFormModal.style.display = 'flex';
            productCodeInput.focus();
        };
    }
    if (closeModalButton) closeModalButton.onclick = () => productFormModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === productFormModal) productFormModal.style.display = 'none';
    };

    async function cacheProductionLogForSuggestions() {
        try {
            const snapshot = await db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp').limitToLast(100).once('value');
            productionLogCacheForLookup = [];
            if(snapshot.exists()){
                snapshot.forEach(child => {
                    const data = child.val();
                    if(data.finishedProductCode && data.finishedProductName) {
                        const existing = productionLogCacheForLookup.find(item => 
                            item.code === data.finishedProductCode && 
                            item.name === data.finishedProductName && 
                            item.batch === (data.batchNumber || 'N/A')
                        );
                        if(!existing){
                             productionLogCacheForLookup.push({
                                code: data.finishedProductCode,
                                name: data.finishedProductName,
                                batch: data.batchNumber || 'N/A'
                            });
                        }
                    }
                });
            }
        } catch(error){ console.error("Error caching production log for suggestions:", error); }
    }

    function displayLookupSuggestions(searchTerm, searchType) {
        lookupSuggestionsListEl.innerHTML = '';
        if (!searchTerm) return;
        const filtered = productionLogCacheForLookup.filter(item => {
            const term = searchTerm.toLowerCase();
            if (searchType === 'code') return item.code.toLowerCase().includes(term);
            if (searchType === 'name') return item.name.toLowerCase().includes(term);
            if (searchType === 'batch') return item.batch.toLowerCase().includes(term);
            return false;
        }).slice(0, 5); 

        if (filtered.length > 0) {
            filtered.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `Code: ${item.code}, Name: ${item.name}, Batch: ${item.batch}`;
                li.onclick = async () => {
                    productCodeInput.value = item.code;
                    itemNameInput.value = item.name;
                    lookupSuggestionsListEl.innerHTML = ''; 
                    lookupProductCodeInput.value = ''; lookupProductNameInput.value = ''; lookupBatchNumberInput.value = '';
                    
                    const existingDefSnapshot = await db.ref(`${DEFINED_PRODUCTS_PATH}/${item.code}`).once('value');
                    if (existingDefSnapshot.exists()) {
                        openEditModal(item.code, existingDefSnapshot.val());
                    } else {
                        productEditIdInput.value = ''; 
                        productCodeInput.disabled = false; 
                        productFormTitle.textContent = 'Add New Finished Product (Pre-filled)';
                        saveProductBtn.innerHTML = '<i class="fas fa-save fa-fw"></i> Save Product Definition';
                        openingStockGroup.style.display = 'block'; // Show for new pre-filled
                        openingStockInput.value = '0'; // Default for new pre-filled
                    }
                };
                lookupSuggestionsListEl.appendChild(li);
            });
        } else {
            lookupSuggestionsListEl.innerHTML = '<li>No matches in production log.</li>';
        }
    }

    if(lookupProductCodeInput) lookupProductCodeInput.addEventListener('input', (e) => displayLookupSuggestions(e.target.value, 'code'));
    if(lookupProductNameInput) lookupProductNameInput.addEventListener('input', (e) => displayLookupSuggestions(e.target.value, 'name'));
    if(lookupBatchNumberInput) lookupBatchNumberInput.addEventListener('input', (e) => displayLookupSuggestions(e.target.value, 'batch'));

    function loadDefinedProducts() {
        const productsRef = db.ref(DEFINED_PRODUCTS_PATH).orderByChild('itemName');
        productsRef.on('value', snapshot => {
            allDefinedProducts = snapshot.val() || {};
            displayFilteredProducts();
        });
    }

    function displayFilteredProducts() {
        finishedProductsTableBody.innerHTML = '';
        const searchTerm = searchProductsInput.value.toLowerCase();
        let productDisplayed = false;
        Object.keys(allDefinedProducts).sort((a,b) => allDefinedProducts[a].itemName.localeCompare(allDefinedProducts[b].itemName)).forEach(productCode => { // Sort by item name for display
            const product = allDefinedProducts[productCode];
            if (product.itemName.toLowerCase().includes(searchTerm) || product.productCode.toLowerCase().includes(searchTerm)) {
                renderProductRow(productCode, product);
                productDisplayed = true;
            }
        });
        if(!productDisplayed){
            const row = finishedProductsTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 8;
            cell.textContent = searchTerm ? 'No products match search.' : 'No finished products defined.';
            cell.style.textAlign = 'center'; cell.style.padding = '1rem'; cell.style.color = 'var(--text-color-muted)';
        }
    }
    if(searchProductsInput) searchProductsInput.addEventListener('input', displayFilteredProducts);

    function renderProductRow(productCode, data) {
        const row = finishedProductsTableBody.insertRow(); row.setAttribute('data-id', productCode);
        row.insertCell().textContent = data.productCode || productCode;
        row.insertCell().textContent = data.itemName || 'N/A';
        const weightCell = row.insertCell(); weightCell.textContent = `${data.standardWeight || 0} ${data.weightUnit || ''}`; weightCell.classList.add('text-right');
        const mrpCell = row.insertCell(); mrpCell.textContent = data.mrp ? parseFloat(data.mrp).toFixed(2) : '0.00'; mrpCell.classList.add('text-right');
        const spCell = row.insertCell(); spCell.textContent = data.sellingPrice ? parseFloat(data.sellingPrice).toFixed(2) : '0.00'; spCell.classList.add('text-right');
        const stockCell = row.insertCell(); stockCell.textContent = data.currentStock || 0; stockCell.classList.add('text-right', 'font-weight-bold');
        const soldCell = row.insertCell(); soldCell.textContent = data.totalSold || 0; soldCell.classList.add('text-right');
        const actionsCell = row.insertCell(); actionsCell.classList.add('actions', 'text-center');
        const editBtn = document.createElement('button'); editBtn.innerHTML = '<i class="fas fa-edit fa-fw"></i> Edit'; editBtn.classList.add('btn', 'btn-warning', 'btn-sm'); editBtn.onclick = () => openEditModal(productCode, data);
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '<i class="fas fa-trash fa-fw"></i> Delete'; deleteBtn.classList.add('btn', 'btn-danger', 'btn-sm'); deleteBtn.onclick = () => deleteProduct(productCode, data.itemName, data.currentStock);
        actionsCell.appendChild(editBtn); actionsCell.appendChild(deleteBtn);
    }

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = productCodeInput.value.trim().toUpperCase();
            const itemName = itemNameInput.value.trim();
            const editId = productEditIdInput.value; 
            if (!code || !itemName || !sellingPriceInput.value || !unitOfMeasureInput.value) {
                alert('Item Code, Name, Selling Price, and Unit of Measure are required.'); return;
            }
            const productData = {
                productCode: code, itemName: itemName,
                standardWeight: parseFloat(standardWeightInput.value) || 0,
                weightUnit: weightUnitInput.value.trim() || null,
                mrp: parseFloat(mrpInput.value) || 0,
                sellingPrice: parseFloat(sellingPriceInput.value),
                unitOfMeasure: unitOfMeasureInput.value.trim(),
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            try {
                if (editId && editId === code) { 
                    const existingProduct = allDefinedProducts[editId];
                    productData.currentStock = existingProduct.currentStock || 0; // Preserve stock
                    productData.totalSold = existingProduct.totalSold || 0;     // Preserve sold
                    productData.createdAt = existingProduct.createdAt || firebase.database.ServerValue.TIMESTAMP;
                    await db.ref(`${DEFINED_PRODUCTS_PATH}/${editId}`).update(productData);
                    alert(`Product "${itemName}" updated successfully!`);
                } else { 
                    const existingProductSnapshot = await db.ref(`${DEFINED_PRODUCTS_PATH}/${code}`).once('value');
                    if (existingProductSnapshot.exists()) {
                        alert(`Product Code "${code}" already exists. Cannot add duplicate.`); productCodeInput.focus(); return;
                    }
                    productData.createdAt = firebase.database.ServerValue.TIMESTAMP;
                    productData.currentStock = parseInt(openingStockInput.value) || 0; // Use opening stock for NEW products
                    productData.totalSold = 0;
                    await db.ref(`${DEFINED_PRODUCTS_PATH}/${code}`).set(productData);
                    alert(`Product "${itemName}" added successfully with opening stock of ${productData.currentStock}!`);
                }
                productFormModal.style.display = 'none'; productForm.reset();
            } catch (error) { console.error("Error saving product:", error); alert('Error saving. Check console.'); }
        });
    }

    function openEditModal(productCode, data) {
        productForm.reset();
        productFormTitle.textContent = `Edit Product: ${data.itemName || productCode}`;
        saveProductBtn.innerHTML = '<i class="fas fa-save fa-fw"></i> Update Product Definition';
        productEditIdInput.value = productCode;
        productCodeInput.value = data.productCode || productCode;
        productCodeInput.disabled = true; 
        itemNameInput.value = data.itemName || '';
        standardWeightInput.value = data.standardWeight || '';
        weightUnitInput.value = data.weightUnit || '';
        mrpInput.value = data.mrp || '';
        sellingPriceInput.value = data.sellingPrice || '';
        unitOfMeasureInput.value = data.unitOfMeasure || '';
        openingStockGroup.style.display = 'none'; // Hide opening stock when editing
        lookupSuggestionsListEl.innerHTML = ''; 
        lookupProductCodeInput.value = ''; lookupProductNameInput.value = ''; lookupBatchNumberInput.value = '';
        productFormModal.style.display = 'flex';
    }

    async function deleteProduct(productCode, itemName, currentStock) {
        if (!productCode) return;
        let confirmMessage = `DELETE product definition for "${itemName}" (Code: ${productCode})? This cannot be undone.`;
        if (currentStock && currentStock > 0) {
            confirmMessage += `\n\nWARNING: This product has ${currentStock} units in stock. Deleting the definition will not remove the stock records from production log but will make this product unmanageable here.`;
        }
        if (confirm(confirmMessage)) {
            try {
                await db.ref(`${DEFINED_PRODUCTS_PATH}/${productCode}`).remove();
                alert(`Product "${itemName}" definition deleted.`);
            } catch (error) { console.error("Error deleting product:", error); alert('Error deleting.'); }
        }
    }

    async function initializePage() {
        await cacheProductionLogForSuggestions();
        loadDefinedProducts(); 
    }
    initializePage();
});