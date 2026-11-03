import unittest
from network_discovery import get_local_network_info, get_arp_table, discover_devices

class TestNetworkDiscovery(unittest.TestCase):
    def test_get_local_network_info(self):
        info = get_local_network_info()
        self.assertIn("local_ip", info)
        self.assertIn("network_cidr", info)

    def test_get_arp_table(self):
        arp = get_arp_table()
        self.assertIsInstance(arp, dict)

    def test_discover_devices_format(self):
        devices = discover_devices(timeout=0.1)
        self.assertIsInstance(devices, list)
        for dev in devices:
            self.assertIn("ip_address", dev)
            self.assertIn("mac_address", dev)
            self.assertIn("hostname", dev)
            self.assertIn("status", dev)

if __name__ == "__main__":
    unittest.main()