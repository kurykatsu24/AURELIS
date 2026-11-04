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
            if (!isLightNow) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('aurelis-theme', 'light');
                updateThemeIcon(true);
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('aurelis-theme', 'dark');
                updateThemeIcon(false);
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

    function renderDevices() {
        // Sort devices in reverse chronological order (newest connections first)
        const allDevices = Array.from(deviceTracker.values()).sort((a, b) => b.firstSeen - a.firstSeen);

        const createRow = (device) => {
            const tr = document.createElement('tr');
            // Create a clean HH:MM:SS timestamp
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

            tr.innerHTML = `
                <td>${device.hostname}</td>
                <td class="font-mono">${device.ip_address}</td>
                <td class="font-mono">${device.mac_address}</td>
                <td class="font-mono" style="opacity: 0.7;">${timeString}</td>
                <td><span class="badge ${badgeClass}">${displayStatus}</span></td>
            `;
            return tr;
        };

        // Render Overview Preview (Strictly capped at 10 items)
        if (deviceTableBody) {
            deviceTableBody.innerHTML = '';
            allDevices.slice(0, 10).forEach(device => deviceTableBody.appendChild(createRow(device)));
        }

        // Render Full Device Inventory Tab (Uncapped, shows all devices)
        if (fullInventoryBody) {
            fullInventoryBody.innerHTML = '';
            allDevices.forEach(device => fullInventoryBody.appendChild(createRow(device)));
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
        }
    }

    // Network Scan Execution
    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            scanBtn.disabled = true;
            scanBtn.innerHTML = `<i data-lucide="loader"></i> Scanning...`;
            lucide.createIcons();

            try {
                const response = await fetch(`${API_BASE_URL}/devices`);
                const data = await response.json();

                if (data.success) {
                    data.devices.forEach(device => {
                        if (!deviceTracker.has(device.mac_address)) {
                            // Stamp entirely new devices with a creation timestamp
                            device.firstSeen = new Date();
                            deviceTracker.set(device.mac_address, device);
                        } else {
                            // Update dynamic data (like IP changes) but retain original timestamp
                            const existing = deviceTracker.get(device.mac_address);
                            existing.ip_address = device.ip_address;
                            // Only update status if the device hasn't been explicitly confirmed 'unreachable' by a targeted ping
                            if (existing.status !== 'unreachable') {
                                existing.status = device.status;
                            }
                        }
                    });

                    if (metricDiscovered) metricDiscovered.textContent = deviceTracker.size;
                    renderDevices();
                } else {
                    console.error("Scan failed:", data.error);
                    alert("Scan failed: " + data.error);
                }
            } catch (error) {
                console.error("Error fetching devices:", error);
                alert("Failed to reach backend API. Is Flask running?");
            } finally {
                scanBtn.disabled = false;
                scanBtn.innerHTML = `<i data-lucide="refresh-cw"></i> Scan Network`;
                lucide.createIcons();
            }
        });
    }

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

    // Execute the fetch immediately when the app loads
    fetchNetworkInfo();

    // Auto-trigger network scan on initial page load AND every 15 seconds
    window.addEventListener('load', () => {
        if (scanBtn) {
            scanBtn.click(); // Initial scan

            // Set up recurring automatic scans every 15 seconds (15000 milliseconds)
            setInterval(() => {
                // Only trigger if a scan isn't already running
                if (!scanBtn.disabled) {
                    scanBtn.click();
                }
            }, 15000);
        }
    });
});