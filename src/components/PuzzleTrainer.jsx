import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getPuzzle, getPuzzleProgress } from '../services/puzzles';

export default function PuzzleTrainer({ pattern, patterns, onBack, usernames, onPuzzleProgressUpdate }) {
  const currentPattern = pattern || (patterns && patterns[0]) || defaultPattern;
  const patternTheme = currentPattern.puzzleTheme || 'short';
  const userKey = usernames?.lichess || usernames?.chesscom || 'guest';
  const [puzzle, setPuzzle] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [moveIndex, setMoveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    loadPuzzle(patternTheme);
    loadProgress(userKey, patternTheme);
  }, [patternTheme, userKey]);

  useEffect(() => {
    if (solved) return;
    const timer = setInterval(() => setTimeSpent(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [solved, startedAt]);

  const progressView = useMemo(() => progress || { completedCount: 0, streak: 0, accuracy: 0 }, [progress]);

  async function loadPuzzle(theme) {
    const nextPuzzle = await getPuzzle(theme);
    const chess = new Chess(nextPuzzle.fen);
    setPuzzle(nextPuzzle);
    setGame(chess);
    setMoveIndex(0);
    setTries(0);
    setSolved(false);
    setFeedback('');
    setRevealed(false);
    setStartedAt(Date.now());
    setTimeSpent(0);
  }

  async function loadProgress(nextUserKey, nextTheme) {
    const session = await getPuzzleProgress(nextUserKey, nextTheme);
    setProgress(session);
  }

  async function onDrop(sourceSquare, targetSquare) {
    if (!puzzle || solved) return false;
    const expectedMove = puzzle.solution[moveIndex];
    const chosen = `${sourceSquare}${targetSquare}`;

    if (chosen !== expectedMove) {
      setTries((value) => value + 1);
      setFeedback('❌ Not the best move. Retry and calculate forcing line.');
      return false;
    }

    const next = new Chess(game.fen());
    const move = applyUciMove(next, expectedMove);
    if (!move) return false;
    setGame(next);
    setFeedback('✅ Correct move.');
    const playerMoveIndex = moveIndex + 1;

    if (playerMoveIndex >= puzzle.solution.length) {
      return finishPuzzle(playerMoveIndex);
    }

    const opponentMove = puzzle.solution[playerMoveIndex];
    const afterReply = new Chess(next.fen());
    applyUciMove(afterReply, opponentMove);
    setGame(afterReply);
    const nextIndex = playerMoveIndex + 1;
    setMoveIndex(nextIndex);

    if (nextIndex >= puzzle.solution.length) {
      return finishPuzzle(nextIndex);
    }
    return true;
  }

  async function finishPuzzle(nextIndex) {
    setMoveIndex(nextIndex);
    setSolved(true);
    setFeedback('🎉 Solved! Great conversion.');
    const nextProgress = await onPuzzleProgressUpdate({
      pattern: patternTheme,
      solved: true,
      tries,
      timeSpent,
    });
    if (nextProgress) setProgress(nextProgress);
    return true;
  }

  async function revealLine() {
    if (!puzzle || solved) return;
    const nextProgress = await onPuzzleProgressUpdate({
      pattern: patternTheme,
      solved: false,
      tries: tries + 1,
      timeSpent,
    });
    if (nextProgress) setProgress(nextProgress);
    setRevealed(true);
    setFeedback('Line revealed. Replay and memorize the tactical motif.');
  }

  if (!puzzle) return <div>Loading puzzle...</div>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, marginBottom: 6 }}>
          🧩 Training: {currentPattern.name}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Rating {puzzle.rating} · Themes: {puzzle.themeTags.join(', ') || 'mixed'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24 }}>
        <div className="board-container">
          <Chessboard
            position={game.fen()}
            boardWidth={368}
            arePiecesDraggable={!solved}
            onPieceDrop={onDrop}
            customBoardStyle={{ borderRadius: 4 }}
            customLightSquareStyle={{ backgroundColor: '#e8dcc8' }}
            customDarkSquareStyle={{ backgroundColor: '#7b9b6f' }}
          />
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            {puzzle.toMove} to move
          </div>
        </div>

        <div>
          <div className="coach-bubble" style={{ marginBottom: 16 }}>
            <div className="coach-label">🎓 Why This Puzzle</div>
            <div className="coach-text">{currentPattern.coaching}</div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ padding: 20 }}>
              <h3>Attempt</h3>
              <p style={{ marginTop: 8 }}>{feedback || 'Find the best move and drag the piece.'}</p>
              <p>Tries: {tries} · Time: {timeSpent}s · Solved: {solved ? 'Yes' : 'No'}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn-secondary" onClick={() => loadPuzzle(patternTheme)}>Next Puzzle</button>
                <button className="btn-secondary" onClick={revealLine}>Reveal Line</button>
              </div>
              {revealed && <p style={{ marginTop: 8 }}>Solution: {puzzle.solutionLine}</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>📊 Session Progress</h3>
              <span className="badge badge-green">Accuracy {progressView.accuracy}%</span>
            </div>
            <div style={{ padding: 20 }}>
              <p>Completed: {progressView.completedCount}</p>
              <p>Streak: {progressView.streak}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function applyUciMove(chess, uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return chess.move({ from, to, promotion });
}

const defaultPattern = {
  name: 'General Tactics',
  puzzleTheme: 'short',
  coaching: 'Practicing tactical puzzles sharpens your pattern recognition.',
};
