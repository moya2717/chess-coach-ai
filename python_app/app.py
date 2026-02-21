from __future__ import annotations

from datetime import datetime, timedelta, timezone

import streamlit as st

from chess_coach_py.analysis import analyze_pgn_for_issues
from chess_coach_py.clients import fetch_chesscom_games, fetch_lichess_games
from chess_coach_py.models import GameRecord
from chess_coach_py.pgn_utils import parse_pgn_bundle

MAX_GAMES = 30


def _collect_games(
    chesscom_user: str,
    lichess_user: str,
    pgn_upload: str,
    days_back: int,
) -> list[GameRecord]:
    since = datetime.now(tz=timezone.utc) - timedelta(days=days_back)
    games: list[GameRecord] = []

    if chesscom_user:
        games.extend(fetch_chesscom_games(chesscom_user, max_games=MAX_GAMES, since=since))
    if lichess_user:
        games.extend(fetch_lichess_games(lichess_user, max_games=MAX_GAMES, since=since))
    if pgn_upload.strip():
        games.extend(parse_pgn_bundle(pgn_upload))

    deduped = {f"{g.source}:{g.game_id}": g for g in games}
    return list(deduped.values())[:MAX_GAMES]


def main() -> None:
    st.set_page_config(page_title="Chess Coach (Python)", layout="wide")
    st.title("♟️ Chess Coach — Python Interactive App")

    with st.sidebar:
        st.header("Data Sources")
        chesscom_user = st.text_input("Chess.com username")
        lichess_user = st.text_input("Lichess username")
        days_back = st.selectbox("Time window", options=[7, 30, 90], index=1)
        tracked_color = st.radio("Analyze mistakes for", options=["white", "black"], horizontal=True)
        pgn_upload = st.text_area("Optional PGN input", height=180)
        run = st.button("Load games", type="primary")

    if "games" not in st.session_state:
        st.session_state.games = []

    if run:
        try:
            st.session_state.games = _collect_games(chesscom_user, lichess_user, pgn_upload, days_back)
            if not st.session_state.games:
                st.warning("No games found for your criteria.")
        except Exception as exc:
            st.error(f"Failed to load games: {exc}")

    games = st.session_state.games
    if not games:
        st.info("Add a username or PGN, then click **Load games**.")
        return

    labels = [f"{g.date} • {g.white} vs {g.black} ({g.source})" for g in games]
    selected_idx = st.selectbox("Select a game", options=range(len(games)), format_func=lambda i: labels[i])
    selected = games[selected_idx]

    issues = analyze_pgn_for_issues(selected.pgn, tracked_color=tracked_color)

    st.subheader("Game summary")
    st.write({"white": selected.white, "black": selected.black, "result": selected.result, "source": selected.source})

    st.subheader("Detected mistakes")
    if not issues:
        st.success("No material-loss issues detected by the lightweight analyzer.")
    else:
        st.dataframe([issue.__dict__ for issue in issues], use_container_width=True)

    with st.expander("PGN"):
        st.code(selected.pgn, language="pgn")


if __name__ == "__main__":
    main()
