from __future__ import annotations

from collections import Counter
from io import StringIO
from typing import TYPE_CHECKING

from .models import MoveIssue

if TYPE_CHECKING:
    import chess


def _load_chess_modules():
    import chess
    import chess.pgn

    return chess, chess.pgn


def _piece_values(chess_mod) -> dict[int, int]:
    return {
        chess_mod.PAWN: 1,
        chess_mod.KNIGHT: 3,
        chess_mod.BISHOP: 3,
        chess_mod.ROOK: 5,
        chess_mod.QUEEN: 9,
    }


def _material_score(board: "chess.Board", chess_mod) -> int:
    score = 0
    for piece_type, value in _piece_values(chess_mod).items():
        score += len(board.pieces(piece_type, chess_mod.WHITE)) * value
        score -= len(board.pieces(piece_type, chess_mod.BLACK)) * value
    return score


def _severity(drop: int) -> str:
    if drop >= 5:
        return "blunder"
    if drop >= 3:
        return "mistake"
    return "inaccuracy"


def issue_note(issue: MoveIssue) -> str:
    severity_tip = {
        "inaccuracy": "review candidate moves before committing",
        "mistake": "slow down and reassess forcing lines",
        "blunder": "run a blunder-check for hanging pieces and checks",
    }
    base_tip = severity_tip.get(issue.severity, "review this moment carefully")
    return f"{issue.move_san} ({issue.severity}) lost ~{issue.material_drop}. Tip: {base_tip}."


def summarize_issues(issues: list[MoveIssue]) -> dict[str, int | str]:
    if not issues:
        return {
            "total_issues": 0,
            "blunders": 0,
            "mistakes": 0,
            "inaccuracies": 0,
            "largest_drop": 0,
            "focus": "No major material-loss patterns found.",
        }

    counts = Counter(issue.severity for issue in issues)
    worst = max(issues, key=lambda i: i.material_drop)
    if counts.get("blunder", 0):
        primary = "blunder"
    elif counts.get("mistake", 0):
        primary = "mistake"
    else:
        primary = "inaccuracy"
    focus_map = {
        "blunder": "Prioritize blunder prevention drills and 10-second safety scans.",
        "mistake": "Work on candidate-move discipline in critical middlegame turns.",
        "inaccuracy": "Improve move quality with short calculation exercises.",
    }
    return {
        "total_issues": len(issues),
        "blunders": counts.get("blunder", 0),
        "mistakes": counts.get("mistake", 0),
        "inaccuracies": counts.get("inaccuracy", 0),
        "largest_drop": worst.material_drop,
        "focus": focus_map.get(primary, "Review recurring inaccuracies."),
    }


def training_plan(issues: list[MoveIssue]) -> list[str]:
    summary = summarize_issues(issues)
    if summary["total_issues"] == 0:
        return [
            "Play 2 rapid games and annotate 3 candidate moves each turn.",
            "Solve 10 mixed puzzles to maintain tactical sharpness.",
        ]

    plan = [
        "Solve 15 tactical puzzles tied to your dominant error severity.",
        "Review the top 3 material-loss moments and write better alternatives.",
    ]
    if summary["blunders"]:
        plan.append("Add a pre-move checklist: checks, captures, threats, hanging pieces.")
    return plan


def analyze_pgn_for_issues(pgn_text: str, tracked_color: str) -> list[MoveIssue]:
    chess_mod, chess_pgn = _load_chess_modules()
    tracked_white = tracked_color.lower() == "white"
    game = chess_pgn.read_game(StringIO(pgn_text))
    if game is None:
        return []

    board = game.board()
    issues: list[MoveIssue] = []
    prev_score = _material_score(board, chess_mod)

    for ply, move in enumerate(game.mainline_moves(), start=1):
        mover_is_white = board.turn
        san = board.san(move)
        board.push(move)
        next_score = _material_score(board, chess_mod)
        delta = next_score - prev_score
        prev_score = next_score
        if mover_is_white != tracked_white:
            continue

        material_drop = -delta if tracked_white else delta
        if material_drop < 2:
            continue

        issue = MoveIssue(
            ply=ply,
            move_san=san,
            side="white" if tracked_white else "black",
            severity=_severity(material_drop),
            material_drop=material_drop,
            note="",
        )
        issues.append(MoveIssue(**{**issue.__dict__, "note": issue_note(issue)}))

    return issues
