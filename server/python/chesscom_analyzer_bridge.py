#!/usr/bin/env python3
"""Best-effort bridge for chess.com-analyzer based analysis.

Reads JSON from stdin:
  {"pgn": "...", "playerColor": "white|black", "depth": 12}

Returns JSON to stdout. If the dependency or engine is unavailable,
returns {"moves": []} so the Node side can gracefully fallback.
"""

from __future__ import annotations

import json
import sys
from typing import Any


def read_request() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def try_run_chesscom_analyzer(request: dict[str, Any]) -> dict[str, Any]:
    try:
        import chess_com_analyzer  # type: ignore  # noqa: F401
    except Exception:
        return {"moves": []}

    # The package API is version-dependent; this bridge intentionally
    # avoids hard-coding an unstable interface and reports availability.
    # Node side performs reliable analysis and fallback handling.
    return {
        "moves": [],
        "quality": {
            "primarySource": "python-bridge",
            "engineShare": 0,
            "materialShare": 100,
            "needsRefinement": True,
            "note": "chess.com-analyzer detected; JS engine fallback remains authoritative",
        },
        "meta": {
            "playerColor": request.get("playerColor", "white"),
            "depth": int(request.get("depth", 12)),
        },
    }


def main() -> None:
    request = read_request()
    payload = try_run_chesscom_analyzer(request)
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
