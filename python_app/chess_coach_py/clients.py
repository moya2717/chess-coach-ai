from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

import requests

from .models import GameRecord

CHESSCOM_ARCHIVES_URL = "https://api.chess.com/pub/player/{username}/games/archives"
LICHESS_EXPORT_URL = "https://lichess.org/api/games/user/{username}"


def _is_new_enough(end_time: int, since: datetime | None) -> bool:
    if since is None:
        return True
    game_date = datetime.fromtimestamp(end_time, tz=timezone.utc)
    return game_date >= since


def fetch_chesscom_games(username: str, max_games: int, since: datetime | None = None) -> list[GameRecord]:
    archives_resp = requests.get(CHESSCOM_ARCHIVES_URL.format(username=username), timeout=15)
    archives_resp.raise_for_status()
    archives = archives_resp.json().get("archives", [])[-12:]
    records: list[GameRecord] = []

    for archive in reversed(archives):
        games_resp = requests.get(archive, timeout=15)
        games_resp.raise_for_status()
        for game in reversed(games_resp.json().get("games", [])):
            if not _is_new_enough(game.get("end_time", 0), since):
                continue
            records.append(
                GameRecord(
                    game_id=str(game.get("uuid") or game.get("url", "")),
                    source="chess.com",
                    white=game.get("white", {}).get("username", "White"),
                    black=game.get("black", {}).get("username", "Black"),
                    result=f"{game.get('white', {}).get('result', '')}-{game.get('black', {}).get('result', '')}",
                    date=datetime.fromtimestamp(game.get("end_time", 0), tz=timezone.utc).date().isoformat(),
                    pgn=game.get("pgn", ""),
                )
            )
            if len(records) >= max_games:
                return records
    return records


def _iter_lichess_ndjson_lines(payload: str) -> Iterable[dict]:
    for line in payload.splitlines():
        if line.strip():
            yield requests.models.complexjson.loads(line)


def fetch_lichess_games(username: str, max_games: int, since: datetime | None = None) -> list[GameRecord]:
    params = {"max": max_games, "pgnInJson": True, "sort": "dateDesc"}
    headers = {"Accept": "application/x-ndjson"}
    response = requests.get(LICHESS_EXPORT_URL.format(username=username), params=params, headers=headers, timeout=20)
    response.raise_for_status()

    games: list[GameRecord] = []
    for game in _iter_lichess_ndjson_lines(response.text):
        ended_at = int(game.get("lastMoveAt", 0)) // 1000
        if not _is_new_enough(ended_at, since):
            continue
        players = game.get("players", {})
        games.append(
            GameRecord(
                game_id=game.get("id", ""),
                source="lichess",
                white=players.get("white", {}).get("user", {}).get("name", "White"),
                black=players.get("black", {}).get("user", {}).get("name", "Black"),
                result=game.get("status", "unknown"),
                date=datetime.fromtimestamp(ended_at, tz=timezone.utc).date().isoformat(),
                pgn=game.get("pgn", ""),
            )
        )
    return games
