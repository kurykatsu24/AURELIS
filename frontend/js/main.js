document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    lucide.createIcons();


    // 2. Dark/Light Mode Switcher Logic
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Function to dynamically render the correct Lucide icon
    function updateThemeIcon(isLight) {
        if (!themeToggleBtn) return;
        // In Light Mode, show Sun icon (click to switch to Dark). In Dark Mode, show Moon icon (click to switch to Light).
        const iconName = isLight ? 'sun' : 'moon';
        themeToggleBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    }

    // Load saved theme preference on page load
    const savedTheme = localStorage.getItem('aurelis-theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon(true);
    } else {
        updateThemeIcon(false);
    }

    // Toggle button click handler
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLightNow = document.documentElement.getAttribute('data-theme') === 'light';

            if (!isLightNow) {
                // Switch to Light Mode
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('aurelis-theme', 'light');
                updateThemeIcon(true);
            } else {
                // Switch to Dark Mode
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('aurelis-theme', 'dark');
                updateThemeIcon(false);
            }
        });
    }

    // Auto-trigger network scan on initial page load
    window.addEventListener('load', () => {
        const scanBtn = document.getElementById('scan-network-btn');
        if (scanBtn) {
            scanBtn.click(); // Automatically simulates clicking the scan button
        }
    });

    // 3. Sidebar Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const pageSections = document.querySelectorAll('.page-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all buttons
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked button
            item.classList.add('active');

            // Hide all page sections
            pageSections.forEach(section => {
                section.classList.remove('active');
            });

            // Show target section
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // 4. Backend API Integration (Phase 2: Network Info)
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    async function fetchNetworkInfo() {
        const ipDisplay = document.getElementById('gateway-ip-display');
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');

        try {
            const response = await fetch(`${API_BASE_URL}/network/info`);
            const data = await response.json();

            if (data.success) {
                // Update header with live IP and Subnet
                ipDisplay.textContent = `SUBNET: ${data.network_cidr} (HOST: ${data.local_ip})`;
                statusText.textContent = "Network Monitoring Active";
                statusDot.className = "status-dot online";
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error("Failed to fetch network info:", error);
            ipDisplay.textContent = "API DISCONNECTED";
            statusText.textContent = "Backend Offline";
            statusDot.className = "status-dot offline";
            // Note: you may need to add an .offline { background: red; } class in CSS
        }
    }

    // 5. Backend API Integration (Phase 4: Device Discovery)
    const scanBtn = document.getElementById('scan-network-btn');
    const metricDiscovered = document.getElementById('metric-discovered');
    const deviceTableBody = document.getElementById('device-table-body');

    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            // UI Loading State
            scanBtn.disabled = true;
            scanBtn.innerHTML = `<i data-lucide="loader"></i> Scanning...`;
            lucide.createIcons();

            try {
                const response = await fetch(`${API_BASE_URL}/devices`);
                const data = await response.json();

                if (data.success) {
                    // Update the Discovered metric
                    metricDiscovered.textContent = data.count;

                    // Clear the old placeholder rows
                    deviceTableBody.innerHTML = '';

                    // Populate table with live devices
                    data.devices.forEach(device => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${device.hostname}</td>
                            <td class="font-mono">${device.ip_address}</td>
                            <td class="font-mono">${device.mac_address}</td>
                            <td><span class="badge badge-online">Detected</span></td>
                        `;
                        deviceTableBody.appendChild(tr);
                    });
                } else {
                    console.error("Scan failed:", data.error);
                    alert("Scan failed: " + data.error);
                }
            } catch (error) {
                console.error("Error fetching devices:", error);
                alert("Failed to reach backend API. Is Flask running?");
            } finally {
                // Reset UI State
                scanBtn.disabled = false;
                scanBtn.innerHTML = `<i data-lucide="refresh-cw"></i> Scan Network`;
                lucide.createIcons();
            }
        });
    }

    // 6. Backend API Integration (Phase 3: Diagnostics & Live Metrics)
    const runPingBtn = document.getElementById('run-ping-btn');
    const pingInput = document.getElementById('ping-target-input');
    const pingResultsPanel = document.getElementById('ping-results-panel');
    const metricReachable = document.getElementById('metric-reachable');
    const metricLatency = document.getElementById('metric-latency');
    const metricPacketLoss = document.getElementById('metric-packet-loss'); // We'll target this or fallback safely

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

                    // Update Overview Dashboard Cards dynamically with real metrics
                    if (metricLatency) metricLatency.innerHTML = `${data.avg_latency_ms} <span class="unit">ms</span>`;
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

    // Enhance the existing device scan listener to calculate real reachable stats
    if (scanBtn) {
        const originalClick = scanBtn.onclick; // Preserve or extend
        scanBtn.addEventListener('click', async () => {
            // After devices fetch successfully, let's update reachable counter
            setTimeout(() => {
                const rows = document.querySelectorAll('#device-table-body tr');
                let onlineCount = 0;
                rows.forEach(row => {
                    const badge = row.querySelector('.badge');
                    if (badge && badge.classList.contains('badge-online')) onlineCount++;
                });
                if (metricReachable) metricReachable.textContent = onlineCount;
            }, 1000);
        });
    }

    // Execute the fetch immediately when the app loads
    fetchNetworkInfo();

});