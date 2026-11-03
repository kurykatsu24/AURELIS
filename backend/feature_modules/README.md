# Network Feature Modules

Standalone backend modules for local network discovery and device diagnostics.

## Module Explanations

### 1. `network_discovery.py`
* **`get_local_network_info()`**: Identifies the primary local interface IP and calculates the local subnet CIDR.
* **`get_arp_table()`**: Inspects the host OS ARP cache to retrieve IP-to-MAC address mappings.
* **`discover_devices(timeout)`**: Executes a quick local subnet sweep, triggers ARP caching, and returns a structured list of active online devices containing their IP, MAC, hostname, and status.

### 2. `diagnostics.py`
* **`run_ping(ip_address, count)`**: Runs system ping subprocess commands against a target IP with a configurable packet count. Extracts packet loss percentages, round-trip times (min, avg, max), and properly handles invalid inputs or unreachable hosts.

## Required Python Libraries
* Uses Python standard library only (`socket`, `subprocess`, `platform`, `ipaddress`, `re`, `time`, `unittest`). No external dependencies or packages need to be added to `requirements.txt`.

## Instructions for Independent Execution & Testing
Run the individual unit test suites from your terminal using Python's built-in test runner:

```bash
# Run network discovery tests
python -m unittest test_network_discovery.py

# Run connectivity diagnostics tests
python -m unittest test_diagnostics.py




### Step 5: Test Results Summary

When running the unit tests independently, you can expect the following outcomes:
1. **Network Discovery Unit Tests (`test_network_discovery.py`)**: Successfully returns local IP attributes, queries the local ARP cache, and structures discovered items into standard dictionaries.
2. **Invalid IP Diagnostics Test (`999.999.999.999`)**: Handled smoothly, returning `"status": "error"`, `"packet_loss_percent": 100.0`, and an descriptive error message.
3. **Unreachable Device Test (`192.0.2.1`)**: Handled gracefully, returning `"status": "unreachable"` with `100.0%` packet loss without raising unhandled exceptions.