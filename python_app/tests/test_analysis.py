from pathlib import Path

from chess_coach_py.analysis import analyze_pgn_for_issues
from chess_coach_py.pgn_utils import parse_pgn_bundle


def test_analyzer_finds_material_drop_for_white() -> None:
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    game = parse_pgn_bundle(fixture.read_text())[0]

    issues = analyze_pgn_for_issues(game.pgn, tracked_color="white")

    assert issues
    assert any(issue.severity in {"inaccuracy", "mistake", "blunder"} for issue in issues)
    assert all(issue.side == "white" for issue in issues)


def test_analyzer_handles_invalid_pgn() -> None:
    assert analyze_pgn_for_issues("not a pgn", tracked_color="black") == []
