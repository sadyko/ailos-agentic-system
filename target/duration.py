"""Parse human-friendly duration strings into a total number of seconds."""

import re

_UNIT_SECONDS = {"h": 3600, "m": 60, "s": 1}
_TOKEN_RE = re.compile(r"(\d+)([hms])")
_FULL_RE = re.compile(r"(?:\d+[hms])+")


def parse_duration(s: str) -> int:
    """Convert a duration string such as ``"1h30m"`` into total seconds.

    Supported units are ``h`` (hours), ``m`` (minutes) and ``s`` (seconds),
    written as concatenated ``<number><unit>`` tokens. Surrounding whitespace
    is ignored.

    Raises:
        ValueError: if the string is empty, contains no valid tokens, or has
            any characters that are not part of a recognised token.
    """
    trimmed = s.strip()
    if not trimmed or not _FULL_RE.fullmatch(trimmed):
        raise ValueError(f"invalid duration: {s!r}")

    total = 0
    for value, unit in _TOKEN_RE.findall(trimmed):
        total += int(value) * _UNIT_SECONDS[unit]
    return total
