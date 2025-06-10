document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY", // Replace with your actual Firebase config
        authDomain: "ecommerceapp-dab53.firebaseapp.com",
        databaseURL: "https://ecommerceapp-dab53-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ecommerceapp-dab53",
        storageBucket: "ecommerceapp-dab53.appspot.com",
        messagingSenderId: "429988301014",
        appId: "1:429988301014:web:4f09bb412b6cf0b4a82177"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const { jsPDF } = window.jspdf;

    // --- Navbar Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // --- DOM Elements for Dynamic Content ---
    const rawTeaTablesCountEl = document.getElementById('rawTeaTablesCount');
    const packingMaterialTablesCountEl = document.getElementById('packingMaterialTablesCount');
    const definedProductsCountEl = document.getElementById('definedProductsCount');
    const customersCountEl = document.getElementById('customersCount');
    const totalSalesCountEl = document.getElementById('totalSalesCount');
    const totalProductionsCountEl = document.getElementById('totalProductionsCount'); // Added element
    const latestSaleDisplayEl = document.getElementById('latestSaleDisplay');
    const activeVehiclesDisplayEl = document.getElementById('activeVehiclesDisplay');
    const recentActivityListEl = document.getElementById('recentActivityList');
    const salesChartCanvas = document.getElementById('salesChartCanvas');
    const chartFilterButtons = document.querySelectorAll('.chart-filter-btn');
    const salesChartMessageEl = document.getElementById('salesChartMessage');

    // --- Firebase Paths (Corrected to match your JSON structure) ---
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts_v2';
    const CUSTOMERS_PATH = 'customers';
    const SALES_LOG_PATH = 'salesLog';
    const DELIVERY_LOGS_PATH = 'deliveryLogs';
    const PRODUCTION_LOG_PATH = 'productionLog'; // Added path

    let salesChartInstance = null;

    // --- Core Data Fetching Functions ---

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

    async function fetchLatestSale() {
        if (!latestSaleDisplayEl) return;
        latestSaleDisplayEl.innerHTML = '<p class="text-muted">Loading...</p>';
        try {
            const snapshot = await db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(1).once('value');
            if (snapshot.exists()) {
                let latestSaleData;
                snapshot.forEach(child => { latestSaleData = {id: child.key, ...child.val()}; });

                const saleDisplayId = latestSaleData.saleId || (latestSaleData.id ? latestSaleData.id.slice(-6).toUpperCase() : 'N/A');
                latestSaleDisplayEl.innerHTML = `
                    <div class="latest-sale-item"><strong>Sale ID:</strong> ${saleDisplayId}</div>
                    <div class="latest-sale-item"><strong>Customer:</strong> ${latestSaleData.customerName || 'N/A'}</div>
                    <div class="latest-sale-item"><strong>Date:</strong> ${latestSaleData.saleDate || 'N/A'}</div>
                    <div class="latest-sale-item latest-sale-amount"><strong>Amount:</strong> Rs. ${parseFloat(latestSaleData.grandTotal || 0).toFixed(2)}</div>
                `;
            } else {
                latestSaleDisplayEl.innerHTML = '<p class="no-data-message">No sales recorded yet.</p>';
            }
        } catch (error) {
            console.error("Error fetching latest sale:", error);
            latestSaleDisplayEl.innerHTML = '<p class="text-danger">Could not load latest sale.</p>';
        }
    }

    async function fetchActiveVehicles() {
        if (!activeVehiclesDisplayEl) return;
        activeVehiclesDisplayEl.innerHTML = '<p class="text-muted">Loading...</p>';
        try {
            const snapshot = await db.ref(DELIVERY_LOGS_PATH).once('value');
            if (snapshot.exists()) {
                const activeVehicles = new Map();
                snapshot.forEach(child => {
                    const log = child.val();
                    if (log.stockInVehicle > 0) {
                        activeVehicles.set(log.vehicleNumber, {
                            driver: log.driverName,
                            stock: log.stockInVehicle
                        });
                    }
                });

                if (activeVehicles.size > 0) {
                    activeVehiclesDisplayEl.innerHTML = '';
                    activeVehicles.forEach((data, vehicleNumber) => {
                        const item = document.createElement('div');
                        item.className = 'vehicle-item';
                        item.innerHTML = `
                            <div class="vehicle-info">
                                <strong>${vehicleNumber}</strong>
                                <span>(Driver: ${data.driver})</span>
                            </div>
                            <div class="vehicle-stock">${data.stock} units</div>
                        `;
                        activeVehiclesDisplayEl.appendChild(item);
                    });
                } else {
                    activeVehiclesDisplayEl.innerHTML = '<p class="no-data-message">No vehicles currently on delivery.</p>';
                }
            } else {
                activeVehiclesDisplayEl.innerHTML = '<p class="no-data-message">No delivery data available.</p>';
            }
        } catch (error) {
            console.error("Error fetching active vehicles:", error);
            activeVehiclesDisplayEl.innerHTML = '<p class="text-danger">Could not load vehicle data.</p>';
        }
    }
    
    async function fetchSalesDataForChart(period = 7) {
        const salesDataByDate = {};
        const today = new Date(); // Use current date for chart
        today.setHours(0, 0, 0, 0);

        let startDate = new Date(today);
        if (period === 'thisMonth') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
            startDate.setDate(today.getDate() - (parseInt(period) - 1));
        }
        
        const startDateString = startDate.toISOString().split('T')[0];
        const endDateString = today.toISOString().split('T')[0];

        try {
            const snapshot = await db.ref(SALES_LOG_PATH).orderByChild('saleDate').startAt(startDateString).endAt(endDateString).once('value');
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const sale = child.val();
                    if (sale.saleDate && typeof sale.grandTotal === 'number') {
                        salesDataByDate[sale.saleDate] = (salesDataByDate[sale.saleDate] || 0) + sale.grandTotal;
                    }
                });
            }
            
            const labels = [];
            const dataPoints = [];
            let currentDateIter = new Date(startDate);
            while (currentDateIter <= today) {
                const dateKey = currentDateIter.toISOString().split('T')[0];
                labels.push(dateKey.slice(5)); // Format as MM-DD
                dataPoints.push(salesDataByDate[dateKey] || 0);
                currentDateIter.setDate(currentDateIter.getDate() + 1);
            }
            return { labels, dataPoints };
        } catch (error) {
            console.error("Error fetching sales data for chart:", error);
            return { labels: [], dataPoints: [] };
        }
    }

    async function renderSalesChart(period = 7) {
        if (!salesChartCanvas || !window.Chart) return;

        const { labels, dataPoints } = await fetchSalesDataForChart(period);
        const hasData = labels.length > 0 && dataPoints.some(p => p > 0);

        if (salesChartMessageEl) salesChartMessageEl.style.display = hasData ? 'none' : 'block';
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(salesChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `Daily Sales (Rs.)`,
                    data: dataPoints,
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { callback: value => `Rs. ${value}` } } },
                plugins: { legend: { display: true, position: 'top' } }
            }
        });
    }

    chartFilterButtons.forEach(button => {
        button.addEventListener('click', function() {
            chartFilterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            renderSalesChart(this.dataset.period);
        });
    });

    function timeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.round((now - timestamp) / 1000);
        if (seconds < 2) return 'just now';
        if (seconds < 60) return `${seconds} secs ago`;
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes} mins ago`;
        return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    async function fetchRecentActivities() {
        if (!recentActivityListEl) return;
        recentActivityListEl.innerHTML = '<li class="activity-item-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading...</li>';
        let activities = [];
        const activityLimit = 3; 

        try {
            // Updated to fetch from productionLog as well
            const fetchPromises = [
                db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(activityLimit).once('value'),
                db.ref(CUSTOMERS_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(DEFINED_PRODUCTS_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(RAW_TEA_METADATA_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(PACKING_MATERIAL_METADATA_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp').limitToLast(activityLimit).once('value'),
            ];

            const snapshots = await Promise.all(fetchPromises);

            if(snapshots[0].exists()) snapshots[0].forEach(c => {const d=c.val(); activities.push({ts:d.timestamp,type:'<i class="fas fa-file-invoice-dollar activity-icon-yellow fa-fw"></i>',desc:`New Sale to <strong>${d.customerName||'N/A'}</strong> for Rs. ${parseFloat(d.grandTotal||0).toFixed(2)}`});});
            if(snapshots[1].exists()) snapshots[1].forEach(c => {const d=c.val(); activities.push({ts:d.createdAt,type:'<i class="fas fa-user-plus activity-icon-purple fa-fw"></i>',desc:`New Customer: <strong>${d.name||'N/A'}</strong>`});});
            if(snapshots[2].exists()) snapshots[2].forEach(c => {const d=c.val(); activities.push({ts:d.createdAt,type:'<i class="fas fa-mug-hot activity-icon-green fa-fw"></i>',desc:`New Product defined: <strong>${d.itemName||c.key}</strong>`});});
            if(snapshots[3].exists()) snapshots[3].forEach(c => {activities.push({ts:c.val().createdAt,type:'<i class="fas fa-boxes-stacked activity-icon-blue fa-fw"></i>',desc:`New Raw Tea type: <strong>${c.key}</strong>`});});
            if(snapshots[4].exists()) snapshots[4].forEach(c => {activities.push({ts:c.val().createdAt,type:'<i class="fas fa-box-archive activity-icon-orange fa-fw"></i>',desc:`New Packing Material: <strong>${c.key}</strong>`});});
            
            // Added logic for production log activity
            if(snapshots[5].exists()) snapshots[5].forEach(c => {
                const d = c.val();
                activities.push({
                    ts: d.timestamp,
                    type:'<i class="fas fa-industry activity-icon-teal fa-fw"></i>',
                    desc:`Production run: <strong>${d.quantityProduced || 0} units</strong> of <strong>${d.finishedProductName || 'product'}</strong> created.`
                });
            });

            activities.sort((a, b) => (b.ts || 0) - (a.ts || 0));
            const displayActivities = activities.slice(0, 7); 

            recentActivityListEl.innerHTML = '';
            if (displayActivities.length > 0) {
                displayActivities.forEach(act => {
                    const li = document.createElement('li');
                    li.classList.add('activity-item');
                    li.innerHTML = `${act.type}<div class="activity-details"><p class="activity-description">${act.desc}</p><p class="activity-meta">${timeAgo(act.ts)}</p></div>`;
                    recentActivityListEl.appendChild(li);
                });
            } else {
                recentActivityListEl.innerHTML = '<li class="activity-item-placeholder">No recent system activities.</li>';
            }
        } catch (error) {
            console.error("Error fetching recent activities:", error);
            recentActivityListEl.innerHTML = '<li class="activity-item-placeholder text-danger">Could not load activities.</li>';
        }
    }
    
    // --- Main Function to Load All Dashboard Data ---
    function loadDashboardData() {
        // Fetch counts for all data that exists.
        fetchAndDisplayCount(RAW_TEA_METADATA_PATH, rawTeaTablesCountEl);
        fetchAndDisplayCount(PACKING_MATERIAL_METADATA_PATH, packingMaterialTablesCountEl);
        fetchAndDisplayCount(DEFINED_PRODUCTS_PATH, definedProductsCountEl);
        fetchAndDisplayCount(CUSTOMERS_PATH, customersCountEl);
        fetchAndDisplayCount(SALES_LOG_PATH, totalSalesCountEl);
        
        // This line is now active and will fetch the count from the 'productionLog'
        fetchAndDisplayCount(PRODUCTION_LOG_PATH, totalProductionsCountEl);
        
        fetchLatestSale();
        fetchActiveVehicles();
        renderSalesChart(7); // Default to last 7 days
        fetchRecentActivities();
    }

    // --- Initial Call ---
    loadDashboardData();
});