// topology3d.js
// Phase 9: 3D Isometric Network Topology Engine (Three.js)

class Topology3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = this.container.querySelector('canvas');
        this.tooltip = document.getElementById('map-tooltip');

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.nodes = [];
        this.links = [];
        this.hoveredNode = null;

        // Animation loop control
        this.animationFrameId = null;
        this.isRunning = false;

        // Tech Noir CSS Variables mapping
        this.colors = {
            bg: 0x08090C,
            pink: 0xEA7B94,
            online: 0x51A7F8,
            offline: 0x91636d,
            glass: 0x191b21,
            line: 0x222430
        };

        this.init();
    }

    init() {
        // 1. Scene Setup
        this.scene = new THREE.Scene();
        // Set transparent background so the CSS radial gradient shows through
        this.scene.background = null;

        // 2. Camera Setup (Orthographic for Isometric Look)
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const d = 120; // View frustum size
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);

        // Isometric angle positioning
        this.camera.position.set(100, 100, 100);
        this.camera.lookAt(this.scene.position);

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // 4. Lighting (Atmospheric Tech Noir)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        this.scene.add(dirLight);

        const blueLight = new THREE.PointLight(this.colors.online, 1.5, 200);
        blueLight.position.set(-50, -20, -50);
        this.scene.add(blueLight);

        // 5. Event Listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    }

    // --- Geometries & Materials ---

    createGatewayNode() {
        // Main Router/Gateway (Cylinder)
        const geometry = new THREE.CylinderGeometry(8, 8, 4, 32);
        const material = new THREE.MeshPhongMaterial({
            color: this.colors.pink,
            transparent: true,
            opacity: 0.9,
            shininess: 100
        });
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    createClientNode(status) {
        // Client Server (Frosted Glass Cube with glowing core)
        const group = new THREE.Group();

        // Outer Glass Box
        const glassGeo = new THREE.BoxGeometry(10, 10, 10);
        const glassMat = new THREE.MeshPhongMaterial({
            color: this.colors.glass,
            transparent: true,
            opacity: 0.5,
            shininess: 80,
            depthWrite: false // Prevents sorting issues with transparent objects
        });
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        group.add(glassMesh);

        // Inner glowing core representing status
        const coreGeo = new THREE.BoxGeometry(6, 6, 6);
        const isOnline = (status === 'reachable' || status === 'online');
        const coreColor = isOnline ? this.colors.online : this.colors.offline;

        const coreMat = new THREE.MeshBasicMaterial({ color: coreColor });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        group.add(coreMesh);

        return group;
    }

    // --- Data Rendering ---

    buildGraph(devices) {
        // Clear existing scene
        this.nodes.forEach(n => this.scene.remove(n.mesh));
        this.links.forEach(l => this.scene.remove(l));
        this.nodes = [];
        this.links = [];

        if (!devices || devices.length === 0) return;

        // Separate Gateway from Clients
        let gatewayData = devices.find(d => d.ip_address.endsWith('.1'));
        let clientsData = devices.filter(d => !d.ip_address.endsWith('.1'));

        if (!gatewayData) {
            gatewayData = { ip_address: 'Gateway', hostname: 'Router', status: 'reachable', mac_address: 'N/A' };
        } else {
            clientsData = clientsData.filter(c => c.mac_address !== gatewayData.mac_address);
        }

        // 1. Position Gateway (Top Level)
        const gatewayMesh = this.createGatewayNode();
        gatewayMesh.position.set(0, 40, 0);
        this.scene.add(gatewayMesh);

        // Store node data for raycasting
        this.nodes.push({
            mesh: gatewayMesh,
            data: gatewayData,
            isGateway: true
        });

        // 2. Position Clients (Grid Layout on lower plane)
        const gridSize = Math.ceil(Math.sqrt(clientsData.length));
        const spacing = 30; // Distance between nodes
        const offset = ((gridSize - 1) * spacing) / 2;

        clientsData.forEach((client, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;

            const x = (col * spacing) - offset;
            const z = (row * spacing) - offset;
            const y = 0; // Lower plane

            const clientGroup = this.createClientNode(client.status);
            clientGroup.position.set(x, y, z);

            // Optional: Add a slight vertical entry animation using Tween
            clientGroup.position.y = -50;
            new TWEEN.Tween(clientGroup.position)
                .to({ y: 0 }, 1000 + (index * 100))
                .easing(TWEEN.Easing.Cubic.Out)
                .start();

            this.scene.add(clientGroup);
            this.nodes.push({
                mesh: clientGroup,
                data: client,
                isGateway: false
            });

            // 3. Draw Links (Dashed Lines from Gateway to Clients)
            const points = [];
            points.push(new THREE.Vector3(0, 38, 0)); // Bottom of gateway
            points.push(new THREE.Vector3(x, y + 5, z)); // Top of client

            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineDashedMaterial({
                color: this.colors.line,
                linewidth: 1,
                scale: 1,
                dashSize: 2,
                gapSize: 2
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.computeLineDistances(); // Required for dashed lines to render correctly

            this.scene.add(line);
            this.links.push(line);
        });
    }

    // --- Interaction & Lifecycle ---

    onMouseMove(event) {
        if (!this.isRunning) return;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Calculate objects intersecting the picking ray
        // Note: For groups (clients), we need to check intersection with their children
        const meshArray = this.nodes.map(n => n.mesh);
        // Add children of groups to raycaster check
        const hitTargets = [];
        this.nodes.forEach(n => {
            if (n.mesh.type === 'Group') {
                hitTargets.push(...n.mesh.children);
            } else {
                hitTargets.push(n.mesh);
            }
        });

        const intersects = this.raycaster.intersectObjects(hitTargets, false);

        if (intersects.length > 0) {
            this.container.style.cursor = 'crosshair';

            // Find which node object this mesh belongs to
            const hitMesh = intersects[0].object;
            const node = this.nodes.find(n => n.mesh === hitMesh || (n.mesh.type === 'Group' && n.mesh.children.includes(hitMesh)));

            if (node && node !== this.hoveredNode) {
                this.hoveredNode = node;
                this.showTooltip(event, node);

                // Highlight effect: scale up slightly
                new TWEEN.Tween(node.mesh.scale)
                    .to({ x: 1.2, y: 1.2, z: 1.2 }, 200)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
            } else if (node) {
                // Just update tooltip position
                this.updateTooltipPosition(event);
            }
        } else {
            this.container.style.cursor = 'default';
            this.hideTooltip();

            if (this.hoveredNode) {
                // Reset scale
                new TWEEN.Tween(this.hoveredNode.mesh.scale)
                    .to({ x: 1, y: 1, z: 1 }, 200)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
                this.hoveredNode = null;
            }
        }
    }

    onMouseLeave() {
        this.hideTooltip();
        if (this.hoveredNode) {
            new TWEEN.Tween(this.hoveredNode.mesh.scale)
                .to({ x: 1, y: 1, z: 1 }, 200)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
            this.hoveredNode = null;
        }
    }

    showTooltip(event, node) {
        const isOnline = (node.data.status === 'reachable' || node.data.status === 'online');
        const statusColor = isOnline ? '#51A7F8' : '#91636d';

        this.tooltip.innerHTML = `
            <strong style="color: ${node.isGateway ? '#EA7B94' : statusColor}; font-size: 14px;">
                ${node.data.hostname}
            </strong><br>
            <div style="margin-top: 6px; opacity: 0.8;">
                IP: ${node.data.ip_address}<br>
                MAC: ${node.data.mac_address || 'N/A'}<br>
                Status: ${node.data.status.toUpperCase()}
            </div>
        `;
        this.tooltip.style.display = 'block';
        this.updateTooltipPosition(event);
    }

    updateTooltipPosition(event) {
        const rect = this.container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Keep tooltip bound within the panel
        const tooltipX = Math.min(mouseX + 15, rect.width - 200);
        const tooltipY = Math.min(mouseY + 15, rect.height - 100);

        this.tooltip.style.left = tooltipX + 'px';
        this.tooltip.style.top = tooltipY + 'px';
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        const d = 120;

        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }

    pause() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    animate() {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        TWEEN.update(); // Update animations

        // Gentle floating effect for the gateway
        if (this.nodes.length > 0 && this.nodes[0].isGateway) {
            const time = Date.now() * 0.001;
            this.nodes[0].mesh.position.y = 40 + Math.sin(time * 2) * 2;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Global instance to be accessed by main.js
window.networkTopology3D = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        window.networkTopology3D = new Topology3D('map');
    }
});