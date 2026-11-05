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

            // (Add this inside renderDevices, right after it updates metricReachable)
            if (document.getElementById('map').classList.contains('active')) {
                drawNetworkMap();
            }
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

    // Network Topology Engine (Phase 7: Network Map)
    const mapCanvas = document.getElementById('network-topology-canvas');
    const mapTooltip = document.getElementById('map-tooltip');
    const refreshMapBtn = document.getElementById('refresh-map-btn');
    let mapNodes = []; // Stores node coordinates for hover detection

    function drawNetworkMap() {
        if (!mapCanvas) return;
        const ctx = mapCanvas.getContext('2d');
        const parent = mapCanvas.parentElement;

        // Dynamically size canvas to fit the panel perfectly
        mapCanvas.width = parent.clientWidth;
        mapCanvas.height = parent.clientHeight;

        const centerX = mapCanvas.width / 2;
        const centerY = mapCanvas.height / 2;

        ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

        const allDevices = Array.from(deviceTracker.values());
        if (allDevices.length === 0) {
            ctx.fillStyle = '#a7a9b2'; // --color-text-secondary
            ctx.font = '14px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Awaiting network scan data...', centerX, centerY);
            return;
        }

        // Identify Gateway (assuming typical .1 subnet router) and Clients
        let gateway = allDevices.find(d => d.ip_address.endsWith('.1'));
        let clients = allDevices.filter(d => !d.ip_address.endsWith('.1'));

        if (!gateway) {
            gateway = { ip_address: 'Gateway', hostname: 'Router', status: 'reachable', mac_address: 'N/A' };
        } else {
            clients = clients.filter(c => c.mac_address !== gateway.mac_address); // Prevent duplication
        }

        mapNodes = [];

        // Match your CSS Theme Colors
        const colorPink = '#EA7B94';
        const colorOnline = '#51A7F8';
        const colorOffline = '#91636d';
        const colorLine = 'rgba(255, 255, 255, 0.08)';

        // Draw Central Gateway Node
        mapNodes.push({ x: centerX, y: centerY, radius: 22, device: gateway, color: colorPink });

        // Calculate orbit for connected devices
        const radius = Math.min(centerX, centerY) - 90;
        const angleStep = (Math.PI * 2) / Math.max(clients.length, 1);

        // Draw connecting lines and calculate client coordinates
        clients.forEach((client, index) => {
            const angle = index * angleStep;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const isOnline = (client.status === 'reachable' || client.status === 'online');
            const nodeColor = isOnline ? colorOnline : colorOffline;

            mapNodes.push({ x, y, radius: 10, device: client, color: nodeColor });

            // Draw Line to Center
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = colorLine;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw Nodes on top of lines
        mapNodes.forEach(node => {
            // Tech Noir Glow Effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = node.color;

            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();

            ctx.shadowBlur = 0; // Reset shadow for text clarity

            // Node Label (Last octet of IP or short hostname)
            ctx.fillStyle = '#F3F0ED'; // --color-text-primary
            ctx.font = '11px "Space Mono", monospace';
            ctx.textAlign = 'center';

            let label = node.device.ip_address.split('.').pop();
            if (node.device === gateway) label = 'GW';

            ctx.fillText(label, node.x, node.y + node.radius + 16);
        });
    }

    // Interactivity: Hover Tooltip Detection
    if (mapCanvas) {
        mapCanvas.addEventListener('mousemove', (e) => {
            const rect = mapCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            let hoveredNode = null;

            // Check collision with any node
            for (let node of mapNodes) {
                const dx = mouseX - node.x;
                const dy = mouseY - node.y;
                if (Math.sqrt(dx * dx + dy * dy) < node.radius + 8) { // +8px padding for easier hovering
                    hoveredNode = node;
                    break;
                }
            }

            if (hoveredNode) {
                mapCanvas.style.cursor = 'crosshair';
                mapTooltip.style.display = 'block';
                // Keep tooltip bound within the panel
                const tooltipX = Math.min(mouseX + 15, mapCanvas.width - 200);
                const tooltipY = Math.min(mouseY + 15, mapCanvas.height - 100);

                mapTooltip.style.left = tooltipX + 'px';
                mapTooltip.style.top = tooltipY + 'px';
                mapTooltip.innerHTML = `
                    <strong style="color: ${hoveredNode.color}; font-size: 14px;">${hoveredNode.device.hostname}</strong><br>
                    <div style="margin-top: 6px; opacity: 0.8;">
                        IP: ${hoveredNode.device.ip_address}<br>
                        MAC: ${hoveredNode.device.mac_address || 'N/A'}<br>
                        Status: ${hoveredNode.device.status.toUpperCase()}
                    </div>
                `;
            } else {
                mapCanvas.style.cursor = 'default';
                mapTooltip.style.display = 'none';
            }
        });

        // Redraw dynamically if window resizes
        window.addEventListener('resize', () => {
            if (document.getElementById('map').classList.contains('active')) {
                drawNetworkMap();
            }
        });
    }

    // Connect to Navigation Clicks
    const mapNavBtn = document.querySelector('.nav-item[data-target="map"]');
    if (mapNavBtn) {
        mapNavBtn.addEventListener('click', () => {
            // 50ms delay allows CSS display:block to trigger so canvas can read clientWidth
            setTimeout(drawNetworkMap, 50);
        });
    }

    if (refreshMapBtn) {
        refreshMapBtn.addEventListener('click', drawNetworkMap);
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