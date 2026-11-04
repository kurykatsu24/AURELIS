from flask import Flask, jsonify
from flask_cors import CORS
from backend.feature_modules.network_discovery import get_local_network_info, discover_devices

app = Flask(__name__)
# Enable CORS for all routes so the standalone frontend can access the API
CORS(app)

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
        
if __name__ == '__main__':
    # Run the server on port 5000 with debug mode enabled for development
    app.run(debug=True, host='127.0.0.1', port=5000)