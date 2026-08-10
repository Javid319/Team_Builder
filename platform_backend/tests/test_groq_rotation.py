import unittest
from unittest.mock import MagicMock, patch

from app.core.config import Settings
from app.services.skill_confidence.groq_client import GroqKeyRotator


class TestGroqKeyRotation(unittest.TestCase):

    def test_settings_key_parsing_single_key(self):
        s = Settings(
            secret_key="secret",
            database_url="sqlite:///:memory:",
            groq_api_key="key_1",
            groq_api_key_2="",
            groq_api_key_3="",
            groq_api_key_4="",
            groq_api_key_5="",
            groq_api_keys="",
        )
        self.assertEqual(s.groq_api_keys_list, ["key_1"])

    def test_settings_key_parsing_multiple_keys_and_cap_at_5(self):
        s = Settings(
            secret_key="secret",
            database_url="sqlite:///:memory:",
            groq_api_key="key_1",
            groq_api_key_2="key_2",
            groq_api_key_3="key_3",
            groq_api_key_4="key_4",
            groq_api_key_5="key_5",
            groq_api_keys="key_6, key_7, key_1",  # key_6, key_7, plus key_1 duplicate
        )
        # Total unique keys: key_6, key_7, key_1, key_2, key_3, key_4, key_5
        # Must be capped strictly at 5 keys maximum
        self.assertEqual(len(s.groq_api_keys_list), 5)
        self.assertEqual(s.groq_api_keys_list, ["key_6", "key_7", "key_1", "key_2", "key_3"])

    def test_groq_rotator_round_robin(self):
        keys = ["key_A", "key_B", "key_C"]

        with patch("app.services.skill_confidence.groq_client.Groq", side_effect=lambda **kwargs: MagicMock()):
            rotator = GroqKeyRotator(keys)
            self.assertEqual(rotator.key_count, 3)

            call_records = []

            def dummy_call(client):
                call_records.append(client)
                return "success"

            res1 = rotator.execute_with_failover(dummy_call)
            res2 = rotator.execute_with_failover(dummy_call)
            res3 = rotator.execute_with_failover(dummy_call)

            self.assertEqual(res1, "success")
            self.assertEqual(res2, "success")
            self.assertEqual(res3, "success")
            # 3 calls should use 3 distinct client instances in round-robin order
            self.assertEqual(len(call_records), 3)
            self.assertNotEqual(call_records[0], call_records[1])
            self.assertNotEqual(call_records[1], call_records[2])

    def test_groq_rotator_failover_retry(self):
        keys = ["key_bad1", "key_good2"]

        with patch("app.services.skill_confidence.groq_client.Groq", side_effect=lambda **kwargs: MagicMock()):
            rotator = GroqKeyRotator(keys)
            attempt_count = 0

            def dummy_call(client):
                nonlocal attempt_count
                attempt_count += 1
                if attempt_count == 1:
                    raise Exception("429 Rate Limit Exceeded on Key 1")
                return "recovered_result"

            result = rotator.execute_with_failover(dummy_call)
            self.assertEqual(result, "recovered_result")
            self.assertEqual(attempt_count, 2)

    def test_groq_rotator_all_keys_failing_raises_runtime_error(self):
        keys = ["key_1", "key_2"]

        with patch("app.services.skill_confidence.groq_client.Groq", side_effect=lambda **kwargs: MagicMock()):
            rotator = GroqKeyRotator(keys)

            def failing_call(client):
                raise Exception("Quota exhausted")

            with self.assertRaises(RuntimeError) as exc_info:
                rotator.execute_with_failover(failing_call)

            self.assertIn("All 2 Groq API keys failed", str(exc_info.exception))


if __name__ == "__main__":
    unittest.main()
