from pathlib import Path

import pytest

pytest.importorskip("chess")

from chess_coach_py.pgn_utils import parse_pgn_bundle


def test_parse_pgn_bundle_reads_all_games() -> None:
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    games = parse_pgn_bundle(fixture.read_text())

    assert len(games) == 2
    assert games[0].white == "Alice"
    assert games[1].black == "Dave"
