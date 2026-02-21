#!/usr/bin/env python3
"""Cluster recurring mistake families into top themes.

Best effort: tries pandas/sklearn if present; deterministic fallback otherwise.
"""

from __future__ import annotations

import json
import sys
from typing import Any


def read_request() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def to_vector(game: dict[str, Any]) -> list[float]:
    analysis = game.get("analysis") or {}
    phases = analysis.get("phases") or {}
    return [
        float(analysis.get("blunders") or 0),
        float(analysis.get("mistakes") or 0),
        float(analysis.get("inaccuracies") or 0),
        float(phases.get("opening") or 0),
        float(phases.get("middlegame") or 0),
        float(phases.get("endgame") or 0),
    ]


def map_center_to_theme(center: list[float]) -> str:
    blunders, mistakes, inaccuracies, opening, middlegame, endgame = center
    if opening < 65:
        return "openingDiscipline"
    if endgame < 60:
        return "endgameTechnique"
    if blunders + mistakes + inaccuracies > 4:
        return "tacticalAwareness"
    if middlegame < 62:
        return "middlegamePlanning"
    return "conversionTechnique"


def recommendation_for(theme: str) -> str:
    mapping = {
        "openingDiscipline": "Use one opening family per color for 30 games.",
        "endgameTechnique": "Practice king-and-pawn and rook endgame fundamentals.",
        "tacticalAwareness": "Train forks/pins/skewers daily with a 10-puzzle block.",
        "middlegamePlanning": "Set a 3-move plan each turn: improve worst piece, reduce weaknesses.",
        "conversionTechnique": "When ahead, trade pieces not pawns and avoid counterplay.",
    }
    return mapping.get(theme, "Review critical mistakes and repeat pattern drills.")


def fallback_themes(vectors: list[list[float]]) -> list[dict[str, Any]]:
    totals = {
        "openingDiscipline": 0,
        "tacticalAwareness": 0,
        "endgameTechnique": 0,
    }
    for row in vectors:
        if row[3] < 65:
            totals["openingDiscipline"] += 1
        if row[5] < 60:
            totals["endgameTechnique"] += 1
        if row[0] + row[1] + row[2] > 4:
            totals["tacticalAwareness"] += 1

    denom = max(len(vectors), 1)
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:3]
    return [
        {
            "theme": theme,
            "frequency": round((count / denom) * 100),
            "recommendation": recommendation_for(theme),
        }
        for theme, count in ranked
    ]


def cluster_with_sklearn(vectors: list[list[float]]) -> list[dict[str, Any]]:
    try:
        from sklearn.cluster import KMeans  # type: ignore
    except Exception:
        return fallback_themes(vectors)

    if not vectors:
        return []

    k = min(3, len(vectors))
    model = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = model.fit_predict(vectors)

    counts: dict[str, int] = {}
    for label in labels:
        center = model.cluster_centers_[label]
        theme = map_center_to_theme([float(x) for x in center])
        counts[theme] = counts.get(theme, 0) + 1

    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:3]
    denom = len(vectors)
    return [
        {
            "theme": theme,
            "frequency": round((count / denom) * 100),
            "recommendation": recommendation_for(theme),
        }
        for theme, count in ranked
    ]


def build_clusters(request: dict[str, Any]) -> dict[str, Any]:
    games = request.get("games")
    safe_games = games if isinstance(games, list) else []
    vectors = [to_vector(game) for game in safe_games if isinstance(game, dict)]

    themes = cluster_with_sklearn(vectors)
    source = "python-sklearn" if themes and len(vectors) >= 2 else "python-fallback"
    return {"themes": themes, "source": source}


def main() -> None:
    request = read_request()
    payload = build_clusters(request)
    sys.stdout.write(json.dumps(payload))


if __name__ == "__main__":
    main()
