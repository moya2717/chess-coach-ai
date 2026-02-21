from pathlib import Path

import pytest

from chess_coach_py.analysis import summarize_issues, training_plan
from chess_coach_py.models import MoveIssue


def test_summary_and_training_plan_are_actionable() -> None:
    issues = [
        MoveIssue(10, "Qh5", "white", "mistake", 3, "note"),
        MoveIssue(18, "Bxf7+", "white", "blunder", 5, "note"),
    ]

    summary = summarize_issues(issues)
    plan = training_plan(issues)

    assert summary["total_issues"] == 2
    assert summary["blunders"] == 1
    assert summary["largest_drop"] == 5
    assert "blunder prevention" in str(summary["focus"]).lower()
    assert len(plan) >= 3


def test_summary_no_issues_has_maintenance_plan() -> None:
    summary = summarize_issues([])
    plan = training_plan([])

    assert summary["total_issues"] == 0
    assert "no major material-loss" in str(summary["focus"]).lower()
    assert len(plan) == 2


def test_analyzer_finds_material_drop_for_white() -> None:
    pytest.importorskip("chess")
    fixture = Path(__file__).parent / "fixtures" / "sample_games.pgn"
    from chess_coach_py.pgn_utils import parse_pgn_bundle
    from chess_coach_py.analysis import analyze_pgn_for_issues

    game = parse_pgn_bundle(fixture.read_text())[0]

    issues = analyze_pgn_for_issues(game.pgn, tracked_color="white")

    assert issues
    assert any(issue.severity in {"inaccuracy", "mistake", "blunder"} for issue in issues)
    assert all(issue.side == "white" for issue in issues)


def test_analyzer_handles_invalid_pgn() -> None:
    pytest.importorskip("chess")
    from chess_coach_py.analysis import analyze_pgn_for_issues

    assert analyze_pgn_for_issues("not a pgn", tracked_color="black") == []
