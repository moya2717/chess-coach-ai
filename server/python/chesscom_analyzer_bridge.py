#!/usr/bin/env python3
"""Python bridge for PGN move-by-move analysis.

Input (stdin JSON):
  {"pgn": "...", "playerColor": "white|black", "depth": 12}

Output (stdout JSON):
  analysis payload compatible with server/providers/analysis-provider.js.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Any

PIECE_VALUES = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}


@dataclass(frozen=True)
class MoveEval:
    before_eval: float
    after_eval: float
    eval_drop: float
    score: int
    classification: str


def read_request() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def safe_player_color(raw: Any) -> str:
    value = str(raw or "white").strip().lower()
    return "black" if value == "black" else "white"


def phase_for_index(index: int, total: int) -> str:
    progress = index / max(total, 1)
    if progress < 0.25:
        return "opening"
    if progress < 0.7:
        return "middlegame"
    return "endgame"


def estimate_material(board_fen: str) -> float:
    score = 0.0
    for char in board_fen:
        key = char.lower()
        if key not in PIECE_VALUES:
            continue
        score += PIECE_VALUES[key] if char.isupper() else -PIECE_VALUES[key]
    return round(score, 2)


def classify_move(eval_drop: float, is_player_move: bool) -> str:
    if not is_player_move:
        return "book"
    if eval_drop > 2.0:
        return "blunder"
    if eval_drop > 1.0:
        return "mistake"
    if eval_drop > 0.45:
        return "inaccuracy"
    if eval_drop <= 0.08:
        return "good"
    return "inaccuracy"


def feedback_for(classification: str, san: str) -> str:
    notes = {
        "blunder": f"{san} drops significant material/tactical equity. Re-check forcing moves before committing.",
        "mistake": f"{san} concedes advantage. Look for a more active move improving piece coordination.",
        "inaccuracy": f"{san} is playable but imprecise. Consider candidate moves and king safety first.",
        "good": f"{san} keeps the position stable and follows sound principles.",
        "book": f"{san} is part of normal game flow at this phase.",
    }
    return notes.get(classification, f"{san} was played.")




def extract_tactic_tags(board_before: Any, move: Any, san: str) -> list[str]:
    tags: list[str] = []
    attackers = board_before.attackers(not board_before.turn, move.to_square)
    if len(attackers) >= 2:
        tags.append('fork')
    if 'x' in san and ('+' in san or '#' in san):
        tags.append('discovered attack')
    if board_before.is_pinned(board_before.turn, move.from_square):
        tags.append('pin')
    piece = board_before.piece_at(move.to_square)
    if piece and piece.piece_type in {4, 5} and '+' in san:
        tags.append('skewer')
    return tags[:3]


def build_candidate_plans(phase: str, classification: str, san: str) -> list[str]:
    if classification in {'blunder', 'mistake'}:
        return [
            'Start with checks, captures, and threats before committing to quiet moves.',
            'Improve your worst-defended piece and reduce tactical liabilities around your king.',
            f'Re-evaluate alternatives to {san} by calculating one forcing reply for each candidate.',
        ]
    if phase == 'opening':
        return [
            'Complete development and castle before launching flank pawn moves.',
            'Claim central influence with pawns and active minor pieces.',
            'Avoid repeating moves unless they solve a direct tactical issue.',
        ]
    if phase == 'endgame':
        return [
            'Activate king first, then create a passed pawn race you can calculate.',
            'Trade into winning pawn structures and avoid unnecessary piece trades when worse.',
            'Use opposition and tempo to convert small advantages.',
        ]
    return [
        'Improve your worst piece and coordinate rooks on open files.',
        'Identify your opponent threat, then choose an active counterplan.',
        'Prefer forcing tactical sequences when they improve king safety and piece activity.',
    ]


def build_drill_prompt(san: str, phase: str, classification: str) -> str:
    return (
        f'Find the best move instead of {san} in this {phase} position '
        f'and justify it in one sentence ({classification} context).'
    )
def compute_move_eval(before_eval: float, after_eval: float, is_white: bool, is_player_move: bool) -> MoveEval:
    if not is_player_move:
        eval_drop = 0.0
    elif is_white:
        eval_drop = max(0.0, before_eval - after_eval)
    else:
        eval_drop = max(0.0, after_eval - before_eval)
    classification = classify_move(eval_drop, is_player_move)
    score = max(45, round(72 - eval_drop * 15))
    return MoveEval(before_eval, after_eval, round(eval_drop, 2), score, classification)


def try_import_analyzer() -> bool:
    try:
        __import__("chess_com_analyzer")
        return True
    except Exception:
        return False


def build_analysis_with_python_chess(request: dict[str, Any]) -> dict[str, Any]:
    try:
        import chess
        import chess.pgn
    except Exception:
        return {"moves": []}

    pgn_text = str(request.get("pgn") or "")
    if not pgn_text.strip():
        return {"moves": []}

    import io

    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        return {"moves": []}

    player_color = safe_player_color(request.get("playerColor"))
    board = game.board()
    moves: list[dict[str, Any]] = []
    opening_scores: list[int] = []
    middlegame_scores: list[int] = []
    endgame_scores: list[int] = []

    all_nodes = list(game.mainline())
    for index, current in enumerate(all_nodes):
        move = current.move
        fen_before = board.fen()
        before_eval = estimate_material(board.board_fen())
        san = board.san(move)
        board.push(move)
        fen_after = board.fen()
        after_eval = estimate_material(board.board_fen())
        is_white = index % 2 == 0
        is_player_move = (is_white and player_color == "white") or (not is_white and player_color == "black")
        phase = phase_for_index(index, len(all_nodes))
        move_eval = compute_move_eval(before_eval, after_eval, is_white, is_player_move)

        tactic_tags = extract_tactic_tags(board.copy(stack=False), move, san)
        candidate_plans = build_candidate_plans(phase, move_eval.classification, san)
        payload = {
            "num": (index // 2) + 1,
            "san": san,
            "isWhite": is_white,
            "fenBefore": fen_before,
            "fenAfter": fen_after,
            "eval": move_eval.after_eval,
            "beforeEval": move_eval.before_eval,
            "evalSwing": round(move_eval.after_eval - move_eval.before_eval, 2),
            "evalDrop": move_eval.eval_drop,
            "classification": move_eval.classification,
            "phase": phase,
            "isPlayerMove": is_player_move,
            "from": chess.square_name(move.from_square),
            "to": chess.square_name(move.to_square),
            "evalSource": "python-material",
            "bestMove": None,
            "playerMatchedBestMove": False,
            "moveScore": move_eval.score,
            "afterEvaluation": {"eval": move_eval.after_eval, "source": "python-material"},
            "feedback": feedback_for(move_eval.classification, san),
            "tacticTags": tactic_tags,
            "candidatePlans": candidate_plans,
            "drillPrompt": build_drill_prompt(san, phase, move_eval.classification),
        }
        moves.append(payload)
        if phase == "opening":
            opening_scores.append(move_eval.score)
        elif phase == "middlegame":
            middlegame_scores.append(move_eval.score)
        else:
            endgame_scores.append(move_eval.score)

    player_moves = [m for m in moves if m["isPlayerMove"]]
    accuracy = round(sum(m["moveScore"] for m in player_moves) / max(len(player_moves), 1))
    blunders = sum(1 for m in player_moves if m["classification"] == "blunder")
    mistakes = sum(1 for m in player_moves if m["classification"] == "mistake")
    inaccuracies = sum(1 for m in player_moves if m["classification"] == "inaccuracy")

    def avg(values: list[int]) -> int:
        return round(sum(values) / max(len(values), 1))

    return {
        "moves": moves,
        "accuracy": accuracy,
        "blunders": blunders,
        "mistakes": mistakes,
        "inaccuracies": inaccuracies,
        "phases": {
            "opening": avg(opening_scores),
            "middlegame": avg(middlegame_scores),
            "endgame": avg(endgame_scores),
        },
        "quality": {
            "primarySource": "python-material",
            "engineShare": 0,
            "materialShare": 100,
            "needsRefinement": True,
        },
        "meta": {
            "playerColor": player_color,
            "depth": int(request.get("depth") or 12),
            "hasChessComAnalyzer": try_import_analyzer(),
            "notes": "Python bridge uses deterministic material analysis; add UCI engine wiring for deeper lines.",
        },
    }


def main() -> None:
    request = read_request()
    payload = build_analysis_with_python_chess(request)
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
