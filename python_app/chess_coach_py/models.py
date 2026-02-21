from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GameRecord:
    """Canonical game shape for the Python app."""

    game_id: str
    source: str
    white: str
    black: str
    result: str
    date: str
    pgn: str


@dataclass(frozen=True)
class MoveIssue:
    """Represents a tactical or strategic issue found in analysis."""

    ply: int
    move_san: str
    side: str
    severity: str
    material_drop: int
    note: str
