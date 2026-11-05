"""
diagnostics.py
Module for performing network connectivity testing and diagnostics on target IP addresses.
"""

import subprocess
import platform
import re
import ipaddress

def run_ping(ip_address, count=4):
    """
    Perform connectivity testing on a selected IP address with a configurable count.
    Calculates average latency, maximum latency, and packet loss.
    Handles invalid IP addresses and unreachable devices properly.
    Returns results in a consistent dictionary format.
    """
    # 1. Validate IP address format
    try:
        ipaddress.ip_address(ip_address)
    except ValueError:
        return {
            "target": ip_address,
            "status": "error",
            "message": "Invalid IP address format.",
            "packets_sent": count,
            "packets_received": 0,
            "packet_loss_percent": 100.0,
            "min_latency_ms": 0.0,
            "avg_latency_ms": 0.0,
            "max_latency_ms": 0.0
        }

    # 2. OS-specific ping parameters to prevent hanging on macOS/Linux
    sys_platform = platform.system().lower()
    if sys_platform == "windows":
        param, timeout_param, timeout_val = "-n", "-w", "1000"
    elif sys_platform == "darwin": # macOS
        param, timeout_param, timeout_val = "-c", "-t", "1"
    else: # Linux
        param, timeout_param, timeout_val = "-c", "-W", "1"

    command = ["ping", param, str(count), timeout_param, timeout_val, ip_address]
    process_timeout = count * 1.5  # Python-level failsafe timeout

    try:
        output = subprocess.check_output(command, universal_newlines=True, stderr=subprocess.STDOUT, timeout=process_timeout)
    except subprocess.TimeoutExpired as e:
        output = str(e.output) if e.output else ""
    except subprocess.CalledProcessError as e:
        output = e.output
    except Exception as e:
        return {
            "target": ip_address,
            "status": "unreachable",
            "message": f"Execution failed: {str(e)}",
            "packets_sent": count,
            "packets_received": 0,
            "packet_loss_percent": 100.0,
            "min_latency_ms": 0.0,
            "avg_latency_ms": 0.0,
            "max_latency_ms": 0.0
        }

    packet_loss = 100.0
    received = 0
    min_lat, avg_lat, max_lat = 0.0, 0.0, 0.0

    # Parse packet loss percentage
    loss_match = re.search(r"(\d+(?:\.\d+)?)%\s*(?:packet\s*)?loss", output, re.IGNORECASE)
    if loss_match:
        packet_loss = float(loss_match.group(1))
        received = int(count * (1.0 - (packet_loss / 100.0)))

    # Parse RTT latency stats across operating systems
    win_rtt = re.search(r"Minimum\s*=\s*([0-9.]+)\s*ms.*?Maximum\s*=\s*([0-9.]+)\s*ms.*?Average\s*=\s*([0-9.]+)\s*ms", output, re.IGNORECASE | re.DOTALL)
    unix_rtt = re.search(r"(?:round-trip|rtt)\s+min/avg/max/(?:mdev|stddev)\s*=\s*([0-9.]+)/([0-9.]+)/([0-9.]+)", output, re.IGNORECASE)

    if win_rtt:
        min_lat = float(win_rtt.group(1))
        max_lat = float(win_rtt.group(2))
        avg_lat = float(win_rtt.group(3))
    elif unix_rtt:
        min_lat = float(unix_rtt.group(1))
        avg_lat = float(unix_rtt.group(2))
        max_lat = float(unix_rtt.group(3))

    status = "reachable" if received > 0 else "unreachable"

    return {
        "target": ip_address,
        "status": status,
        "message": "Success" if status == "reachable" else "Device unreachable or request timed out.",
        "packets_sent": count,
        "packets_received": received,
        "packet_loss_percent": packet_loss,
        "min_latency_ms": min_lat,
        "avg_latency_ms": avg_lat,
        "max_latency_ms": max_lat
    }