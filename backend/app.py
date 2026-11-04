from flask import Flask, jsonify
from flask_cors import CORS
from backend.feature_modules.network_discovery import get_local_network_info, discover_devices
from backend.feature_modules.diagnostics import run_ping
from backend.database.db import init_db, log_scan, log_ping

app = Flask(__name__)
# Enable CORS for all routes so the standalone frontend can access the API
CORS(app)
init_db() # Creates the aurelis.db file and tables if they don't exist

@app.route('/api/health', methods=['GET'])
def health_check():
    """Phase 1: Simple liveness check to ensure Flask is running."""
    return jsonify({
        "success": True,
        "status": "healthy"
    }), 200

@app.route('/api/network/info', methods=['GET'])
def network_info():
    """Phase 2: Retrieve active outbound IP and CIDR subnet block."""
    try:
        info = get_local_network_info()
        return jsonify({
            "success": True,
            "local_ip": info.get("local_ip"),
            "network_cidr": info.get("network_cidr")
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Phase 4: Perform local subnet sweep and retrieve ARP devices."""
    try:
        # The timeout parameter controls how long to wait for ping responses
        devices = discover_devices(timeout=1.0)
        
        # Log the scan to the SQLite database
        log_scan(devices)
        
        return jsonify({
            "success": True,
            "count": len(devices),
            "devices": devices
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/diagnostics/ping', methods=['POST'])
def diagnostic_ping():
    """Phase 3: Execute targeted ICMP ping diagnostics against a specific IP."""
    from flask import request
    data = request.get_json() or {}
    ip_address = data.get("ip_address")
    count = data.get("count", 4)

    if not ip_address:
        return jsonify({
            "success": False,
            "error": "Missing 'ip_address' in request body."
        }), 400

    try:
        # Enforce reasonable packet count limits to prevent abuse/timeouts
        count = max(1, min(int(count), 10))
        result = run_ping(ip_address, count=count)

        # Log the ping test to the SQLite database
        log_ping(
            ip_address=result.get("target"),
            status=result.get("status"),
            loss=result.get("packet_loss_percent"),
            latency=result.get("avg_latency_ms")
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Run the server on port 5000 with debug mode enabled for development
    app.run(debug=True, host='127.0.0.1', port=5000)