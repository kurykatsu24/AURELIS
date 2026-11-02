# AURELIS API Contract
*This document will define the JSON data structures and endpoints used to pass data between Duke's   Python networking modules and Kurt's frontend dashboard.*

## 1. Network Discovery

Module:
backend/feature_modules/network_discovery.py

Function:
discover_devices()

Purpose:
Detect reachable devices within the
authorized local network.

Expected output:

{
    "success": true,
    "devices": [
        {
            "ip": "192.168.1.10",
            "mac": null,
            "hostname": null,
            "status": "online"
        }
    ]
}