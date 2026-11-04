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

    // Execute the fetch immediately when the app loads
    fetchNetworkInfo();

});