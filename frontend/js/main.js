document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Dark/Light Mode Switcher Logic
    const themeToggleBtn = document.getElementById('theme-toggle');

    function updateThemeIcon(isLight) {
        if (!themeToggleBtn) return;
        const iconName = isLight ? 'sun' : 'moon';
        themeToggleBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    }

    const savedTheme = localStorage.getItem('aurelis-theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon(true);
    } else {
        updateThemeIcon(false);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLightNow = document.documentElement.getAttribute('data-theme') === 'light';
            const themeSelect = document.getElementById('setting-theme'); // Target the settings dropdown

            if (!isLightNow) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('aurelis-theme', 'light');
                updateThemeIcon(true);
                if (themeSelect) themeSelect.value = 'light'; // Sync dropdown to Light
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('aurelis-theme', 'dark');
                updateThemeIcon(false);
                if (themeSelect) themeSelect.value = 'dark'; // Sync dropdown to Dark
            }
        });
    }

    // Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const pageSections = document.querySelectorAll('.page-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active states
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pageSections.forEach(section => {
                section.classList.remove('active');
            });

            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                // Snap to top INSTANTLY (0,0) before the new tab renders to prevent the harsh scroll animation
                const appContainer = document.querySelector('.app-container');
                if (appContainer) appContainer.scrollTo(0, 0);
                window.scrollTo(0, 0);

                targetSection.classList.add('active');

                // Phase 9: Manage WebGL Lifecycle to save battery
                if (window.networkTopology3D) {
                    if (targetId === 'map') {
                        window.networkTopology3D.resume();
                        // Force resize to fix 0x0 WebGL render when initialized while hidden
                        setTimeout(() => {
                            window.networkTopology3D.onWindowResize();
                            drawNetworkMap();
                        }, 50);
                    } else {
                        window.networkTopology3D.pause();
                    }
                }
            }
        });
    });

    // Wire the "View All" button to trigger the inventory tab click
    const viewAllBtn = document.querySelector('.table-panel .link-button');
    if (viewAllBtn) {
        viewAllBtn.onclick = null; // Clear inline HTML handler if any
        viewAllBtn.addEventListener('click', () => {
            const inventoryNavBtn = document.querySelector('.nav-item[data-target="inventory"]');
            if (inventoryNavBtn) inventoryNavBtn.click();
        });
    }

    // Backend API Configuration
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Fetch Initial Network Info
    async function fetchNetworkInfo() {
        const ipDisplay = document.getElementById('gateway-ip-display');
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');

        try {
            const response = await fetch(`${API_BASE_URL}/network/info`);
            const data = await response.json();

            if (data.success) {
                ipDisplay.textContent = `SUBNET: ${data.network_cidr} (HOST: ${data.local_ip})`;
                statusText.textContent = "Network Monitoring Active";
                statusDot.className = "status-dot online";
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error("Failed to fetch network info:", error);
            if (ipDisplay) ipDisplay.textContent = "API DISCONNECTED";
            if (statusText) statusText.textContent = "Backend Offline";
            if (statusDot) statusDot.className = "status-dot offline";
        }
    }

    // Persistent State Tracker & UI Rendering Engine
    const deviceTracker = new Map(); // Tracks devices by MAC Address across multiple scans

    const scanBtn = document.getElementById('scan-network-btn');
    const metricDiscovered = document.getElementById('metric-discovered');
    const metricReachable = document.getElementById('metric-reachable');
    const deviceTableBody = document.getElementById('device-table-body');
    const fullInventoryBody = document.getElementById('full-inventory-body');

    // Keyed Node DOM Reconciliation Helper (Fixes innerHTML thrashing)
    function updateDeviceTable(tbodyElement, devices) {
        if (!tbodyElement) return;

        const existingRows = new Map();
        Array.from(tbodyElement.children).forEach(row => {
            const mac = row.getAttribute('data-mac');
            if (mac) existingRows.set(mac, row);
        });

        const targetMacs = new Set(devices.map(d => d.mac_address));

        // 1. Remove rows no longer present in target dataset
        existingRows.forEach((row, mac) => {
            if (!targetMacs.has(mac)) {
                row.remove();
            }
        });

        // 2. Update existing rows or append new ones in exact array order
        devices.forEach((device, index) => {
            const timeString = device.firstSeen.toLocaleTimeString([], { hour12: false });
            let badgeClass = 'badge-online';
            let displayStatus = 'Detected';

            if (device.status === 'unreachable' || device.status === 'offline' || device.status === 'error') {
                badgeClass = 'badge-offline';
                displayStatus = 'Unreachable';
            } else if (device.status === 'reachable') {
                badgeClass = 'badge-online';
                displayStatus = 'Reachable';
            }

            let row = existingRows.get(device.mac_address);

            if (row) {
                // Granular cell updating (only mutate changed cells to avoid thrashing)
                const cells = row.children;
                if (cells[0].textContent !== device.hostname) cells[0].textContent = device.hostname;
                if (cells[1].textContent !== device.ip_address) cells[1].textContent = device.ip_address;
                if (cells[2].textContent !== device.mac_address) cells[2].textContent = device.mac_address;
                if (cells[3].textContent !== timeString) cells[3].textContent = timeString;

                const badge = cells[4].querySelector('.badge');
                if (badge) {
                    const expectedClass = `badge ${badgeClass}`;
                    if (badge.className !== expectedClass) badge.className = expectedClass;
                    if (badge.textContent !== displayStatus) badge.textContent = displayStatus;
                }

                // Ensure row position matches array order
                if (tbodyElement.children[index] !== row) {
                    tbodyElement.insertBefore(row, tbodyElement.children[index] || null);
                }
            } else {
                // Construct new keyed row
                row = document.createElement('tr');
                row.setAttribute('data-mac', device.mac_address);
                row.innerHTML = `
                    <td>${device.hostname}</td>
                    <td class="font-mono">${device.ip_address}</td>
                    <td class="font-mono">${device.mac_address}</td>
                    <td class="font-mono" style="opacity: 0.7;">${timeString}</td>
                    <td><span class="badge ${badgeClass}">${displayStatus}</span></td>
                `;
                tbodyElement.insertBefore(row, tbodyElement.children[index] || null);
            }
        });
    }

    function renderDevices() {
        // Sort devices in reverse chronological order (newest connections first)
        const allDevices = Array.from(deviceTracker.values()).sort((a, b) => b.firstSeen - a.firstSeen);

        // Render Overview Preview (Strictly capped at 10 items) using keyed reconciliation
        if (deviceTableBody) {
            updateDeviceTable(deviceTableBody, allDevices.slice(0, 10));
        }

        // Render Full Device Inventory Tab (Uncapped, shows all devices) using keyed reconciliation
        if (fullInventoryBody) {
            updateDeviceTable(fullInventoryBody, allDevices);
        }

        // Dynamically Calculate & Render Device Status Progress Bars
        const total = allDevices.length;
        if (total > 0) {
            let unreachableCount = 0;
            allDevices.forEach(d => {
                if (d.status === 'unreachable' || d.status === 'offline' || d.status === 'error') {
                    unreachableCount++;
                }
            });
            const reachableCount = total - unreachableCount;

            // Update Progress Bar Text Counts
            const statusCounts = document.querySelectorAll('.status-row .status-count');
            if (statusCounts.length >= 2) {
                statusCounts[0].textContent = reachableCount;
                statusCounts[1].textContent = unreachableCount;
            }

            // Update Progress Bar Widths dynamically
            const reachBar = document.querySelector('.fill-reachable');
            const unreachBar = document.querySelector('.fill-unreachable');
            if (reachBar) reachBar.style.width = `${Math.round((reachableCount / total) * 100)}%`;
            if (unreachBar) unreachBar.style.width = `${Math.round((unreachableCount / total) * 100)}%`;

            // Update Dashboard Overview Metric Card
            if (metricReachable) metricReachable.textContent = reachableCount;

            // (Add this inside renderDevices, right after it updates metricReachable)
            if (document.getElementById('map').classList.contains('active')) {
                drawNetworkMap();
            }
        }
    }

    // Network Scan Fetch & Execution Logic
    async function executeScan() {
        try {
            const response = await fetch(`${API_BASE_URL}/devices`);
            const data = await response.json();

            if (data.success) {
                // UI Feedback: Sync button spinner with backend's actual scanning state
                if (scanBtn) {
                    if (data.is_scanning) {
                        scanBtn.disabled = true;
                        scanBtn.innerHTML = `<i data-lucide="loader"></i> Scanning...`;
                    } else {
                        scanBtn.disabled = false;
                        scanBtn.innerHTML = `<i data-lucide="refresh-cw"></i> Scan Network`;
                    }
                    lucide.createIcons();
                }

                data.devices.forEach(device => {
                    if (!deviceTracker.has(device.mac_address)) {
                        device.firstSeen = new Date();
                        deviceTracker.set(device.mac_address, device);
                    } else {
                        const existing = deviceTracker.get(device.mac_address);
                        existing.ip_address = device.ip_address;
                        if (existing.status !== 'unreachable') {
                            existing.status = device.status;
                        }
                    }
                });

                if (metricDiscovered) metricDiscovered.textContent = deviceTracker.size;
                renderDevices();
            } else {
                console.error("Scan failed:", data.error);
            }
        } catch (error) {
            console.error("Error fetching devices:", error);
        }
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', executeScan);
    }

    // Visibility-Aware Polling Loop (Self-scheduling setTimeout chain)
    let pollTimerId = null;

    async function pollNetworkState() {
        if (pollTimerId) {
            clearTimeout(pollTimerId);
            pollTimerId = null;
        }

        const delaySetting = localStorage.getItem('aurelis-scan-interval') || '15000';
        const delay = parseInt(delaySetting, 10);

        if (!document.hidden && delay > 0) {
            await executeScan();

            // Auto-refresh the History tab if the user is currently looking at it
            const historySection = document.getElementById('history');
            if (historySection && historySection.classList.contains('active')) {
                fetchHistory();
            }
        }

        if (delay > 0) {
            pollTimerId = setTimeout(pollNetworkState, delay);
        }
    }

    // Pause / Resume polling dynamically based on Page Visibility API
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            pollNetworkState();
        }
    });

    // Targeted Ping Execution (Syncs results back to Tracker)
    const runPingBtn = document.getElementById('run-ping-btn');
    const pingInput = document.getElementById('ping-target-input');
    const pingResultsPanel = document.getElementById('ping-results-panel');
    const metricLatency = document.getElementById('metric-latency');

    if (runPingBtn) {
        runPingBtn.addEventListener('click', async () => {
            const ip = pingInput.value.trim();
            if (!ip) {
                alert("Please enter a valid IP address.");
                return;
            }

            runPingBtn.disabled = true;
            runPingBtn.textContent = "Testing...";

            try {
                const response = await fetch(`${API_BASE_URL}/diagnostics/ping`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: ip, count: 4 })
                });
                const result = await response.json();

                if (result.success) {
                    const data = result.data;
                    pingResultsPanel.style.display = 'block';

                    document.getElementById('res-status').textContent = data.status.toUpperCase();
                    document.getElementById('res-loss').textContent = `${data.packet_loss_percent}%`;
                    document.getElementById('res-latency').textContent = `${data.avg_latency_ms} ms`;
                    document.getElementById('res-received').textContent = `${data.packets_received}/${data.packets_sent}`;

                    if (metricLatency) metricLatency.innerHTML = `${data.avg_latency_ms} <span class="unit">ms</span>`;

                    // Sync the ping test result back to the central device tracker
                    for (let [mac, device] of deviceTracker.entries()) {
                        if (device.ip_address === ip) {
                            device.status = data.status.toLowerCase(); // 'reachable' or 'unreachable'
                            break;
                        }
                    }
                    renderDevices(); // Forces UI, badges, and progress bars to update immediately
                } else {
                    alert("Diagnostic error: " + result.error);
                }
            } catch (err) {
                console.error("Ping request failed:", err);
                alert("Failed to connect to Flask diagnostics backend.");
            } finally {
                runPingBtn.disabled = false;
                runPingBtn.textContent = "Run Ping Test";
            }
        });
    }

    // Network History Real-Time Stream & Management
    const historyScansBody = document.getElementById('history-scans-body');
    const historyPingsBody = document.getElementById('history-pings-body');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    async function fetchHistory() {
        if (!historyScansBody || !historyPingsBody) return;

        try {
            const [scansRes, pingsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/history/scans`),
                fetch(`${API_BASE_URL}/history/pings`)
            ]);

            const scansData = await scansRes.json();
            const pingsData = await pingsRes.json();

            if (scansData.success && scansData.data.length > 0) {
                historyScansBody.innerHTML = '';
                scansData.data.forEach(scan => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="font-mono">#${scan.id}</td>
                        <td class="font-mono" style="opacity: 0.7;">${scan.timestamp}</td>
                        <td><span class="badge badge-online">${scan.discovered_count} Devices</span></td>
                    `;
                    historyScansBody.appendChild(tr);
                });
            } else if (historyScansBody) {
                historyScansBody.innerHTML = `<tr><td colspan="3" style="text-align:center; opacity:0.6;">No scan history recorded yet.</td></tr>`;
            }

            if (pingsData.success && pingsData.data.length > 0) {
                historyPingsBody.innerHTML = '';
                pingsData.data.forEach(ping => {
                    const tr = document.createElement('tr');
                    const badgeClass = ping.status === 'reachable' ? 'badge-online' : 'badge-offline';
                    tr.innerHTML = `
                        <td class="font-mono" style="opacity: 0.7;">${ping.timestamp}</td>
                        <td class="font-mono">${ping.ip_address}</td>
                        <td class="font-mono">${ping.avg_latency_ms} ms</td>
                        <td><span class="badge ${badgeClass}">${ping.status.toUpperCase()}</span></td>
                    `;
                    historyPingsBody.appendChild(tr);
                });
            } else if (historyPingsBody) {
                historyPingsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:0.6;">No ping diagnostics recorded yet.</td></tr>`;
            }
        } catch (error) {
            console.error("Failed to sync history logs:", error);
        }
    }

    // Auto-fetch history when clicking the Network History tab
    const historyNavBtn = document.querySelector('.nav-item[data-target="history"]');
    if (historyNavBtn) {
        historyNavBtn.addEventListener('click', fetchHistory);
    }

    // Also auto-refresh history streams whenever a background scan finishes
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            setTimeout(fetchHistory, 1500); // Give the backend 1.5s to write to SQLite before fetching
        });
    }

    // Clear History Button Logic
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to wipe all stored scan and ping history from the database?")) return;

            try {
                const res = await fetch(`${API_BASE_URL}/history/clear`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    fetchHistory(); // Refresh tables instantly to empty state
                    alert("History successfully cleared.");
                } else {
                    alert("Failed to clear history: " + data.error);
                }
            } catch (err) {
                console.error("Clear history error:", err);
            }
        });
    }

    // Export CSV Button Logic (Downloads both or scans CSV)
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            // Trigger direct download of the scans CSV report
            window.location.href = `${API_BASE_URL}/history/export/scans`;
        });
    }

    // Security Recommendations Engine Integration
    const securityAlertsContainer = document.getElementById('security-alerts-container');
    const refreshSecurityBtn = document.getElementById('refresh-security-btn');

    async function fetchSecurityAlerts() {
        if (!securityAlertsContainer) return;

        if (refreshSecurityBtn) {
            refreshSecurityBtn.innerHTML = `<i data-lucide="loader"></i> Auditing...`;
            lucide.createIcons();
        }

        try {
            const response = await fetch(`${API_BASE_URL}/security/alerts`);
            const data = await response.json();

            if (data.success) {
                securityAlertsContainer.innerHTML = '';

                data.data.forEach(alert => {
                    // Map the threat type to specific Luxury Tech CSS colors
                    let borderColor = 'rgba(255, 255, 255, 0.1)';
                    let iconColor = '#fff';

                    if (alert.type === 'critical') {
                        borderColor = 'rgba(255, 60, 60, 0.5)';
                        iconColor = '#ff3c3c';
                    } else if (alert.type === 'warning') {
                        borderColor = 'rgba(255, 170, 0, 0.5)';
                        iconColor = '#ffaa00';
                    } else if (alert.type === 'success') {
                        borderColor = 'rgba(0, 255, 128, 0.5)';
                        iconColor = '#00ff80';
                    } else if (alert.type === 'info') {
                        borderColor = 'rgba(0, 150, 255, 0.5)';
                        iconColor = '#0096ff';
                    }

                    const card = document.createElement('div');
                    card.className = 'panel';
                    card.style.borderLeft = `4px solid ${iconColor}`;
                    card.style.display = 'flex';
                    card.style.gap = '20px';
                    card.style.alignItems = 'flex-start';

                    card.innerHTML = `
                        <div style="color: ${iconColor}; padding-top: 4px;">
                            <i data-lucide="${alert.icon}" style="width: 24px; height: 24px;"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <h3 style="margin: 0; font-size: 1.1rem;">${alert.title}</h3>
                                <span class="font-mono" style="font-size: 0.75rem; opacity: 0.5;">${alert.id}</span>
                            </div>
                            <p style="margin: 0 0 12px 0; opacity: 0.8; line-height: 1.5;">${alert.message}</p>
                            <div style="background: rgba(0,0,0,0.2); padding: 10px 14px; border-radius: 6px; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.05);">
                                <strong style="color: var(--color-pink);">RECOMMENDATION:</strong> ${alert.recommendation}
                            </div>
                        </div>
                    `;
                    securityAlertsContainer.appendChild(card);
                });
                lucide.createIcons();
            }
        } catch (error) {
            console.error("Failed to fetch security alerts:", error);
            securityAlertsContainer.innerHTML = `<div class="panel" style="color: #ff3c3c;">Failed to connect to Security Engine.</div>`;
        } finally {
            if (refreshSecurityBtn) {
                refreshSecurityBtn.innerHTML = `<i data-lucide="shield-check"></i> Run Security Audit`;
                lucide.createIcons();
            }
        }
    }

    // Auto-fetch alerts when clicking the Security tab
    const securityNavBtn = document.querySelector('.nav-item[data-target="security"]');
    if (securityNavBtn) {
        securityNavBtn.addEventListener('click', fetchSecurityAlerts);
    }

    if (refreshSecurityBtn) {
        refreshSecurityBtn.addEventListener('click', fetchSecurityAlerts);
    }

    // Network Topology Engine (Phase 9: Three.js Bridge)
    const refreshMapBtn = document.getElementById('refresh-map-btn');

    function drawNetworkMap() {
        if (!window.networkTopology3D) return;

        const allDevices = Array.from(deviceTracker.values());
        window.networkTopology3D.buildGraph(allDevices);
    }

    // Redraw dynamically if window resizes (Three.js handles its own canvas resize)
    window.addEventListener('resize', () => {
        if (document.getElementById('map').classList.contains('active')) {
            drawNetworkMap();
        }
    });

    if (refreshMapBtn) {
        refreshMapBtn.addEventListener('click', drawNetworkMap);
    }

    // Analytics & Reports Integration (Phase 7)
    let latencyChartInstance = null;
    let packetLossChartInstance = null;

    async function loadAnalyticsDashboard() {
        const statsBody = document.getElementById('statistics-table-body');
        if (!statsBody) return;

        try {
            const response = await fetch(`${API_BASE_URL}/reports/statistics`);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                const statsData = result.data;

                // 1. Populate Statistics Table
                statsBody.innerHTML = '';
                statsData.forEach(stat => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="font-mono">${stat.ip_address}</td>
                        <td class="font-mono">${stat.avg_latency} ms</td>
                        <td class="font-mono">${stat.max_latency} ms</td>
                        <td class="font-mono">${stat.avg_packet_loss}%</td>
                    `;
                    statsBody.appendChild(tr);
                });

                // Prepare Data for Charts
                const labels = statsData.map(s => s.ip_address);
                const avgLatencies = statsData.map(s => s.avg_latency);
                const packetLosses = statsData.map(s => s.avg_packet_loss);

                // 2. Render Latency Trend Chart (Smooth curve with gradient)
                const latCtx = document.getElementById('latency-trend-chart').getContext('2d');

                // Create glowing gradient
                let latGradient = latCtx.createLinearGradient(0, 0, 0, 250);
                latGradient.addColorStop(0, 'rgba(234, 123, 148, 0.4)'); // var(--color-pink)
                latGradient.addColorStop(1, 'rgba(234, 123, 148, 0.0)');

                if (latencyChartInstance) latencyChartInstance.destroy();
                latencyChartInstance = new Chart(latCtx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Avg Latency (ms)',
                            data: avgLatencies,
                            borderColor: '#EA7B94',
                            backgroundColor: latGradient,
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4, // Smooth curves like the reference image
                            pointBackgroundColor: '#08090C',
                            pointBorderColor: '#EA7B94',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a7a9b2' } },
                            x: { grid: { display: false }, ticks: { color: '#a7a9b2' } }
                        }
                    }
                });

                // 3. Render Packet Loss Chart (Bar Chart)
                const lossCtx = document.getElementById('packet-loss-chart').getContext('2d');
                if (packetLossChartInstance) packetLossChartInstance.destroy();
                packetLossChartInstance = new Chart(lossCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Packet Loss (%)',
                            data: packetLosses,
                            backgroundColor: 'rgba(81, 167, 248, 0.7)', // --color-online
                            borderColor: '#51A7F8',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a7a9b2' } },
                            x: { grid: { display: false }, ticks: { color: '#a7a9b2' } }
                        }
                    }
                });

                // Store data globally for the report generator
                window.currentStatsData = statsData;

            } else {
                statsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:0.5;">No ping diagnostics recorded yet. Run a ping test first.</td></tr>`;
            }
        } catch (error) {
            console.error("Failed to load analytics:", error);
        }
    }

    // Report Generator Function (Feature 4)
    document.getElementById('generate-report-btn')?.addEventListener('click', () => {
        const date = new Date().toLocaleString();
        const devices = Array.from(deviceTracker.values());
        const stats = window.currentStatsData || [];

        let report = `====================================================\n`;
        report += `           AURELIS NETWORK SECURITY REPORT          \n`;
        report += `====================================================\n`;
        report += `Generated: ${date}\n\n`;

        report += `--- [ 1. ACTIVE DEVICE INVENTORY ] ---\n`;
        report += `Total Devices Detected: ${devices.length}\n`;
        devices.forEach(d => {
            report += `- [${d.status.toUpperCase()}] ${d.ip_address} | MAC: ${d.mac_address} | Host: ${d.hostname}\n`;
        });
        report += `\n`;

        report += `--- [ 2. NETWORK PERFORMANCE SUMMARY ] ---\n`;
        if (stats.length === 0) {
            report += `No ping diagnostics data available.\n`;
        } else {
            stats.forEach(s => {
                report += `Target: ${s.ip_address}\n`;
                report += `  - Tests Conducted: ${s.total_tests}\n`;
                report += `  - Avg Latency: ${s.avg_latency} ms (Max: ${s.max_latency} ms)\n`;
                report += `  - Packet Loss: ${s.avg_packet_loss}%\n\n`;
            });
        }

        report += `====================================================\n`;
        report += `End of Report\n`;

        // Trigger file download
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Aurelis_Network_Report_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Auto-fetch analytics when clicking the Reports tab
    const reportsNavBtn = document.querySelector('.nav-item[data-target="reports"]');
    if (reportsNavBtn) {
        reportsNavBtn.addEventListener('click', loadAnalyticsDashboard);
    }

    // System Settings Integration (Phase 8)
    const themeSelect = document.getElementById('setting-theme');
    const intervalSelect = document.getElementById('setting-interval');
    const factoryResetBtn = document.getElementById('factory-reset-btn');

    // Initialize Settings from Local Storage
    if (themeSelect && intervalSelect) {
        // Load saved theme
        const currentTheme = localStorage.getItem('aurelis-theme') || 'dark';
        themeSelect.value = currentTheme;

        // Load saved interval (default 15s)
        const currentInterval = localStorage.getItem('aurelis-scan-interval') || '15000';
        intervalSelect.value = currentInterval;

        // Listen for Theme Changes via Dropdown
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            if (newTheme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('aurelis-theme', 'light');
                updateThemeIcon(true); // From your earlier code
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('aurelis-theme', 'dark');
                updateThemeIcon(false);
            }
        });

        // Listen for Interval Changes
        intervalSelect.addEventListener('change', (e) => {
            const newInterval = e.target.value;
            localStorage.setItem('aurelis-scan-interval', newInterval);
            pollNetworkState(); // Re-trigger polling chain with updated interval
        });
    }

    // Factory Reset Logic
    if (factoryResetBtn) {
        factoryResetBtn.addEventListener('click', async () => {
            const confirmed = confirm("WARNING: This will permanently delete all network scans, ping history, and reset your UI preferences. Are you absolutely sure?");
            if (!confirmed) return;

            factoryResetBtn.innerHTML = `<i data-lucide="loader"></i> Wiping Data...`;
            lucide.createIcons();

            try {
                // Call the existing wipe endpoint we built earlier
                const res = await fetch(`${API_BASE_URL}/history/clear`, { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    // Clear Local Storage
                    localStorage.removeItem('aurelis-theme');
                    localStorage.removeItem('aurelis-scan-interval');

                    alert("Factory Reset complete. AURELIS will now reload.");
                    window.location.reload(); // Refresh the page to reset all memory states
                } else {
                    alert("Database wipe failed: " + data.error);
                }
            } catch (err) {
                console.error("Reset error:", err);
                alert("Failed to communicate with backend for reset.");
            } finally {
                factoryResetBtn.innerHTML = `Execute Reset`;
            }
        });
    }

    // Override the old hardcoded 15-second load interval we placed earlier
    // (You can delete the old setInterval block inside window.addEventListener('load') if you want, 
    // as applyScanInterval() now handles it natively!)

    // Execute the fetch immediately when the app loads
    fetchNetworkInfo();

    // Auto-trigger visibility-aware network scan polling on initial page load
    window.addEventListener('load', () => {
        pollNetworkState();
    });
});