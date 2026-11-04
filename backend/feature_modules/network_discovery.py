"""
network_discovery.py
Module for discovering active local network configuration and reachable devices.
"""

import socket
import subprocess
import platform
import ipaddress
import re
import concurrent.futures

# Concurrency limit for ping sweeps. Easily adjustable if network bandwidth allows.
MAX_CONCURRENT_PINGS = 16

def get_local_network_info():
    """
    Detects the active local IP address and estimates the local network CIDR.
    Returns a dictionary with local network details.
    """
    local_ip = "127.0.0.1"
    try:
        # Using a context manager ensures the socket is cleanly closed immediately after use
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    # Known Limitation: Assumes a standard /24 local home/office network.
    try:
        interface_ip = ipaddress.ip_interface(f"{local_ip}/24")
        network_cidr = str(interface_ip.network)
    except Exception:
        network_cidr = "192.168.1.0/24"

    return {
        "local_ip": local_ip,
        "network_cidr": network_cidr
    }

def get_arp_table():
    """
    Retrieves the operating system's ARP table cache to map IPs to MAC addresses.
    """
    arp_entries = {}
    try:
        # shell=True removed. check=True ensures failed commands raise CalledProcessError
        result = subprocess.run(
            ["arp", "-a"], 
            capture_output=True, 
            text=True, 
            timeout=5,
            check=True
        )
        for line in result.stdout.splitlines():
            match = re.search(r"\(?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)?\s+(?:at\s+|[\w]+\s+)?([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})", line)
            if match:
                ip, mac = match.groups()
                arp_entries[ip] = mac.lower().replace("-", ":")
                
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        # Explicitly catching expected subprocess errors so they aren't masked.
        # FileNotFoundError triggers if 'arp' is somehow missing from the system PATH.
        pass
        
    return arp_entries

def discover_devices(timeout=1):
    """
    Identifies reachable devices within the authorized local network.
    Retrieves available IP addresses, MAC addresses, and hostnames.
    Returns a list of dictionaries in a consistent format.
    """
    net_info = get_local_network_info()
    network_cidr = net_info["network_cidr"]
    
    discovered_devices = []
    try:
        network = ipaddress.ip_network(network_cidr, strict=False)
    except ValueError:
        return discovered_devices

    # OS-specific ping parameters. Prioritizing Windows (-w is ms), falling back to Unix (-W).
    sys_platform = platform.system().lower()
    param = "-n" if sys_platform == "windows" else "-c"
    timeout_param = "-w" if sys_platform == "windows" else "-W"
    timeout_val = str(int(timeout * 1000)) if sys_platform == "windows" else str(timeout)

    def ping_host(ip_str):
        try:
            subprocess.run(
                ["ping", param, "1", timeout_param, timeout_val, ip_str],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=timeout + 1.0  # Python-level termination if OS ping command hangs
            )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass

    # Utilizes a bounded worker pool up to MAX_CONCURRENT_PINGS.
    # It continuously feeds pending pings to available workers instead of executing in batches.
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_PINGS) as executor:
        executor.map(ping_host, (str(ip) for ip in network.hosts()))

    arp_table = get_arp_table()

    for ip_str, mac in arp_table.items():
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            # Filter out the network address (.0) and broadcast address (.255)
            if ip_obj in network and ip_obj != network.network_address and ip_obj != network.broadcast_address:
                discovered_devices.append({
                    "ip_address": ip_str,
                    "mac_address": mac,
                    "hostname": "Unknown",
                    "status": "online"  # Indicates 'Detected' in ARP cache
                })
        except ValueError:
            continue

    return discovered_devices