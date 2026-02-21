from __future__ import annotations

from io import StringIO

import chess
import chess.pgn

from .models import MoveIssue

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
}


def _material_score(board: chess.Board) -> int:
    score = 0
    for piece_type, value in PIECE_VALUES.items():
        score += len(board.pieces(piece_type, chess.WHITE)) * value
        score -= len(board.pieces(piece_type, chess.BLACK)) * value
    return score


def _severity(drop: int) -> str:
    if drop >= 5:
        return "blunder"
    if drop >= 3:
        return "mistake"
    return "inaccuracy"


def analyze_pgn_for_issues(pgn_text: str, tracked_color: str) -> list[MoveIssue]:
    tracked_white = tracked_color.lower() == "white"
    game = chess.pgn.read_game(StringIO(pgn_text))
    if game is None:
        return []

    board = game.board()
    issues: list[MoveIssue] = []
    prev_score = _material_score(board)

    for ply, move in enumerate(game.mainline_moves(), start=1):
        mover_is_white = board.turn
        san = board.san(move)
        board.push(move)
        next_score = _material_score(board)
        delta = next_score - prev_score
        prev_score = next_score

        if mover_is_white != tracked_white:
            continue

        material_drop = -delta if tracked_white else delta
        if material_drop < 2:
            continue

        issues.append(
            MoveIssue(
                ply=ply,
                move_san=san,
                side="white" if tracked_white else "black",
                severity=_severity(material_drop),
                material_drop=material_drop,
                note=f"{san} dropped ~{material_drop} points of material.",
            )
        )

    return issues
