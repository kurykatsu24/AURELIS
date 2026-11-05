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
import subprocess
import platform
import re

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
    Retrieves the OS ARP table cache to map IPs to MAC addresses.
    Robust against both Windows tabular format and macOS parenthetical format.
    """
    arp_entries = {}
    try:
        result = subprocess.run(
            ["arp", "-a"], 
            capture_output=True, 
            text=True, 
            timeout=5,
            check=True
        )
        
        # This regex universally catches IPs (with or without parentheses) and MACs (with hyphens or colons)
        for line in result.stdout.splitlines():
            match = re.search(r"\(?(\d+\.\d+\.\d+\.\d+)\)?\s+(?:at\s+)?([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})", line)
            if match:
                ip = match.group(1)
                mac = match.group(2).lower().replace("-", ":")
                arp_entries[ip] = mac
                
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        pass
        
    return arp_entries

def discover_devices(timeout=1):
    """
    Identifies reachable devices within the authorized local network.
    """
    net_info = get_local_network_info()
    network_cidr = net_info["network_cidr"]
    
    discovered_devices = []
    try:
        network = ipaddress.ip_network(network_cidr, strict=False)
    except ValueError:
        return discovered_devices

    # OS-specific ping parameters
    sys_platform = platform.system().lower()
    
    if sys_platform == "windows":
        param, timeout_param, timeout_val = "-n", "-w", str(int(timeout * 1000))
    elif sys_platform == "darwin": # macOS
        param, timeout_param, timeout_val = "-c", "-t", str(timeout)
    else: # Linux
        param, timeout_param, timeout_val = "-c", "-W", str(timeout)

    def ping_host(ip_str):
        try:
            subprocess.run(
                ["ping", param, "1", timeout_param, timeout_val, ip_str],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=timeout + 1.0 
            )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENT_PINGS) as executor:
        executor.map(ping_host, (str(ip) for ip in network.hosts()))

    arp_table = get_arp_table()

    for ip_str, mac in arp_table.items():
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj in network and ip_obj != network.network_address and ip_obj != network.broadcast_address:
                discovered_devices.append({
                    "ip_address": ip_str,
                    "mac_address": mac,
                    "hostname": "Unknown",
                    "status": "online" 
                })
        except ValueError:
            continue

    return discovered_devices