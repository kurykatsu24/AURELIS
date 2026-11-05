import sqlite3
import os

# Ensures the database file is created inside the backend/database folder
DB_PATH = os.path.join(os.path.dirname(__file__), 'aurelis.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        with open(SCHEMA_PATH, 'r') as f:
            conn.executescript(f.read())

def log_scan(devices):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO network_scans (discovered_count) VALUES (?)", (len(devices),))
        scan_id = cursor.lastrowid
        
        for dev in devices:
            cursor.execute(
                "INSERT INTO device_history (scan_id, ip_address, mac_address, hostname, status) VALUES (?, ?, ?, ?, ?)",
                (scan_id, dev.get('ip_address'), dev.get('mac_address'), dev.get('hostname'), dev.get('status'))
            )
        conn.commit()

def log_ping(ip_address, status, loss, latency):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO ping_logs (ip_address, status, packet_loss_percent, avg_latency_ms) VALUES (?, ?, ?, ?)",
            (ip_address, status, loss, latency)
        )
        conn.commit()

def get_recent_scans(limit=15):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, timestamp, discovered_count FROM network_scans ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]

def get_recent_pings(limit=15):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, timestamp, ip_address, status, packet_loss_percent, avg_latency_ms FROM ping_logs ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]

def clear_all_history():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM device_history")
        cursor.execute("DELETE FROM network_scans")
        cursor.execute("DELETE FROM ping_logs")
        conn.commit()

def get_all_scans_for_export():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, timestamp, discovered_count FROM network_scans ORDER BY timestamp DESC")
        return [dict(row) for row in cursor.fetchall()]

def get_all_pings_for_export():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT timestamp, ip_address, status, packet_loss_percent, avg_latency_ms FROM ping_logs ORDER BY timestamp DESC")
        return [dict(row) for row in cursor.fetchall()]

def get_latest_scan_devices():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Find the ID of the most recent scan
        cursor.execute("SELECT id FROM network_scans ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            return []
        
        # Fetch the devices linked to that specific scan ID
        scan_id = row['id']
        cursor.execute("SELECT ip_address, mac_address, hostname, status FROM device_history WHERE scan_id = ?", (scan_id,))
        return [dict(r) for r in cursor.fetchall()]

def get_network_statistics():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Aggregates ping data grouping by IP Address
        cursor.execute("""
            SELECT ip_address, 
                   COUNT(id) as total_tests,
                   ROUND(AVG(avg_latency_ms), 2) as avg_latency, 
                   ROUND(MAX(avg_latency_ms), 2) as max_latency, 
                   ROUND(AVG(packet_loss_percent), 2) as avg_packet_loss 
            FROM ping_logs 
            GROUP BY ip_address
            ORDER BY avg_latency DESC
        """)
        return [dict(row) for row in cursor.fetchall()]