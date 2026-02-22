from __future__ import annotations

from io import StringIO

from .models import GameRecord
from .pgn_utils import infer_player_color


def extract_moves_and_states(pgn_text: str):
    import chess.pgn

    game = chess.pgn.read_game(StringIO(pgn_text))
    if game is None:
        return None, []

    board = game.board()
    states = [board.copy()]
    moves: list[str] = []
    for move in game.mainline_moves():
        moves.append(board.san(move))
        board.push(move)
        states.append(board.copy())
    return states, moves


def resolve_tracked_color(game: GameRecord, username: str, fallback_color: str) -> tuple[str, str]:
    inferred = infer_player_color(game, username)
    if inferred:
        return inferred, f"Auto-detected from username `{username}`."
    return fallback_color, "Using manually selected color because username did not match this game."
