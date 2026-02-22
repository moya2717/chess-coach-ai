from pathlib import Path

import pytest

pytest.importorskip("chess")

from chess_coach_py.pgn_utils import parse_pgn_bundle
from chess_coach_py.review import extract_moves_and_states, resolve_tracked_color


def _fixture_game():
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    return parse_pgn_bundle(fixture.read_text())[0]


def test_extract_moves_and_states_builds_linear_history() -> None:
    game = _fixture_game()

    states, moves = extract_moves_and_states(game.pgn)

    assert states is not None
    assert len(states) == len(moves) + 1
    assert moves[0] == "e4"


def test_extract_moves_and_states_handles_invalid_pgn() -> None:
    states, moves = extract_moves_and_states("not a pgn")

    assert states is None
    assert moves == []


def test_resolve_tracked_color_prefers_inferred_user_color() -> None:
    game = _fixture_game()

    color, reason = resolve_tracked_color(game, username="alice", fallback_color="black")

    assert color == "white"
    assert "Auto-detected" in reason


def test_resolve_tracked_color_uses_fallback_when_user_missing() -> None:
    game = _fixture_game()

    color, reason = resolve_tracked_color(game, username="not-player", fallback_color="black")

    assert color == "black"
    assert "manually selected" in reason
