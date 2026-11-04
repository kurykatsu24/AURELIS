CREATE TABLE IF NOT EXISTS network_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    discovered_count INTEGER
);

CREATE TABLE IF NOT EXISTS device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER,
    ip_address TEXT,
    mac_address TEXT,
    hostname TEXT,
    status TEXT,
    FOREIGN KEY(scan_id) REFERENCES network_scans(id)
);

CREATE TABLE IF NOT EXISTS ping_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    status TEXT,
    packet_loss_percent REAL,
    avg_latency_ms REAL
);