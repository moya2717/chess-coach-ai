from pathlib import Path

import pytest

pytest.importorskip("chess")

from chess_coach_py.pgn_utils import infer_player_color, parse_pgn_bundle


def test_parse_pgn_bundle_reads_all_games() -> None:
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    games = parse_pgn_bundle(fixture.read_text())

    assert len(games) == 2
    assert games[0].white == "Alice"
    assert games[1].black == "Dave"


def test_infer_player_color_matches_case_insensitively() -> None:
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    game = parse_pgn_bundle(fixture.read_text())[0]

    assert infer_player_color(game, "alice") == "white"
    assert infer_player_color(game, "BoB") == "black"


def test_infer_player_color_returns_none_when_missing() -> None:
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    game = parse_pgn_bundle(fixture.read_text())[0]

    assert infer_player_color(game, "") is None
    assert infer_player_color(game, "someone-else") is None
