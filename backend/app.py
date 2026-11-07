import threading
import time
from flask import Flask, jsonify
from flask_cors import CORS
from backend.feature_modules.network_discovery import get_local_network_info, discover_devices
from backend.feature_modules.diagnostics import run_ping
from backend.database.db import init_db, log_scan, log_ping, get_recent_scans, get_recent_pings, clear_all_history, get_all_scans_for_export, get_all_pings_for_export, get_latest_scan_devices, get_network_statistics

app = Flask(__name__)
# Enable CORS for all routes so the standalone frontend can access the API
CORS(app)
init_db() # Creates the aurelis.db file and tables if they don't exist

# --- BACKGROUND SCANNER DAEMON ---
latest_scan_cache = {
    "devices": [],
    "last_scanned": None,
    "is_scanning": False
}
cache_lock = threading.Lock()

def background_network_scanner(interval=15):
    """Continuously refreshes network inventory without blocking HTTP requests."""
    while True:
        with cache_lock:
            latest_scan_cache["is_scanning"] = True
        try:
            devices = discover_devices(timeout=1.0)
            log_scan(devices)
            with cache_lock:
                latest_scan_cache["devices"] = devices
                latest_scan_cache["last_scanned"] = time.time()
        except Exception as e:
            print(f"Background scan error: {e}")
        finally:
            with cache_lock:
                latest_scan_cache["is_scanning"] = False
        time.sleep(interval)

scan_thread = threading.Thread(target=background_network_scanner, daemon=True)
scan_thread.start()
# ---------------------------------

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
    """Phase 4: Return immediate cached network snapshot without blocking."""
    with cache_lock:
        return jsonify({
            "success": True,
            "count": len(latest_scan_cache["devices"]),
            "devices": latest_scan_cache["devices"],
            "last_scanned": latest_scan_cache["last_scanned"],
            "is_scanning": latest_scan_cache["is_scanning"]
        }), 200

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

@app.route('/api/history/scans', methods=['GET'])
def history_scans():
    try:
        scans = get_recent_scans()
        return jsonify({"success": True, "data": scans}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/history/pings', methods=['GET'])
def history_pings():
    try:
        pings = get_recent_pings()
        return jsonify({"success": True, "data": pings}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    try:
        clear_all_history()
        return jsonify({"success": True, "message": "History cleared successfully."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/history/export/scans', methods=['GET'])
def export_scans_csv():
    import csv
    import io
    from flask import Response
    try:
        scans = get_all_scans_for_export()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Scan ID', 'Timestamp', 'Discovered Count'])
        for s in scans:
            writer.writerow([s['id'], s['timestamp'], s['discovered_count']])
        
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=network_scans_history.csv"}
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/history/export/pings', methods=['GET'])
def export_pings_csv():
    import csv
    import io
    from flask import Response
    try:
        pings = get_all_pings_for_export()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Target IP', 'Status', 'Packet Loss (%)', 'Avg Latency (ms)'])
        for p in pings:
            writer.writerow([p['timestamp'], p['ip_address'], p['status'], p['packet_loss_percent'], p['avg_latency_ms']])
        
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=ping_diagnostics_history.csv"}
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/security/alerts', methods=['GET'])
def security_alerts():
    """Phase 6: Automated Security & Health Rule Engine"""
    try:
        devices = get_latest_scan_devices()
        pings = get_recent_pings(limit=10)
        
        alerts = []
        
        # Rule 1: Device Authentication / Unknown Nodes
        unknown_count = sum(1 for d in devices if d.get('hostname', 'Unknown') == 'Unknown')
        if unknown_count > 0:
            alerts.append({
                "id": "SEC-001",
                "type": "warning",
                "icon": "shield-alert",
                "title": "Unrecognized Devices on Network",
                "message": f"Detected {unknown_count} device(s) with unresolved hostnames.",
                "recommendation": "Review the Device Inventory and verify these MAC addresses belong to trusted personal hardware."
            })
            
        # Rule 2: Reachability / Dead Nodes
        unreachable_count = sum(1 for d in devices if d.get('status') in ['unreachable', 'offline', 'error'])
        if unreachable_count > 0:
            alerts.append({
                "id": "SEC-002",
                "type": "info",
                "icon": "wifi-off",
                "title": "Offline or Stealth Nodes",
                "message": f"{unreachable_count} previously discovered device(s) are currently unreachable.",
                "recommendation": "If these devices should be active, verify their power state. Otherwise, they may be battery-saving mobile devices."
            })
            
        # Rule 3: High Latency Check
        high_latency = [p for p in pings if p.get('avg_latency_ms', 0) > 100]
        if high_latency:
            alerts.append({
                "id": "SEC-003",
                "type": "critical",
                "icon": "activity",
                "title": "Degraded Network Performance",
                "message": "Detected latency over 100ms in recent ping diagnostic tests.",
                "recommendation": "Check for bandwidth hogs, ISP throttling, or excessive wireless interference."
            })
            
        # If no issues are found, return a clean bill of health
        if not alerts:
            alerts.append({
                "id": "SEC-OK",
                "type": "success",
                "icon": "shield-check",
                "title": "Network Secure",
                "message": "No immediate security vulnerabilities or performance anomalies detected.",
                "recommendation": "Continue standard baseline monitoring."
            })
            
        return jsonify({"success": True, "data": alerts}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/reports/statistics', methods=['GET'])
def reports_statistics():
    """Phase 7: Network Statistics Aggregation"""
    try:
        stats = get_network_statistics()
        return jsonify({"success": True, "data": stats}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/network/performance', methods=['GET'])
def network_performance_chart():
    """Phase 10: Fetch historical device counts for the Overview line chart."""
    try:
        scans = get_recent_scans(limit=10) # Only pull the last 10
        scans.reverse() # Oldest to newest
        
        # Return the full raw timestamp string, frontend will parse it
        labels = [s['timestamp'] for s in scans]
        data = [s['discovered_count'] for s in scans]
        
        return jsonify({
            "success": True, 
            "labels": labels,
            "data": data
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Run the server on port 5000 with debug mode enabled for development
    app.run(debug=True, host='127.0.0.1', port=5000)