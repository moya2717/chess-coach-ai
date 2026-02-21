import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { generateCoachComment, generateGameSummary } from '../services/coach';

export default function GameReview({ game, onBack }) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

  const moves = game.analysis?.moves || [];
  const hasMoves = moves.length > 0;

  // Current position
  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;
  const currentFen = currentMove
    ? currentMove.fenAfter
    : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const currentEval = currentMove ? currentMove.eval : 0;

  // Coach commentary
  const coaching = currentMove
    ? generateCoachComment(currentMove)
    : {
        classification: 'book',
        text: hasMoves
          ? generateGameSummary(game.analysis, game.playerColor, game.opening)
          : 'This game hasn\'t been deeply analyzed yet. Click on a game with full analysis to see move-by-move coaching.',
        tip: null,
      };

  // Eval bar calculation
  const evalPct = Math.min(95, Math.max(5, 50 + currentEval * 10));
  const evalDisplay = currentEval > 0 ? `+${currentEval.toFixed(1)}` : currentEval.toFixed(1);

  // Classification styling
  const classMap = {
    brilliant: 'class-brilliant', best: 'class-best', excellent: 'class-excellent',
    great: 'class-great', good: 'class-good',
    book: 'class-book', inaccuracy: 'class-inaccuracy',
    mistake: 'class-mistake', blunder: 'class-blunder',
  };

  // Group moves into pairs for display
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i] || null,
      black: moves[i + 1] || null,
      whiteIdx: i,
      blackIdx: i + 1,
    });
  }

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>

      {/* Game header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>
          vs {game.opponent} ({game.opponentRating})
        </h3>
        <span className={`game-result ${
          game.result === 'win' ? 'result-win' :
          game.result === 'loss' ? 'result-loss' : 'result-draw'
        }`}>
          {game.result.toUpperCase()}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{game.opening}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ({game.platform} · {game.timeControl} · {game.date})
        </span>
      </div>

      <div className="review-screen">
        {/* Left: Board + Eval Bar */}
        <div>
          <div className="board-container">
            <div className="board-grid-wrapper">
              <div className="board-with-eval" style={{ display: 'flex', gap: 10 }}>
                {/* Vertical eval bar */}
                <div style={{
                  width: 24, height: 368, background: '#333',
                  borderRadius: 4, overflow: 'hidden', position: 'relative',
                  border: '1px solid var(--border)', display: 'flex',
                  flexDirection: 'column-reverse',
                }}>
                  <div style={{
                    background: '#f0f0f0', width: '100%',
                    height: `${evalPct}%`,
                    transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                  <span style={{
                    position: 'absolute',
                    ...(currentEval >= 0
                      ? { bottom: 4, color: '#eee' }
                      : { top: 4, color: '#333' }),
                    left: '50%', transform: 'translateX(-50%)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, fontWeight: 700, zIndex: 2,
                  }}>
                    {evalDisplay}
                  </span>
                </div>

                {/* Board with rank labels */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <div className="rank-labels" style={{ display: 'flex', flexDirection: 'column' }}>
                      {['8','7','6','5','4','3','2','1'].map(r => (
                        <div key={r} className="rank-label" style={{ height: 46 }}>{r}</div>
                      ))}
                    </div>
                    <Chessboard
                      position={currentFen}
                      boardWidth={368}
                      arePiecesDraggable={false}
                      customBoardStyle={{ borderRadius: 4 }}
                      customLightSquareStyle={{ backgroundColor: '#e8dcc8' }}
                      customDarkSquareStyle={{ backgroundColor: '#7b9b6f' }}
                    />
                    <div className="rank-labels" style={{ display: 'flex', flexDirection: 'column', paddingLeft: 6 }}>
                      {['8','7','6','5','4','3','2','1'].map(r => (
                        <div key={r} className="rank-label" style={{ height: 46 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                  {/* File labels */}
                  <div className="file-labels" style={{ display: 'flex', marginLeft: 16, marginRight: 0 }}>
                    {['a','b','c','d','e','f','g','h'].map(f => (
                      <div key={f} className="file-label" style={{ width: 46 }}>{f}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Move navigation */}
            {hasMoves && (
              <div className="move-nav">
                <button onClick={() => setCurrentMoveIndex(-1)}>⟨⟨</button>
                <button onClick={() => setCurrentMoveIndex(Math.max(-1, currentMoveIndex - 1))}>⟨</button>
                <span style={{
                  padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  {currentMove
                    ? `${currentMove.num}. ${currentMove.isWhite ? currentMove.san : '...' + currentMove.san}`
                    : 'Start'}
                </span>
                <button onClick={() => setCurrentMoveIndex(Math.min(moves.length - 1, currentMoveIndex + 1))}>⟩</button>
                <button onClick={() => setCurrentMoveIndex(moves.length - 1)}>⟩⟩</button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Analysis */}
        <div className="review-right">
          {/* Classification + eval display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
              padding: '8px 16px', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>EVAL</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700,
                color: currentEval > 0.3 ? 'var(--text-primary)' :
                       currentEval < -0.3 ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}>
                {evalDisplay}
              </span>
            </div>
            <span className={`move-classification ${classMap[coaching.classification] || 'class-good'}`}>
              {coaching.classification}
            </span>
            {currentMove && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {currentMove.san}
              </span>
            )}
          </div>

          {/* Coach bubble */}
          <div className="coach-bubble">
            <div className="coach-label">🎓 Coach Analysis</div>
            <div className="coach-text" dangerouslySetInnerHTML={{ __html: coaching.text }} />
            {coaching.tip && (
              <div style={{
                marginTop: 12, padding: '10px 14px', background: 'var(--accent-amber-dim)',
                borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--accent-amber)', lineHeight: 1.6,
              }}>
                💡 <strong>Tip:</strong> {coaching.tip}
              </div>
            )}
          </div>

          {/* Move list */}
          {hasMoves && (
            <div className="move-list-panel">
              <div className="panel-header">
                <h3>Moves</h3>
                <span className="badge badge-blue">Accuracy: {game.analysis?.accuracy || '?'}%</span>
              </div>
              <div className="move-list">
                {movePairs.map((pair) => (
                  <div key={pair.num} style={{ display: 'contents' }}>
                    <div className="move-num">{pair.num}.</div>
                    <div
                      className={`move-cell ${currentMoveIndex === pair.whiteIdx ? 'active' : ''} ${
                        pair.white?.classification === 'blunder' ? 'is-blunder' :
                        pair.white?.classification === 'mistake' ? 'is-mistake' :
                        pair.white?.classification === 'inaccuracy' ? 'is-inaccuracy' : ''
                      }`}
                      onClick={() => setCurrentMoveIndex(pair.whiteIdx)}
                    >
                      {pair.white?.san || ''}
                    </div>
                    <div
                      className={`move-cell ${currentMoveIndex === pair.blackIdx ? 'active' : ''} ${
                        pair.black?.classification === 'blunder' ? 'is-blunder' :
                        pair.black?.classification === 'mistake' ? 'is-mistake' :
                        pair.black?.classification === 'inaccuracy' ? 'is-inaccuracy' : ''
                      }`}
                      onClick={() => pair.black && setCurrentMoveIndex(pair.blackIdx)}
                    >
                      {pair.black?.san || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game link */}
          {game.url && (
            <a
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13, color: 'var(--accent-blue)',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🔗 View original game on {game.platform}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
