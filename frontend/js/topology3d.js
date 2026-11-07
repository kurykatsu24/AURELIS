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
        // PAN CAMERA DOWN: Looking at Y = -30 pushes the whole structure UP on the screen
        this.camera.lookAt(0, -40, 0);

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
        const group = new THREE.Group();

        // The squashed cylinder (Router)
        const geometry = new THREE.CylinderGeometry(14, 14, 6, 32);

        // Custom material to mimic the Figma pink gradient
        const material = new THREE.MeshPhongMaterial({
            color: 0xEA7B94,
            emissive: 0xCE3E5E,
            emissiveIntensity: 0.4,
            shininess: 100
        });
        const mesh = new THREE.Mesh(geometry, material);

        // Add white outline (EdgesGeometry)
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const outline = new THREE.LineSegments(edges, lineMat);

        // Add white outer glow (Sprite)
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.65)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(45, 45, 1);

        group.add(mesh);
        group.add(outline);
        group.add(glow);
        return group;
    }

    createClientNode(status) {
        const group = new THREE.Group();
        const size = 10;
        const geometry = new THREE.BoxGeometry(size, size, size);

        // Custom Shader to mimic the Figma blue radial gradient per facet
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        const fragmentShader = `
            varying vec2 vUv;
            uniform vec3 colorCenter;
            uniform vec3 colorEdge;
            void main() {
                float dist = distance(vUv, vec2(0.5));
                vec3 finalColor = mix(colorCenter, colorEdge, smoothstep(0.0, 0.8, dist));
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const isOnline = (status === 'reachable' || status === 'online');
        const cCenter = isOnline ? new THREE.Color(0x51A7F8) : new THREE.Color(0x91636d);
        const cEdge = isOnline ? new THREE.Color(0xC3E2FF) : new THREE.Color(0x4a3237);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                colorCenter: { value: cCenter },
                colorEdge: { value: cEdge }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        const mesh = new THREE.Mesh(geometry, material);

        // White frame outline
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        const outline = new THREE.LineSegments(edges, lineMat);

        // White outer glow (Sprite)
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.54)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(35, 35, 1);

        group.add(mesh);
        group.add(outline);
        group.add(glow);
        return group;
    }

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

        // ==========================================
        // MANUAL POSITIONING CONTROLS
        // Adjust these numbers to move the map!
        // ==========================================
        const layoutConfig = {
            gatewayHeight: 70,    // How high up the Pink Router sits. Increase to move up.
            clientHeight: -40,    // How low the Blue Cubes sit. Increase to move up.
            baseSpacing: 40,      // The default distance between cubes (<= 10 devices).
            compactSpacing: 30,   // The distance between cubes (> 10 devices).
            lineAnchorOffset: -5  // Where the dashed line connects to the router (negative = bottom of router).
        };

        // 1. Position Gateway (Top Level)
        const gatewayMesh = this.createGatewayNode();
        // Move gateway higher up using layoutConfig
        gatewayMesh.position.set(0, layoutConfig.gatewayHeight, 0);
        this.scene.add(gatewayMesh);

        // ADD THIS LINE: Store the height for the animation loop
        this.gatewayBaseY = layoutConfig.gatewayHeight;

        this.nodes.push({
            mesh: gatewayMesh,
            data: gatewayData,
            isGateway: true
        });

        // 2. Position Clients (Centered Diamond Grid)
        const clientCount = clientsData.length;
        // Scale spacing based on network size using layoutConfig
        const spacing = clientCount <= 10 ? layoutConfig.baseSpacing : layoutConfig.compactSpacing;
        const gridSize = Math.ceil(Math.sqrt(clientCount));

        // Calculate offset to center the grid perfectly under the gateway
        const offset = ((gridSize - 1) * spacing) / 2;
        let currentIndex = 0;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (currentIndex >= clientCount) break;

                const client = clientsData[currentIndex];

                // Centered diamond coordinates
                const x = (col * spacing) - offset;
                const z = (row * spacing) - offset;
                const y = layoutConfig.clientHeight; // Lower plane

                const clientGroup = this.createClientNode(client.status);
                clientGroup.position.set(x, y, z);

                // Entry animation
                clientGroup.position.y = -60;
                new TWEEN.Tween(clientGroup.position)
                    .to({ y: y }, 1000 + (currentIndex * 50))
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();

                this.scene.add(clientGroup);
                this.nodes.push({
                    mesh: clientGroup,
                    data: client,
                    isGateway: false
                });

                // 3. Draw Dashed White Lines
                const points = [];
                // Connect to the bottom center of the router using layoutConfig
                points.push(new THREE.Vector3(0, layoutConfig.gatewayHeight + layoutConfig.lineAnchorOffset, 0));
                points.push(new THREE.Vector3(x, y + 5, z)); // Top of client

                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineDashedMaterial({
                    color: 0xffffff,
                    linewidth: 1,
                    scale: 1,
                    dashSize: 4,
                    gapSize: 2,
                    transparent: true,
                    opacity: 0.4
                });
                const line = new THREE.Line(lineGeo, lineMat);
                line.computeLineDistances();

                this.scene.add(line);
                this.links.push(line);

                currentIndex++;
            }
        }
    }

    // --- Interaction & Lifecycle ---

    onMouseMove(event) {
        if (!this.isRunning) return;

        // FIXED Coordinate Calculation for Raycaster
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hitTargets = [];
        this.nodes.forEach(n => {
            hitTargets.push(n.mesh.children[0]); // Only target the inner Mesh, not the outline or sprite
        });

        const intersects = this.raycaster.intersectObjects(hitTargets, false);

        if (intersects.length > 0) {
            this.container.style.cursor = 'crosshair';

            const hitMesh = intersects[0].object;
            const node = this.nodes.find(n => n.mesh.children[0] === hitMesh);

            if (node && node !== this.hoveredNode) {
                if (this.hoveredNode) this.resetNodeScale(this.hoveredNode);

                this.hoveredNode = node;
                this.showTooltip(event, node);

                new TWEEN.Tween(node.mesh.scale)
                    .to({ x: 1.15, y: 1.15, z: 1.15 }, 200)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
            } else if (node) {
                this.updateTooltipPosition(event);
            }
        } else {
            this.container.style.cursor = 'default';
            this.hideTooltip();

            if (this.hoveredNode) {
                this.resetNodeScale(this.hoveredNode);
                this.hoveredNode = null;
            }
        }
    }

    resetNodeScale(node) {
        new TWEEN.Tween(node.mesh.scale)
            .to({ x: 1, y: 1, z: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
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
        // Apply the neon glow classes we added in CSS based on node type
        const glowClass = node.isGateway ? 'glow-pink' : 'glow-blue';

        this.tooltip.innerHTML = `
            <div class="tooltip-header ${glowClass}">${node.data.hostname}</div>
            <div style="margin-top: 8px; opacity: 0.9; line-height: 1.6;">
                IP: ${node.data.ip_address}<br>
                MAC: ${node.data.mac_address || 'N/A'}<br>
                Status: ${node.data.status.toUpperCase()}
            </div>
        `;
        this.tooltip.style.display = 'block';
        this.updateTooltipPosition(event);
    }

    updateTooltipPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        this.tooltip.style.display = 'block';

        // ==========================================
        // MANUAL TOOLTIP BOUNDS CONTROLS
        // Tweak these numbers to fix edge bleeding!
        // ==========================================

        // 1. If the bottom bleeds, INCREASE this number (try 160, 180, or 200). 
        // This tells the math the box is taller than it really is, forcing it up earlier.
        const TOOLTIP_HEIGHT = 250;

        // 2. If the right side bleeds, INCREASE this number.
        const TOOLTIP_WIDTH = 250;

        // 3. The minimum distance (in pixels) the tooltip must keep from the walls.
        const EDGE_PADDING = 20;

        let finalX = mouseX + 15;
        let finalY = mouseY + 15;

        // OPTIONAL FLIP MECHANIC: 
        // If the mouse is within 150px of the bottom floor, flip the tooltip ABOVE the cursor.
        // If it still bleeds, increase '150' to '200' to make it flip sooner.
        if (mouseY > rect.height - 150) {
            finalY = mouseY - TOOLTIP_HEIGHT - 10;
        }

        // STRICT BRICK WALL CLAMP
        finalX = Math.max(EDGE_PADDING, Math.min(finalX, rect.width - TOOLTIP_WIDTH - EDGE_PADDING));
        finalY = Math.max(EDGE_PADDING, Math.min(finalY, rect.height - TOOLTIP_HEIGHT - EDGE_PADDING));

        this.tooltip.style.bottom = 'auto';
        this.tooltip.style.right = 'auto';
        this.tooltip.style.left = finalX + 'px';
        this.tooltip.style.top = finalY + 'px';
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

        // Gentle floating effect for the gateway (NOW USES DYNAMIC HEIGHT)
        if (this.nodes.length > 0 && this.nodes[0].isGateway && this.gatewayBaseY) {
            const time = Date.now() * 0.001;
            // Uses your layoutConfig height and adds a 2px bounce
            this.nodes[0].mesh.position.y = this.gatewayBaseY + Math.sin(time * 2) * 2;
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