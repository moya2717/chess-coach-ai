import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { answerFollowUpQuestion, generateCoachComment, generateGameSummary } from '../services/coach';
import { analyzePosition } from '../services/analysis';
import {
  detectTrainingTheme,
  formatPunishmentLine,
  isCriticalMove,
  toSanFromUci,
} from '../services/critical-moments';

export default function GameReview({
  game,
  onBack,
  onReanalyzeGames,
  onAnalyzeGame,
  activeAnalysisGameId = null,
  analysisInProgress = false,
  persistedEngineCache = null,
  onPersistEngineCache = null,
}) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [engineLine, setEngineLine] = useState([]);
  const [engineLineError, setEngineLineError] = useState('');
  const [engineLineLoading, setEngineLineLoading] = useState(false);
  const [enginePreviewIndex, setEnginePreviewIndex] = useState(-1);
  const [candidateMoves, setCandidateMoves] = useState([]);
  const [positionAssessment, setPositionAssessment] = useState(null);
  const [analysisPhase, setAnalysisPhase] = useState('middlegame');
  const [analysisQuality, setAnalysisQuality] = useState('limited');
  const [engineAnalysisCache, setEngineAnalysisCache] = useState(() => persistedEngineCache || {});
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [coachReply, setCoachReply] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selectedCriticalIndex, setSelectedCriticalIndex] = useState(null);
  const [criticalInsights, setCriticalInsights] = useState({});
  const [criticalLoadingIndex, setCriticalLoadingIndex] = useState(null);

  const moves = game.analysis?.moves || [];
  const hasMoves = moves.length > 0;
  const criticalMoves = moves
    .map((move, index) => ({ ...move, index }))
    .filter(isCriticalMove);

  // Current position
  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;
  const baseFen = currentMove
    ? currentMove.fenAfter
    : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const previewFen = enginePreviewIndex >= 0 ? buildPreviewFen(baseFen, engineLine, enginePreviewIndex) : null;
  const currentFen = previewFen || baseFen;
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


  useEffect(() => {
    if (game?.analysis || !game?.id || !onAnalyzeGame) {
      return;
    }
    onAnalyzeGame(game.id);
  }, [game?.analysis, game?.id, onAnalyzeGame]);

  useEffect(() => {
    setEngineAnalysisCache(persistedEngineCache || {});
  }, [game.id, persistedEngineCache]);

  useEffect(() => {
    const cached = engineAnalysisCache[baseFen];
    if (cached) {
      setEngineLine(cached.line || []);
      setCandidateMoves(cached.candidates || []);
      setPositionAssessment(cached.assessment || null);
      setAnalysisPhase(cached.phase || 'middlegame');
      setAnalysisQuality(cached.quality || 'limited');
      setEngineLineError('');
      setEnginePreviewIndex(-1);
      return;
    }

    setEngineLine([]);
    setEngineLineError('');
    setEnginePreviewIndex(-1);
    setCandidateMoves([]);
    setPositionAssessment(null);
    setAnalysisPhase('middlegame');
    setAnalysisQuality('limited');
    setFollowUpQuestion('');
    setCoachReply('');
  }, [baseFen, engineAnalysisCache]);

  useEffect(() => {
    setCriticalOnly(false);
    setSelectedCriticalIndex(null);
    setCriticalInsights({});
    setCriticalLoadingIndex(null);
  }, [game.id]);

  const loadCriticalInsight = async (move) => {
    if (!move || criticalInsights[move.index]) return;
    setCriticalLoadingIndex(move.index);
    try {
      const result = await analyzePosition(move.fenAfter, {
        engineMode: 'auto',
        maxPlies: 6,
        forceRefresh: true,
      });
      const punishmentLine = result.line || [];
      setCriticalInsights((prev) => ({
        ...prev,
        [move.index]: {
          punishmentLine,
          trainingTheme: detectTrainingTheme(move, punishmentLine),
        },
      }));
    } catch {
      setCriticalInsights((prev) => ({
        ...prev,
        [move.index]: {
          punishmentLine: [],
          trainingTheme: detectTrainingTheme(move, []),
          error: 'Could not fetch punishment line right now.',
        },
      }));
    } finally {
      setCriticalLoadingIndex(null);
    }
  };

  const handleCriticalSelect = async (move) => {
    setCurrentMoveIndex(move.index);
    setSelectedCriticalIndex(move.index);
    await loadCriticalInsight(move);
  };

  const fetchEngineLine = async () => {
    setEngineLineLoading(true);
    setEngineLineError('');
    try {
      const result = await analyzePosition(baseFen, {
        engineMode: 'auto',
        maxPlies: 6,
        forceRefresh: true,
      });
      setEngineLine(result.line || []);
      setCandidateMoves(result.candidates || []);
      setPositionAssessment(result.assessment || null);
      setAnalysisPhase(result.phase || 'middlegame');
      setAnalysisQuality(result.quality || 'limited');
      setEnginePreviewIndex(-1);
      setEngineAnalysisCache((prev) => {
        const next = {
          ...prev,
          [baseFen]: {
            line: result.line || [],
            candidates: result.candidates || [],
            assessment: result.assessment || null,
            phase: result.phase || 'middlegame',
            quality: result.quality || 'limited',
          },
        };
        onPersistEngineCache?.(next);
        return next;
      });
    } catch (error) {
      setEngineLineError(error.message || 'Failed to fetch engine line');
      setEngineLine([]);
      setAnalysisQuality('limited');
      setEnginePreviewIndex(-1);
    } finally {
      setEngineLineLoading(false);
    }
  };


  const handleAskCoach = () => {
    const reply = answerFollowUpQuestion(followUpQuestion, {
      currentMove,
      candidates: candidateMoves,
      assessment: positionAssessment,
      phase: analysisPhase,
    });
    setCoachReply(reply);
  };

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
                {currentMove.san} · Δ {formatEvalDelta(currentMove.evalSwing)} · {formatEvalSource(currentMove.evalSource)}
              </span>
            )}
          </div>


          {!game.analysis && (
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-blue-dim)',
              color: 'var(--accent-blue)',
              fontSize: 12,
            }}>
              This game has not been analyzed yet.
              <div style={{ marginTop: 8 }}>
                <button
                  className="back-btn"
                  onClick={() => onAnalyzeGame?.(game.id)}
                  disabled={analysisInProgress}
                >
                  {analysisInProgress && activeAnalysisGameId === game.id ? 'Analyzing this game…' : 'Analyze This Game'}
                </button>
              </div>
            </div>
          )}

          {game.analysisStatus === 'fallback-material' && (
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-amber-dim)',
              color: 'var(--accent-amber)',
              fontSize: 12,
            }}>
              ⚠️ This game used limited engine depth for parts of analysis. Re-run analysis for stronger move-by-move feedback.
              <div style={{ marginTop: 8 }}>
                <button
                  className="back-btn"
                  onClick={onReanalyzeGames}
                  disabled={analysisInProgress}
                >
                  {analysisInProgress ? 'Engine running…' : 'Re-run Engine Analysis'}
                </button>
              </div>
            </div>
          )}

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


          <div className="move-list-panel" style={{ marginBottom: 12 }}>
            <div className="panel-header">
              <h3>🧭 Engine Next Line</h3>
              <button className="back-btn" onClick={fetchEngineLine} disabled={engineLineLoading}>
                {engineLineLoading ? 'Analyzing…' : 'Analyze Current Position'}
              </button>
            </div>

            {positionAssessment && (
              <div className="pattern-desc" style={{ marginBottom: 8 }}>
                <strong>Phase:</strong> {analysisPhase} · <strong>Material edge:</strong> {positionAssessment.materialEdge}
                <br />
                <strong>Threats:</strong> {positionAssessment.threats.join(', ')}
                <br />
                <strong>Opportunities:</strong> {positionAssessment.opportunities.join(', ')}
              </div>
            )}
            {candidateMoves.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="stat-label" style={{ marginBottom: 6 }}>Candidate Moves (Top 3–5)</div>
                {candidateMoves.slice(0, 5).map((candidate) => (
                  <div key={candidate.uci} className="pattern-item" style={{ cursor: 'default' }}>
                    <div className="pattern-name">{candidate.san} · eval {candidate.eval}</div>
                    <div className="pattern-desc">
                      {candidate.variation.length ? `Line: ${candidate.variation.join(' ')}` : 'No continuation available.'}
                      {candidate.concepts.length ? ` · Ideas: ${candidate.concepts.join(', ')}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                placeholder="Ask coach: Was my last move good? Why is this move better?"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              <button className="back-btn" onClick={handleAskCoach}>Ask</button>
            </div>
            {coachReply && <div className="pattern-desc" style={{ marginBottom: 8 }}>{coachReply}</div>}
            {engineLineError && <div className="pattern-desc" style={{ color: 'var(--accent-red)' }}>{engineLineError}</div>}
            {!engineLineError && !engineLineLoading && analysisQuality === 'limited' && candidateMoves.length > 0 && (
              <div className="pattern-desc" style={{ color: 'var(--accent-amber)', marginBottom: 8 }}>
                Live Stockfish depth is currently unavailable; showing heuristic candidate moves for this position.
              </div>
            )}
            {engineLine.length === 0 && !engineLineLoading && !engineLineError && (
              <div className="pattern-desc">Run engine line analysis to view best continuation moves from this position.</div>
            )}
            {engineLine.length > 0 && (
              <>
                <div className="move-nav" style={{ marginBottom: 10 }}>
                  <button onClick={() => setEnginePreviewIndex(-1)}>⟨⟨</button>
                  <button onClick={() => setEnginePreviewIndex((idx) => Math.max(-1, idx - 1))}>⟨</button>
                  <span style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {enginePreviewIndex >= 0 ? `Preview ply ${enginePreviewIndex + 1}` : 'Preview start'}
                  </span>
                  <button onClick={() => setEnginePreviewIndex((idx) => Math.min(engineLine.length - 1, idx + 1))}>⟩</button>
                  <button onClick={() => setEnginePreviewIndex(engineLine.length - 1)}>⟩⟩</button>
                </div>
                <div className="pattern-desc" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {engineLine.map((step) => `${step.ply}. ${step.san} (${formatEval(step.eval)})`).join(' · ')}
                </div>
              </>
            )}
          </div>

          {/* Move list */}
          {hasMoves && (
            <div className="move-list-panel">
              <div className="panel-header">
                <h3>Moves</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="back-btn" onClick={() => setCriticalOnly((value) => !value)}>
                    {criticalOnly ? 'Show all moves' : 'Critical moments'}
                  </button>
                  <span className="badge badge-blue">Accuracy: {game.analysis?.accuracy || '?'}%</span>
                </div>
              </div>
              {!criticalOnly && (
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
              )}

              {criticalOnly && (
                <div className="critical-list">
                  {criticalMoves.length === 0 && (
                    <div className="pattern-desc" style={{ padding: 12 }}>
                      No inaccuracies, mistakes, or blunders found in your moves.
                    </div>
                  )}
                  {criticalMoves.map((move) => {
                    const insight = criticalInsights[move.index];
                    const bestMoveSan = toSanFromUci(move.fenBefore, move.bestMove) || move.bestMove || 'N/A';
                    const isLoading = criticalLoadingIndex === move.index;
                    return (
                      <button
                        key={`${move.num}-${move.index}`}
                        type="button"
                        className={`critical-card ${selectedCriticalIndex === move.index ? 'active' : ''}`}
                        onClick={() => handleCriticalSelect(move)}
                      >
                        <div className="critical-title">
                          <span>{move.num}. {move.san}</span>
                          <span className={`move-classification ${classMap[move.classification] || 'class-good'}`}>
                            {move.classification}
                          </span>
                        </div>
                        <div className="critical-row"><strong>Your move:</strong> {move.san}</div>
                        <div className="critical-row"><strong>Best move:</strong> {bestMoveSan}</div>
                        <div className="critical-row">
                          <strong>Punishment line:</strong>{' '}
                          {isLoading ? 'Analyzing punishment line…' : formatPunishmentLine(insight?.punishmentLine)}
                        </div>
                        {insight?.error && <div className="critical-error">{insight.error}</div>}
                        <div className="critical-row">
                          <strong>Training theme:</strong> {insight?.trainingTheme || detectTrainingTheme(move, [])}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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


function formatEvalDelta(value) {
  const rounded = Number(value || 0).toFixed(1);
  return rounded.startsWith('-') ? rounded : `+${rounded}`;
}

function buildPreviewFen(startFen, line, previewIndex) {
  const chess = new Chess(startFen);
  for (let i = 0; i <= previewIndex; i += 1) {
    const step = line[i];
    if (!step) break;
    const match = String(step.uci || '').match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!match) break;
    const [, from, to, promotion] = match;
    const moved = chess.move({ from, to, promotion });
    if (!moved) break;
  }
  return chess.fen();
}

function formatEval(value) {
  const rounded = Number(value || 0).toFixed(1);
  return rounded.startsWith('-') ? rounded : `+${rounded}`;
}

function formatEvalSource(source) {
  if (source === 'engine-local') return 'local engine';
  if (source === 'engine-web') return 'web engine';
  if (source === 'material') return 'material fallback';
  return 'unknown source';
}
