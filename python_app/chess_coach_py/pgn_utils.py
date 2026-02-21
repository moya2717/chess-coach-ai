from __future__ import annotations

from io import StringIO

import chess.pgn

from .models import GameRecord


def parse_pgn_bundle(pgn_bundle: str, source: str = "upload") -> list[GameRecord]:
    stream = StringIO(pgn_bundle)
    games: list[GameRecord] = []
    idx = 1
    while True:
        game = chess.pgn.read_game(stream)
        if game is None:
            break
        headers = game.headers
        exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
        games.append(
            GameRecord(
                game_id=f"{source}-{idx}",
                source=source,
                white=headers.get("White", "White"),
                black=headers.get("Black", "Black"),
                result=headers.get("Result", "*"),
                date=headers.get("Date", "Unknown"),
                pgn=game.accept(exporter),
            )
        )
        idx += 1
    return games
