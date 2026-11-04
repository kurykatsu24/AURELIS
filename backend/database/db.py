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