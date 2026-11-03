import unittest
from diagnostics import run_ping

class TestDiagnostics(unittest.TestCase):
    def test_invalid_ip_address(self):
        result = run_ping("999.999.999.999", count=2)
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["packet_loss_percent"], 100.0)

    def test_unreachable_device(self):
        # RFC 5737 test network IP address guaranteed unreachable
        result = run_ping("192.0.2.1", count=2)
        self.assertEqual(result["status"], "unreachable")
        self.assertEqual(result["packet_loss_percent"], 100.0)

    def test_localhost_ping(self):
        result = run_ping("127.0.0.1", count=2)
        self.assertEqual(result["packets_sent"], 2)

if __name__ == "__main__":
    unittest.main()