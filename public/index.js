// === index.js (Dashboard JavaScript) ===

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
    // Ensure jsPDF is available if you use generateAndShowInvoice here
    const { jsPDF } = (typeof window.jspdf !== 'undefined') ? window.jspdf : { jsPDF: null };


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
    const totalSalesCountEl = document.getElementById('totalSalesCount');
    const totalProductionsCountEl = document.getElementById('totalProductionsCount');
    
    const latestSaleDisplayEl = document.getElementById('latestSaleDisplay');
    const recentActivityListEl = document.getElementById('recentActivityList');
    const salesChartCanvas = document.getElementById('salesChartCanvas');
    const chartFilterButtons = document.querySelectorAll('.chart-filter-btn');
    const salesChartMessageEl = document.getElementById('salesChartMessage');

    // Firebase Paths
    const RAW_TEA_METADATA_PATH = 'rawTeaTableMetadata';
    const PACKING_MATERIAL_METADATA_PATH = 'packingMaterialTableMetadata';
    const DEFINED_PRODUCTS_PATH = 'definedFinishedProducts';
    const CUSTOMERS_PATH = 'customers';
    const SALES_LOG_PATH = 'salesLog';
    const PRODUCTION_LOG_PATH = 'productionLog';

    let salesChartInstance = null;

    async function fetchAndDisplayCount(path, element) {
        if (!element) {
            // console.warn(`Dashboard count: Element for path '${path}' not found in HTML.`);
            return;
        }
        try {
            // console.log(`Dashboard: Fetching count for path: ${path}`);
            const snapshot = await db.ref(path).once('value');
            const data = snapshot.val();
            // console.log(`Dashboard: Data for path ${path}:`, data);
            const count = data ? Object.keys(data).length : 0;
            element.textContent = count;
            // console.log(`Dashboard: Count for ${path} is ${count}`);
        } catch (error) {
            console.error(`Dashboard: Error fetching count from ${path}:`, error);
            element.textContent = 'N/A';
        }
    }

    async function fetchLatestSale() {
        if (!latestSaleDisplayEl) return;
        latestSaleDisplayEl.innerHTML = '<p class="text-muted">Loading latest sale...</p>';
        try {
            const snapshot = await db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(1).once('value');
            if (snapshot.exists()) {
                let latestSaleData;
                snapshot.forEach(child => { latestSaleData = {id: child.key, ...child.val()}; });

                if (latestSaleData) {
                    const saleDisplayId = latestSaleData.saleId || (latestSaleData.id ? latestSaleData.id.slice(-6).toUpperCase() : 'N/A');
                    latestSaleDisplayEl.innerHTML = `
                        <div class="latest-sale-item"><strong>Sale ID:</strong> ${saleDisplayId}</div>
                        <div class="latest-sale-item"><strong>Customer:</strong> ${latestSaleData.customerName || 'N/A'}</div>
                        <div class="latest-sale-item"><strong>Date:</strong> ${latestSaleData.saleDate || 'N/A'}</div>
                        <div class="latest-sale-item latest-sale-amount"><strong>Amount:</strong> Rs. ${parseFloat(latestSaleData.grandTotal || 0).toFixed(2)}</div>
                        <button id="viewLatestInvoiceBtn_${latestSaleData.id}" class="btn btn-outline-primary btn-sm mt-1"><i class="fas fa-file-pdf fa-fw"></i> View Invoice</button>
                    `;
                    // Attach event listener dynamically
                    const btn = document.getElementById(`viewLatestInvoiceBtn_${latestSaleData.id}`);
                    if(btn) btn.addEventListener('click', () => generateAndShowInvoice(latestSaleData));

                } else { latestSaleDisplayEl.innerHTML = '<p class="no-sales-message">No sales recorded yet.</p>';}
            } else { latestSaleDisplayEl.innerHTML = '<p class="no-sales-message">No sales recorded yet.</p>';}
        } catch (error) { console.error("Error fetching latest sale:", error); latestSaleDisplayEl.innerHTML = '<p class="text-danger">Could not load latest sale.</p>';}
    }

    async function fetchSalesDataForChart(periodType = 7) {
        const salesDataByDate = {};
        const today = new Date();
        today.setHours(0,0,0,0); // Normalize to start of today

        let startDate = new Date(today); // Clone today
        let endDate = new Date(today);   // Clone today

        if (periodType === 'thisMonth') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        } else { // Assuming periodType is number of days (e.g., 7 or 30)
            startDate.setDate(today.getDate() - (parseInt(periodType) - 1));
        }
        
        const startDateString = startDate.toISOString().split('T')[0];
        const endDateString = endDate.toISOString().split('T')[0];
        // console.log(`Workspaceing sales for chart. Period: ${startDateString} to ${endDateString}`);

        try {
            const snapshot = await db.ref(SALES_LOG_PATH)
                                  .orderByChild('saleDate')
                                  .startAt(startDateString)
                                  .endAt(endDateString)
                                  .once('value');
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
            while(currentDateIter <= endDate) {
                const dateKey = currentDateIter.toISOString().split('T')[0];
                labels.push(dateKey.slice(5)); // Format as MM-DD for label
                dataPoints.push(salesDataByDate[dateKey] || 0);
                currentDateIter.setDate(currentDateIter.getDate() + 1);
            }
            // console.log("Chart data:", { labels, dataPoints });
            return { labels, dataPoints };
        } catch (error) {
            console.error("Error fetching sales data for chart:", error);
            return { labels: [], dataPoints: [] };
        }
    }

    async function renderSalesChart(period = 7) {
        if (!salesChartCanvas || !window.Chart) {
             console.error("Sales chart canvas or Chart.js library not found.");
             if(salesChartMessageEl) {
                salesChartMessageEl.textContent = "Chart library not loaded or canvas missing.";
                salesChartMessageEl.style.display = 'block';
             }
             return;
        }
        const { labels, dataPoints } = await fetchSalesDataForChart(period);

        if (salesChartMessageEl) {
            salesChartMessageEl.style.display = (labels.length === 0 || dataPoints.every(p => p === 0)) ? 'block' : 'none';
        }

        if (salesChartInstance) {
            salesChartInstance.destroy();
        }
        try {
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
        } catch (chartError) {
            console.error("Error rendering chart:", chartError);
             if(salesChartMessageEl) {
                salesChartMessageEl.textContent = "Error rendering sales chart.";
                salesChartMessageEl.style.display = 'block';
             }
        }
    }

    if (chartFilterButtons) {
        chartFilterButtons.forEach(button => {
            button.addEventListener('click', function() {
                chartFilterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                renderSalesChart(this.dataset.period);
            });
        });
    }

    function timeAgo(timestamp) {
        if (!timestamp) return 'a while ago';
        const now = Date.now();
        const seconds = Math.round((now - timestamp) / 1000);
        if (seconds < 2) return 'just now'; if (seconds < 60) return `${seconds} secs ago`;
        const minutes = Math.round(seconds / 60); if (minutes < 60) return `${minutes} mins ago`;
        const hours = Math.round(minutes / 60); if (hours < 24) return `${hours} hrs ago`;
        const days = Math.round(hours / 24); if (days < 7) return `${days} days ago`;
        return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // More standard date format
    }

    async function fetchRecentActivities() {
        if (!recentActivityListEl) return;
        recentActivityListEl.innerHTML = '<li class="activity-item-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading activities...</li>';
        let activities = [];
        const activityLimit = 3; 

        try {
            const fetchPromises = [
                db.ref(PRODUCTION_LOG_PATH).orderByChild('timestamp').limitToLast(activityLimit).once('value'),
                db.ref(SALES_LOG_PATH).orderByChild('timestamp').limitToLast(activityLimit).once('value'),
                db.ref(CUSTOMERS_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(RAW_TEA_METADATA_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(PACKING_MATERIAL_METADATA_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value'),
                db.ref(DEFINED_PRODUCTS_PATH).orderByChild('createdAt').limitToLast(activityLimit).once('value') // Assuming products also have createdAt
            ];

            const snapshots = await Promise.all(fetchPromises);

            // Productions
            if(snapshots[0].exists()) snapshots[0].forEach(c => {const d=c.val(); activities.push({ts:d.timestamp,type:'<i class="fas fa-industry activity-icon-teal fa-fw"></i>',desc:`Produced <strong>${d.quantityProduced || 0} ${d.finishedProductName||'product'}</strong> (Batch: ${d.batchNumber||'N/A'})`, link: `production.html#log-${c.key}`});});
            // Sales
            if(snapshots[1].exists()) snapshots[1].forEach(c => {const d=c.val(); const saleDisplayId = d.saleId || (c.key ? c.key.slice(-6).toUpperCase() : 'N/A'); activities.push({ts:d.timestamp,type:'<i class="fas fa-file-invoice-dollar activity-icon-yellow fa-fw"></i>',desc:`New Sale to <strong>${d.customerName||'N/A'}</strong> for Rs. ${parseFloat(d.grandTotal||0).toFixed(2)} (ID: ${saleDisplayId})`, link: `sales.html#sale-${c.key}`});});
            // New Customers
            if(snapshots[2].exists()) snapshots[2].forEach(c => {const d=c.val(); activities.push({ts:d.createdAt,type:'<i class="fas fa-user-plus activity-icon-purple fa-fw"></i>',desc:`New Customer: <strong>${d.name||'N/A'}</strong>`, link: `customers.html#customer-${c.key}`});});
            // New Raw Tea Tables
            if(snapshots[3].exists()) snapshots[3].forEach(c => {activities.push({ts:c.val().createdAt,type:'<i class="fas fa-boxes-stacked activity-icon-blue fa-fw"></i>',desc:`New Raw Tea table: <strong>${c.key}</strong>`, link: `raw_tea.html#table-${c.key}`});});
            // New Packing Material Tables
            if(snapshots[4].exists()) snapshots[4].forEach(c => {activities.push({ts:c.val().createdAt,type:'<i class="fas fa-box-archive activity-icon-orange fa-fw"></i>',desc:`New Packing table: <strong>${c.key}</strong>`, link: `packing_material.html#table-${c.key}`});});
            // New Finished Product Definitions
            if(snapshots[5].exists()) snapshots[5].forEach(c => {const d=c.val(); activities.push({ts:d.createdAt,type:'<i class="fas fa-mug-hot activity-icon-green fa-fw"></i>',desc:`New Finished Product defined: <strong>${d.itemName||c.key}</strong>`, link: `finished_products.html#product-${c.key}`});});


            activities.sort((a, b) => (b.ts || 0) - (a.ts || 0));
            const displayActivities = activities.slice(0, 7); 

            recentActivityListEl.innerHTML = '';
            if (displayActivities.length > 0) {
                displayActivities.forEach(act => {
                    const li = document.createElement('li'); li.classList.add('activity-item');
                    const content = `${act.type || '<i class="fas fa-info-circle activity-icon-muted fa-fw"></i>'} <div class="activity-details"><p class="activity-description">${act.desc}</p><p class="activity-meta">${timeAgo(act.ts)}</p></div>`;
                    if (act.link && act.link !== '#') { // Ensure link is meaningful
                        const anchor = document.createElement('a'); anchor.href = act.link;
                        anchor.innerHTML = content; anchor.style.textDecoration = 'none'; anchor.style.color = 'inherit';
                        li.appendChild(anchor);
                    } else { li.innerHTML = content; }
                    recentActivityListEl.appendChild(li);
                });
            } else { recentActivityListEl.innerHTML = '<li class="activity-item-placeholder">No recent system activities.</li>'; }
        } catch (error) {
            console.error("Error fetching recent activities:", error);
            recentActivityListEl.innerHTML = '<li class="activity-item-placeholder text-danger">Could not load activities.</li>';
        }
    }

    // Copied & adapted from sales.js - make sure jsPDF is loaded in index.html
    function generateAndShowInvoice(saleData) {
        if (!jsPDF) { alert("PDF library (jsPDF) is not loaded."); return; }
        if (!saleData) { alert("Sale data for invoice is missing."); return; }
        // ... (The rest of generateAndShowInvoice function remains the same as provided in the previous sales.js)
        const doc = new jsPDF();
        const companyName = "Amee-Tea Pvt Ltd"; const companyAddress = "123 Tea Lane, Colombo, Sri Lanka"; const companyContact = "Phone: +94 11 222 3333 | Email: sales@ameetea.lk";
        doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(companyName, 14, 20); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(companyAddress, 14, 26); doc.text(companyContact, 14, 32);
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text("INVOICE", 140, 22); doc.setFont(undefined, 'normal');
        doc.setFontSize(10); doc.text(`Invoice ID: ${saleData.saleId || 'N/A'}`, 140, 30); doc.text(`Date: ${saleData.saleDate}`, 140, 35);
        doc.setFontSize(12); doc.text("Bill To:", 14, 45); doc.setFontSize(10); doc.text(saleData.customerName + (saleData.customerId ? ` (ID: ${saleData.customerId.slice(-6).toUpperCase()})` : ""), 14, 50);
        doc.line(14, 60, 196, 60);
        const tableColumn = ["#", "Item", "Qty", "Price (Rs.)", "Disc. (%)", "Total (Rs.)"];
        const tableRows = []; let itemNumber = 1;
        (saleData.items || []).forEach(item => { tableRows.push([itemNumber++, `${item.itemName} (${item.productCode})`, item.quantity, parseFloat(item.unitPrice).toFixed(2), (item.discountPercent || 0).toFixed(2), parseFloat(item.lineTotal).toFixed(2)]); });
        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 65, theme: 'striped', headStyles: { fillColor: [22, 160, 133] }, margin: { top: 60 } });
        let finalY = doc.lastAutoTable.finalY || 70;
        finalY += 10; doc.setFontSize(10); doc.text(`Subtotal:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.subTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' });
        if ((saleData.overallDiscountPercent || 0) > 0) { finalY += 5; doc.text(`Overall Discount (${(saleData.overallDiscountPercent || 0).toFixed(2)}%):`, 140, finalY); doc.text(`- Rs. ${parseFloat(saleData.overallDiscountAmount || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); }
        finalY += 7; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text(`Grand Total:`, 140, finalY); doc.text(`Rs. ${parseFloat(saleData.grandTotal || 0).toFixed(2)}`, 196, finalY, { align: 'right' }); doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        finalY += 10; doc.text(`Payment Method: ${saleData.paymentMethod || 'N/A'}`, 14, finalY);
        if(saleData.saleNotes){ finalY += 7; doc.text("Notes:", 14, finalY); const notesLines = doc.splitTextToSize(saleData.saleNotes, 180); doc.text(notesLines, 14, finalY + 4); }
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.text("Thank you for your business!", 14, pageHeight - 10); doc.text("Generated on: " + new Date().toLocaleString(), 130, pageHeight - 10, {align: 'right'});
        doc.save(`Invoice-${saleData.saleId || saleData.customerName.replace(/\s/g, '_')}-${saleData.saleDate}.pdf`);
    }


    // --- Main Function to Load All Dashboard Data ---
    function loadDashboardData() {
        console.log("loadDashboardData called");
        fetchAndDisplayCount(RAW_TEA_METADATA_PATH, rawTeaTablesCountEl);
        fetchAndDisplayCount(PACKING_MATERIAL_METADATA_PATH, packingMaterialTablesCountEl);
        fetchAndDisplayCount(DEFINED_PRODUCTS_PATH, definedProductsCountEl);
        fetchAndDisplayCount(CUSTOMERS_PATH, customersCountEl);
        fetchAndDisplayCount(SALES_LOG_PATH, totalSalesCountEl);
        fetchAndDisplayCount(PRODUCTION_LOG_PATH, totalProductionsCountEl);
        fetchLatestSale();
        renderSalesChart(7); // Default to last 7 days for the chart
        fetchRecentActivities();
    }

    // --- Initial Call ---
    loadDashboardData(); // This is the correct function to call.
});