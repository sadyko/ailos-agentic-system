import unittest

from duration import parse_duration


class TestParseDuration(unittest.TestCase):
    def test_hours_minutes(self):
        self.assertEqual(parse_duration("1h30m"), 5400)

    def test_seconds_only(self):
        self.assertEqual(parse_duration("45s"), 45)

    def test_hours_only(self):
        self.assertEqual(parse_duration("2h"), 7200)

    def test_minutes_only(self):
        self.assertEqual(parse_duration("10m"), 600)

    def test_combined_all_units(self):
        self.assertEqual(parse_duration("1h1m1s"), 3661)

    def test_surrounding_whitespace(self):
        self.assertEqual(parse_duration("  2h  "), 7200)

    def test_empty_string_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("")

    def test_garbage_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("abc")

    def test_unknown_unit_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("5x")


if __name__ == "__main__":
    unittest.main()
