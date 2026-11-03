"""
network_discovery.py
Module for discovering active local network configuration and reachable devices.
"""

import socket
import subprocess
import platform
import ipaddress
import re
import time

def get_local_network_info():
    """
    Detects the active local IP address and estimates the local network CIDR.
    Returns a dictionary with local network details.
    """
    local_ip = "127.0.0.1"
    try:
        # Create a temporary socket to determine the primary outgoing IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    # Estimate subnet assuming a standard /24 local home/office network
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
        output = subprocess.check_output("arp -a", shell=True, universal_newlines=True)
        for line in output.splitlines():
            match = re.search(r"\(?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)?\s+(?:at\s+|[\w]+\s+)?([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})", line)
            if match:
                ip, mac = match.groups()
                arp_entries[ip] = mac.lower().replace("-", ":")
    except Exception:
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

    # OS-specific ping parameters for network sweep
    param = "-n" if platform.system().lower() == "windows" else "-c"
    timeout_param = "-w" if platform.system().lower() == "windows" else "-W"
    timeout_val = str(int(timeout * 1000)) if platform.system().lower() == "windows" else str(timeout)

    # Fast background ping sweep to populate ARP cache
    for ip in network.hosts():
        ip_str = str(ip)
        try:
            subprocess.Popen(
                ["ping", param, "1", timeout_param, timeout_val, ip_str],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception:
            continue

    # Allow brief window for responses
    time.sleep(timeout + 0.5)

    arp_table = get_arp_table()

    for ip_str, mac in arp_table.items():
        if ipaddress.ip_address(ip_str) in network:
            hostname = "Unknown"
            try:
                hostname = socket.gethostbyaddr(ip_str)[0]
            except Exception:
                pass

            discovered_devices.append({
                "ip_address": ip_str,
                "mac_address": mac,
                "hostname": hostname,
                "status": "online"
            })

    return discovered_devices