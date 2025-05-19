// === index.js (Dashboard JavaScript) ===

document.addEventListener('DOMContentLoaded', () => {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyA-M8XsFZaZPu_lBIx0TbqcmzhTXeHRjQM",
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
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

    // --- DOM Elements for Dynamic Content ---
    const rawTeaTablesCountEl = document.getElementById('rawTeaTablesCount');
    const packingMaterialTablesCountEl = document.getElementById('packingMaterialTablesCount');
    const definedProductsCountEl = document.getElementById('definedProductsCount');
    const customersCountEl = document.getElementById('customersCount');
    const recentActivityListEl = document.getElementById('recentActivityList');

    // Firebase Paths for Counts and Activity
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const CUSTOMERS_PATH = 'customers'; // Assumed path for customers
    const DEFINED_PRODUCTS_PATH = 'definedProducts'; // Assumed path for product definitions
    const PRODUCTION_LOG_PATH = 'productionLog';

    // --- Helper Function to Fetch and Display Counts ---
    async function fetchAndDisplayCount(path, element) {
        if (!element) return;
        try {
            const snapshot = await db.ref(path).once('value');
            const data = snapshot.val();
            const count = data ? Object.keys(data).length : 0;
            element.textContent = count;
        } catch (error) {
            console.error(`Error fetching count from ${path}:`, error);
            element.textContent = 'N/A';
        }
    }

    // --- Helper Function to Format Time Ago ---
    function timeAgo(timestamp) {
        if (!timestamp) return 'a while ago';
        const now = Date.now();
        const seconds = Math.round((now - timestamp) / 1000);

        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds} seconds ago`;
        
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;

        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours} hours ago`;

        const days = Math.round(hours / 24);
        if (days < 7) return `${days} days ago`;

        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }


    // --- Fetch and Display Recent Activities ---
    async function fetchRecentActivities() {
        if (!recentActivityListEl) return;
        recentActivityListEl.innerHTML = '<li class="activity-item-placeholder">Loading activities...</li>';
        
        let activities = [];

        try {
            // 1. Recent Production Logs (Last 3)
            const prodSnapshot = await db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp').limitToLast(3).once('value');
            if (prodSnapshot.exists()) {
                prodSnapshot.forEach(child => {
                    const data = child.val();
                    activities.push({
                        type: 'PRODUCT_CREATED',
                        description: `New product batch logged: <strong>${data.finishedProductName || 'Unknown Product'}</strong> (Qty: ${data.quantityProduced || 0}).`,
                        timestamp: data.timestamp, // Ensure your production log saves a server timestamp
                        icon: 'fas fa-industry activity-icon-blue', // Using existing color scheme
                        link: `production.html#log-${child.key}` // Example link
                    });
                });
            }

            // 2. Recently Created Raw Tea Tables (Last 2)
            const rawTeaMetaSnapshot = await db.ref(RAW_TEA_METADATA_PATH).orderByChild('createdAt').limitToLast(2).once('value');
            if (rawTeaMetaSnapshot.exists()) {
                rawTeaMetaSnapshot.forEach(child => {
                    activities.push({
                        type: 'RAW_TEA_TABLE_CREATED',
                        description: `New Raw Tea table created: <strong>${child.key}</strong>.`,
                        timestamp: child.val().createdAt,
                        icon: 'fas fa-boxes-stacked activity-icon-green',
                        link: `raw_tea.html#table-${child.key}`
                    });
                });
            }

            // 3. Recently Created Packing Material Tables (Last 2)
            const packingMetaSnapshot = await db.ref(PACKING_MATERIAL_METADATA_PATH).orderByChild('createdAt').limitToLast(2).once('value');
            if (packingMetaSnapshot.exists()) {
                packingMetaSnapshot.forEach(child => {
                    activities.push({
                        type: 'PACKING_TABLE_CREATED',
                        description: `New Packing Material table created: <strong>${child.key}</strong>.`,
                        timestamp: child.val().createdAt,
                        icon: 'fas fa-box-archive activity-icon-purple',
                        link: `packing_material.html#table-${child.key}`
                    });
                });
            }
            
            // Sort all collected activities by timestamp (newest first)
            activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            // Limit to about 5-7 total activities for display
            const displayActivities = activities.slice(0, 5);

            recentActivityListEl.innerHTML = ''; // Clear placeholder
            if (displayActivities.length > 0) {
                displayActivities.forEach(activity => {
                    const li = document.createElement('li');
                    li.classList.add('activity-item');
                    li.innerHTML = `
                        <i class="${activity.icon || 'fas fa-info-circle activity-icon-muted'} activity-icon"></i>
                        <div class="activity-details">
                            <p class="activity-description">${activity.description}</p>
                            <p class="activity-meta">${timeAgo(activity.timestamp)}</p>
                        </div>
                    `;
                    // Could add link to li.onclick = () => window.location.href = activity.link;
                    recentActivityListEl.appendChild(li);
                });
            } else {
                recentActivityListEl.innerHTML = '<li class="activity-item-placeholder">No recent activities to display.</li>';
            }

        } catch (error) {
            console.error("Error fetching recent activities:", error);
            recentActivityListEl.innerHTML = '<li class="activity-item-placeholder">Could not load activities.</li>';
        }
    }


    // --- Load All Dashboard Data on Page Load ---
    function loadDashboardData() {
        fetchAndDisplayCount(RAW_TEA_METADATA_PATH, rawTeaTablesCountEl);
        fetchAndDisplayCount(PACKING_MATERIAL_METADATA_PATH, packingMaterialTablesCountEl);
        fetchAndDisplayCount(DEFINED_PRODUCTS_PATH, definedProductsCountEl); // Make sure this path exists in your DB
        fetchAndDisplayCount(CUSTOMERS_PATH, customersCountEl);             // Make sure this path exists
        fetchRecentActivities();
    }

    // Initialize
    loadDashboardData();

    // Add anchors to Quick Action links if they exist in HTML
    // This is to potentially scroll to the "Add New Table" button on the target pages
    // For this to work, those buttons on raw_tea.html etc. would need an ID like `addNewTableBtnAnchor`
    // Or, you'd typically link to the page and the user clicks the button there.
    // For simplicity, direct links are fine. The #hash part can be used by target page's JS.
});