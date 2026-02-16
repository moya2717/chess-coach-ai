import { useState } from 'react';
import { Chessboard } from 'react-chessboard';

export default function PuzzleTrainer({ pattern, patterns, onBack }) {
  const [revealed, setRevealed] = useState(false);
  const currentPattern = pattern || (patterns && patterns[0]) || defaultPattern;

  // Sample puzzle positions matched to pattern themes
  const puzzleMap = {
    hangingPiece: {
      fen: 'r2qk2r/ppp2ppp/2np1n2/2b1p1B1/2B1P3/3P1N2/PPP2PPP/RN1Q1RK1 w kq - 1 7',
      hint: 'Look carefully at Black\'s pieces. One of them is undefended. Can White attack it while also improving their position? Think about which piece can jump to a square that creates a double attack.',
      toMove: 'White',
    },
    endgame: {
      fen: '8/5pk1/6p1/4P3/5PP1/8/4K3/8 w - - 0 1',
      hint: 'In King and Pawn endgames, the King must lead the charge. Where should the White King head? Remember: the King should march TOWARD the action, not away from it. Think about which pawn you want to promote and how your King can escort it.',
      toMove: 'White',
    },
    opening: {
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      hint: 'After 1.e4, Black has several principled responses. The best ones either mirror White\'s center control (1...e5), challenge it directly (1...c5 — the Sicilian), or prepare to challenge it (1...e6 — the French). Which approach fits your style?',
      toMove: 'Black',
    },
    short: {
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      hint: 'This is the famous Scholar\'s Mate setup. White\'s Queen and Bishop are both aimed at f7. Can you find the move that threatens checkmate? (And more importantly — if you\'re Black, how would you defend?)',
      toMove: 'White',
    },
  };

  const puzzle = puzzleMap[currentPattern.puzzleTheme] || puzzleMap.short;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, marginBottom: 6 }}>
          🧩 Training: {currentPattern.name}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Solve positions that target your specific weakness pattern
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24 }}>
        {/* Board */}
        <div className="board-container">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <div className="rank-labels" style={{ display: 'flex', flexDirection: 'column' }}>
                  {['8','7','6','5','4','3','2','1'].map(r => (
                    <div key={r} className="rank-label" style={{ height: 46 }}>{r}</div>
                  ))}
                </div>
                <Chessboard
                  position={puzzle.fen}
                  boardWidth={368}
                  arePiecesDraggable={false}
                  customBoardStyle={{ borderRadius: 4 }}
                  customLightSquareStyle={{ backgroundColor: '#e8dcc8' }}
                  customDarkSquareStyle={{ backgroundColor: '#7b9b6f' }}
                />
              </div>
              <div className="file-labels" style={{ display: 'flex', marginLeft: 16 }}>
                {['a','b','c','d','e','f','g','h'].map(f => (
                  <div key={f} className="file-label" style={{ width: 46 }}>{f}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            {puzzle.toMove} to move
          </div>
        </div>

        {/* Right panel */}
        <div>
          {/* Why this puzzle */}
          <div className="coach-bubble" style={{ marginBottom: 16 }}>
            <div className="coach-label">🎓 Why This Puzzle</div>
            <div className="coach-text">
              This position is designed to train your weakness in{' '}
              <strong>{currentPattern.name.toLowerCase()}</strong>.{' '}
              {currentPattern.coaching}
            </div>
          </div>

          {/* Hint */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)',
            padding: '20px 24px', border: '1px solid var(--border)', marginBottom: 16,
            fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)',
          }}>
            <h4 style={{ fontSize: 14, color: 'var(--accent-amber)', marginBottom: 8, fontWeight: 700 }}>
              💡 Hint
            </h4>
            {!revealed ? (
              <>
                <p>Try to find the best move before revealing the hint.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn-secondary" onClick={() => setRevealed(true)}>
                    Show Hint
                  </button>
                </div>
              </>
            ) : (
              <p>{puzzle.hint}</p>
            )}
          </div>

          {/* Progress */}
          <div className="panel">
            <div className="panel-header">
              <h3>📊 Your Progress</h3>
              <span className="badge badge-green">Keep Going</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Puzzles completed</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>0 / 10</span>
              </div>
              <div className="pattern-bar">
                <div className="pattern-bar-fill" style={{ width: '0%', background: 'var(--accent-green)' }} />
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Puzzle tracking will be available once the full Lichess puzzle API integration is connected.
                For now, practice finding the right move by studying the position carefully.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const defaultPattern = {
  name: 'General Tactics',
  puzzleTheme: 'short',
  coaching: 'Practicing tactical puzzles sharpens your pattern recognition.',
};
