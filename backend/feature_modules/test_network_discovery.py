import unittest
from unittest.mock import patch, MagicMock, call
import subprocess
import os
import sys

# Ensure this directory is in the path so mocking 'network_discovery' works reliably 
# regardless of where the test is executed from.
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import network_discovery
from network_discovery import get_local_network_info, get_arp_table, discover_devices

class TestNetworkDiscovery(unittest.TestCase):
    
    @patch('socket.socket')
    def test_get_local_network_info(self, mock_socket):
        # Mock the temporary socket connection to simulate a deterministic IP.
        # Must mock the __enter__ context manager since we now use a 'with' block.
        mock_instance = MagicMock()
        mock_instance.getsockname.return_value = ("192.168.1.50", 12345)
        mock_socket.return_value.__enter__.return_value = mock_instance
        
        info = get_local_network_info()
        self.assertEqual(info["local_ip"], "192.168.1.50")
        self.assertEqual(info["network_cidr"], "192.168.1.0/24")

    @patch('subprocess.run')
    def test_get_arp_table_success(self, mock_run):
        # Provide a fake standard ARP output to test regex parsing
        mock_result = MagicMock()
        mock_result.stdout = "  192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic\n"
        mock_run.return_value = mock_result
        
        arp = get_arp_table()
        self.assertIn("192.168.1.1", arp)
        self.assertEqual(arp["192.168.1.1"], "aa:bb:cc:dd:ee:ff")

    @patch('subprocess.run')
    def test_get_arp_table_failure(self, mock_run):
        # Verify that explicit error handling catches subprocess failures gracefully
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="arp -a", timeout=5)
        arp = get_arp_table()
        self.assertEqual(arp, {})

    @patch('network_discovery.get_local_network_info')
    @patch('network_discovery.get_arp_table')
    @patch('subprocess.run')
    @patch('platform.system')
    def test_discover_devices(self, mock_platform, mock_run, mock_arp, mock_net_info):
        mock_platform.return_value = "Windows"
        
        # Use a tiny /30 subnet (Network: .0, Usable: .1 and .2, Broadcast: .3)
        mock_net_info.return_value = {"local_ip": "192.168.1.1", "network_cidr": "192.168.1.0/30"}
        
        # Inject usable IPs (.1, .2), a broadcast IP (.3), and an out-of-subnet IP (.100)
        mock_arp.return_value = {
            "192.168.1.1": "00:11:22:33:44:55",
            "192.168.1.2": "aa:bb:cc:dd:ee:ff",
            "192.168.1.3": "ff:ff:ff:ff:ff:ff",  # Broadcast address (should be filtered)
            "192.168.1.100": "99:88:77:66:55:44" # Out of subnet (should be filtered)
        }

        devices = discover_devices(timeout=0.1)
        
        # 1. Verify ping was only fired for the 2 usable hosts in the /30 subnet
        expected_calls = [
            call(['ping', '-n', '1', '-w', '100', '192.168.1.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1.1),
            call(['ping', '-n', '1', '-w', '100', '192.168.1.2'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1.1)
        ]
        mock_run.assert_has_calls(expected_calls, any_order=True)
        
        # 2. Verify that broadcast (.3) and out-of-subnet (.100) IPs were excluded
        self.assertEqual(len(devices), 2)
        discovered_ips = [d["ip_address"] for d in devices]
        self.assertIn("192.168.1.1", discovered_ips)
        self.assertIn("192.168.1.2", discovered_ips)
        self.assertNotIn("192.168.1.3", discovered_ips)
        self.assertNotIn("192.168.1.100", discovered_ips)
        
        # 3. Verify dictionary structure consistency
        self.assertEqual(devices[0]["hostname"], "Unknown")
        self.assertEqual(devices[0]["status"], "online")

    @patch('network_discovery.get_local_network_info')
    def test_discover_devices_invalid_cidr(self, mock_net_info):
        mock_net_info.return_value = {"local_ip": "192.168.1.1", "network_cidr": "invalid-cidr"}
        devices = discover_devices()
        self.assertEqual(devices, [])

if __name__ == "__main__":
    unittest.main()