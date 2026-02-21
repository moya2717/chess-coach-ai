// ═══════════════════════════════════════════
// App.jsx — Main Application Controller
// ═══════════════════════════════════════════
// Think of this as the "project manager" that coordinates
// all the different departments (API services, components,
// analysis engine, coach voice).
// ═══════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import SetupScreen from './components/SetupScreen';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard';
import GameReview from './components/GameReview';
import PuzzleTrainer from './components/PuzzleTrainer';
import LoginScreen from './components/LoginScreen';
import { getRecentGames as getChesscomGames } from './services/chesscom-api';
import { getRecentGames as getLichessGames } from './services/lichess-api';
import { analyzeGame, detectPatterns } from './services/analysis';
import { getPuzzleProgress, updatePuzzleProgress } from './services/puzzles';
import { isAuthConfigured, logoutUser, subscribeToAuthState } from './services/auth';
import { listAnalysisRuns, recordAnalysisRun } from './services/analysis-history';

const MAX_GAMES_PER_ANALYSIS = 30;
const WINDOW_TO_DAYS = {
  lastWeek: 7,
  last30Days: 30,
};

function App() {
  // ─── State ───
  const [screen, setScreen] = useState('setup');
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [games, setGames] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState(null);
  const [usernames, setUsernames] = useState({ chesscom: '', lichess: '' });
  const [puzzleProgressByPattern, setPuzzleProgressByPattern] = useState({});
  const [authUser, setAuthUser] = useState(null);
  const [analysisRuns, setAnalysisRuns] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState({ active: false, completed: 0, total: 0 });
  const [activeAnalysisGameId, setActiveAnalysisGameId] = useState(null);
  const [preferredEngineMode, setPreferredEngineMode] = useState('auto');

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      if (getAuthUserId(user)) {
        setAnalysisRuns(listAnalysisRuns(getAuthUserId(user)));
      } else {
        setAnalysisRuns([]);
      }
    });
    return unsubscribe;
  }, []);


  useEffect(() => {
    if (!selectedGame) {
      return;
    }

    const refreshedGame = games.find((game) => game.id === selectedGame.id);
    if (refreshedGame && refreshedGame !== selectedGame) {
      setSelectedGame(refreshedGame);
    }
  }, [games, selectedGame]);

  const hydratePuzzleProgress = useCallback(async (detectedPatterns, nextUsernames) => {
    const userKey = nextUsernames.lichess || nextUsernames.chesscom || 'guest';
    const entries = await Promise.all(detectedPatterns.map(async (entry) => {
      const progress = await getPuzzleProgress(userKey, entry.puzzleTheme || 'short');
      return [entry.puzzleTheme || 'short', progress];
    }));
    setPuzzleProgressByPattern(Object.fromEntries(entries));
  }, []);

  // ─── Fetch and Analyze Games ───
  const startAnalysis = useCallback(async ({
    chesscomUser = '',
    lichessUser = '',
    uploadedPgn = '',
    engineMode = 'auto',
    timeWindow = 'last30Days',
  }) => {
    setScreen('loading');
    setPreferredEngineMode(engineMode);
    setError(null);
    setUsernames({ chesscom: chesscomUser, lichess: lichessUser });

    try {
      let allGames = [];
      const dateFrom = getDateFromWindow(timeWindow);

      // Step 1: Fetch from Chess.com
      if (chesscomUser && !uploadedPgn.trim()) {
        setLoadingStep(0);
        setLoadingMessage(`Connecting to Chess.com as "${chesscomUser}"...`);
        try {
          const chesscomGames = await getChesscomGames(chesscomUser, MAX_GAMES_PER_ANALYSIS, dateFrom);
          allGames.push(...chesscomGames);
          setLoadingStep(1);
        } catch (err) {
          console.warn('Chess.com fetch failed:', err.message);
          setLoadingStep(1);
        }
      } else {
        setLoadingStep(1);
      }

      // Step 2: Fetch from Lichess
      if (lichessUser && !uploadedPgn.trim()) {
        setLoadingStep(2);
        setLoadingMessage(`Connecting to Lichess as "${lichessUser}"...`);
        try {
          const lichessGames = await getLichessGames(lichessUser, MAX_GAMES_PER_ANALYSIS, dateFrom);
          allGames.push(...lichessGames);
          setLoadingStep(3);
        } catch (err) {
          console.warn('Lichess fetch failed:', err.message);
          setLoadingStep(3);
        }
      } else {
        setLoadingStep(3);
      }

      if (uploadedPgn.trim()) {
        const importedGames = parseUploadedPgnGames(uploadedPgn, { chesscomUser, lichessUser });
        allGames = importedGames;
      }

      if (allGames.length === 0) {
        setError('No games found. Please check your username(s), filter window, and try again.');
        setScreen('setup');
        return;
      }

      // Step 3: Sort by date (most recent first)
      allGames.sort((a, b) => new Date(b.date) - new Date(a.date));
      allGames = allGames.slice(0, MAX_GAMES_PER_ANALYSIS);

      // Step 4: Finish setup (analysis happens on-demand per game)
      setLoadingStep(4);
      setLoadingMessage(`Loaded ${allGames.length} games. Analyze each one as you review it.`);

      // Step 5: Detect patterns
      setLoadingStep(5);
      setLoadingMessage('Patterns unlock as you analyze games.');
      const detectedPatterns = detectPatterns([]);

      // Step 6: Done!
      setLoadingStep(6);
      setLoadingMessage('Your coaching report is ready!');

      await new Promise((r) => setTimeout(r, 600));

      const resolvedPatterns = detectedPatterns.length > 0 ? detectedPatterns : getDefaultPatterns();
      const authUserId = getAuthUserId(authUser);
      if (authUserId) {
        recordAnalysisRun({
          userId: authUserId,
          usernames: { chesscom: chesscomUser, lichess: lichessUser },
          games: allGames,
          patterns: resolvedPatterns,
        });
        setAnalysisRuns(listAnalysisRuns(authUserId));
      }
      setGames(allGames);
      setPatterns(resolvedPatterns);
      await hydratePuzzleProgress(resolvedPatterns, { chesscom: chesscomUser, lichess: lichessUser });
      setScreen('dashboard');
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Analysis pipeline error:', err);
      setError(`Something went wrong: ${err.message}. Please try again.`);
      setScreen('setup');
    } finally {
      setAnalysisProgress((prev) => ({ ...prev, active: false }));
    }
  }, [authUser, hydratePuzzleProgress]);

  // ─── Navigation ───
  const handleSelectGame = (game) => {
    setSelectedGame(game);
    setScreen('review');
    setActiveTab('review');
  };

  const handleNavigateToPuzzles = (pattern) => {
    setSelectedPattern(pattern);
    setScreen('puzzles');
    setActiveTab('puzzles');
  };

  const goToDashboard = () => {
    setScreen('dashboard');
    setActiveTab('dashboard');
  };

  const handlePuzzleProgressUpdate = useCallback(async ({ pattern, solved, tries, timeSpent }) => {
    const userKey = usernames.lichess || usernames.chesscom || 'guest';
    const progress = await updatePuzzleProgress({
      userKey,
      pattern,
      solved,
      tries,
      timeSpent,
    });
    setPuzzleProgressByPattern((current) => ({ ...current, [pattern]: progress }));
    return progress;
  }, [usernames]);


  const handleReanalyzeGames = useCallback(async () => {
    if (!games.length || analysisProgress.active) {
      return;
    }

    await refreshAnalysisInBackground({
      games,
      engineMode: resolveRefreshMode(preferredEngineMode, games),
      forceRefresh: true,
      authUser,
      usernames,
      setGames,
      setPatterns,
      setAnalysisRuns,
      setAnalysisProgress,
    });
  }, [analysisProgress.active, authUser, games, preferredEngineMode, usernames]);

  const persistAnalyzedGame = useCallback((gameId, analysis) => {
    const nextGames = games.map((game) => (
      game.id === gameId
        ? { ...game, analysis, analysisStatus: deriveAnalysisStatus(analysis) }
        : game
    ));
    const resolvedPatterns = resolvePatterns(nextGames);
    setGames(nextGames);
    setPatterns(resolvedPatterns);

    const authUserId = getAuthUserId(authUser);
    if (authUserId) {
      recordAnalysisRun({ userId: authUserId, usernames, games: nextGames, patterns: resolvedPatterns });
      setAnalysisRuns(listAnalysisRuns(authUserId));
    }
  }, [authUser, games, usernames]);

  const handleAnalyzeGame = useCallback(async (gameId) => {
    if (analysisProgress.active || !gameId) {
      return;
    }

    const target = games.find((game) => game.id === gameId);
    if (!target?.pgn) {
      return;
    }

    setError(null);
    setActiveAnalysisGameId(gameId);
    setAnalysisProgress({ active: true, completed: 0, total: 1 });
    try {
      const result = await analyzeGame(target.pgn, target.playerColor, preferredEngineMode, { forceRefresh: true });
      const analysis = hasAnalyzedMoves(result)
        ? result
        : buildMaterialFallbackAnalysisFromPgn(target.pgn, target.playerColor);
      persistAnalyzedGame(gameId, analysis);
    } catch (err) {
      console.warn('Manual game analysis failed:', err.message);
      const fallbackAnalysis = buildMaterialFallbackAnalysisFromPgn(target.pgn, target.playerColor);
      persistAnalyzedGame(gameId, fallbackAnalysis);
      setError(`Engine unavailable right now. Loaded material-based move review for this game.`);
    } finally {
      setActiveAnalysisGameId(null);
      setAnalysisProgress({ active: false, completed: 1, total: 1 });
    }
  }, [analysisProgress.active, games, persistAnalyzedGame, preferredEngineMode]);

  const showNav = authUser && screen !== 'setup' && screen !== 'loading';
  const requiresAuth = isAuthConfigured() && !authUser;
  const analysisCompletion = getAnalysisCompletion(analysisProgress);
  const engineStatusTitle = analysisProgress.total > 0
    ? `Stockfish analyzing: ${analysisProgress.completed}/${analysisProgress.total} games (${analysisCompletion}%)`
    : 'Stockfish idle';

  const handleLogout = async () => {
    await logoutUser();
    setScreen('setup');
  };

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <div className="logo">♞</div>
          <h1>Chess<span>Coach</span> AI</h1>
          <div
            className={`engine-indicator ${analysisProgress.active ? 'active' : ''}`}
            role="status"
            aria-live="polite"
            title={engineStatusTitle}
          >
            <span className="engine-light" />
            <span className="engine-label">{analysisProgress.active ? `${analysisCompletion}%` : 'Idle'}</span>
          </div>
        </div>
        {showNav && (
          <nav className="header-nav">
            <button
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={goToDashboard}
            >
              Dashboard
            </button>
            <button
              className={activeTab === 'puzzles' ? 'active' : ''}
              onClick={() => { setScreen('puzzles'); setActiveTab('puzzles'); }}
            >
              Puzzles
            </button>
            <button onClick={handleLogout}>Logout</button>
          </nav>
        )}
      </header>

      <div className="app-container">
        {requiresAuth && (
          <LoginScreen onLoginSuccess={() => setError(null)} onError={setError} />
        )}
        {!requiresAuth && screen === 'setup' && (
          <SetupScreen onSubmit={startAnalysis} error={error} />
        )}
        {!requiresAuth && screen === 'loading' && (
          <LoadingScreen step={loadingStep} message={loadingMessage} />
        )}
        {!requiresAuth && screen === 'dashboard' && (
          <Dashboard
            games={games}
            patterns={patterns}
            analysisRuns={analysisRuns}
            puzzleProgressByPattern={puzzleProgressByPattern}
            onSelectGame={handleSelectGame}
            onNavigateToPuzzles={handleNavigateToPuzzles}
            onReanalyzeGames={handleReanalyzeGames}
            analysisInProgress={analysisProgress.active}
          />
        )}
        {!requiresAuth && screen === 'review' && selectedGame && (
          <GameReview
            game={selectedGame}
            onBack={goToDashboard}
            onReanalyzeGames={handleReanalyzeGames}
            onAnalyzeGame={handleAnalyzeGame}
            activeAnalysisGameId={activeAnalysisGameId}
            analysisInProgress={analysisProgress.active}
          />
        )}
        {!requiresAuth && screen === 'puzzles' && (
          <PuzzleTrainer
            pattern={selectedPattern}
            patterns={patterns}
            games={games}
            onBack={goToDashboard}
            usernames={usernames}
            onPuzzleProgressUpdate={handlePuzzleProgressUpdate}
          />
        )}
      </div>
    </>
  );
}

function createFallbackAnalysis(seed = 0) {
  const basis = seed + 1;
  return {
    moves: [],
    accuracy: 58 + (basis % 11),
    blunders: basis % 2,
    mistakes: 1 + (basis % 2),
    inaccuracies: 1 + (basis % 3),
    phases: {
      opening: 62 + (basis % 8),
      middlegame: 50 + (basis % 10),
      endgame: 42 + (basis % 12),
    },
  };
}


function hasAnalyzedMoves(analysis) {
  return Array.isArray(analysis?.moves) && analysis.moves.length > 0;
}

function buildMaterialFallbackAnalysisFromPgn(pgn, playerColor = 'white') {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return createFallbackAnalysis(0);
  }

  const history = chess.history({ verbose: true });
  chess.reset();
  const moves = [];
  const phaseBuckets = { opening: [], middlegame: [], endgame: [] };
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;

  history.forEach((move, index) => {
    const beforeEval = estimateMaterialEval(chess.fen());
    const fenBefore = chess.fen();
    chess.move(move.san);
    const afterEval = estimateMaterialEval(chess.fen());
    const isWhiteMove = index % 2 === 0;
    const isPlayerMove = (isWhiteMove && playerColor === 'white') || (!isWhiteMove && playerColor === 'black');
    const evalDrop = computeMaterialEvalDrop({ isPlayerMove, isWhiteMove, beforeEval, afterEval });
    const classification = classifyMaterialMove(evalDrop, isPlayerMove);

    if (classification === 'blunder') blunders += 1;
    if (classification === 'mistake') mistakes += 1;
    if (classification === 'inaccuracy') inaccuracies += 1;

    const phase = resolveMovePhase(index, history.length);
    const moveScore = Math.max(45, Math.round(72 - evalDrop * 15));
    phaseBuckets[phase].push(moveScore);

    moves.push({
      num: Math.floor(index / 2) + 1,
      san: move.san,
      isWhite: isWhiteMove,
      fenBefore,
      fenAfter: chess.fen(),
      eval: Number(afterEval.toFixed(2)),
      beforeEval: Number(beforeEval.toFixed(2)),
      evalSwing: Number((afterEval - beforeEval).toFixed(2)),
      evalDrop,
      classification,
      phase,
      isPlayerMove,
      from: move.from,
      to: move.to,
      evalSource: 'material',
      bestMove: null,
      playerMatchedBestMove: false,
      moveScore,
      afterEvaluation: { eval: Number(afterEval.toFixed(2)), source: 'material' },
    });
  });

  return {
    moves,
    accuracy: calculateFallbackAccuracy(moves),
    blunders,
    mistakes,
    inaccuracies,
    phases: {
      opening: averageBucket(phaseBuckets.opening),
      middlegame: averageBucket(phaseBuckets.middlegame),
      endgame: averageBucket(phaseBuckets.endgame),
    },
    quality: { primarySource: 'material', engineShare: 0, materialShare: 100, needsRefinement: true },
  };
}

function calculateFallbackAccuracy(moves) {
  const playerMoves = moves.filter((move) => move.isPlayerMove);
  if (!playerMoves.length) return 0;
  const totalScore = playerMoves.reduce((sum, move) => sum + (move.moveScore || 0), 0);
  return Math.round(totalScore / playerMoves.length);
}

function averageBucket(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function resolveMovePhase(index, totalMoves) {
  const progress = index / Math.max(totalMoves, 1);
  if (progress < 0.25) return 'opening';
  if (progress < 0.7) return 'middlegame';
  return 'endgame';
}

function classifyMaterialMove(evalDrop, isPlayerMove) {
  if (!isPlayerMove) return 'book';
  if (evalDrop > 2) return 'blunder';
  if (evalDrop > 1) return 'mistake';
  if (evalDrop > 0.45) return 'inaccuracy';
  if (evalDrop <= 0.08) return 'good';
  return 'inaccuracy';
}

function computeMaterialEvalDrop({ isPlayerMove, isWhiteMove, beforeEval, afterEval }) {
  if (!isPlayerMove) return 0;
  return isWhiteMove ? Math.max(0, beforeEval - afterEval) : Math.max(0, afterEval - beforeEval);
}

function estimateMaterialEval(fen) {
  const pieces = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return fen.split(' ')[0].split('').reduce((score, piece) => {
    const symbol = piece.toLowerCase();
    if (!(symbol in pieces)) return score;
    return piece === piece.toUpperCase() ? score + pieces[symbol] : score - pieces[symbol];
  }, 0);
}

function getDefaultPatterns() {
  return [
    {
      name: 'Keep Playing to Build Data',
      icon: '📊',
      severity: 'moderate',
      frequency: 0,
      description: "Analyze games from the review screen to unlock pattern detection. We'll combine the lessons once enough games are reviewed.",
      coaching: 'Start with your toughest losses first. After each manual analysis, your dashboard and training plan will update automatically.',
      puzzleTheme: 'short',
    },
  ];
}

function parseUploadedPgnGames(uploadedPgn, usernames = {}) {
  return splitPgnGames(uploadedPgn)
    .map((pgn, index) => toUploadedGame(pgn, index, usernames))
    .filter(Boolean)
    .filter((game) => !isCoachOpponent(game.opponent));
}

function toUploadedGame(pgn, index, usernames) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return null;
  }

  const headers = chess.header();
  const whiteName = headers.White || '';
  const blackName = headers.Black || '';
  const userIsWhite = inferUploadedPlayerIsWhite(whiteName, blackName, usernames);

  return {
    id: `upload-${index}`,
    platform: 'upload',
    pgn,
    url: '',
    playerColor: userIsWhite ? 'white' : 'black',
    opponent: userIsWhite ? blackName || 'Uploaded Opponent' : whiteName || 'Uploaded Opponent',
    opponentRating: Number(userIsWhite ? (headers.BlackElo || 0) : (headers.WhiteElo || 0)),
    playerRating: Number(userIsWhite ? (headers.WhiteElo || 0) : (headers.BlackElo || 0)),
    result: normalizePgnResult(headers.Result, userIsWhite),
    timeControl: headers.TimeControl || 'Unknown',
    date: normalizeDate(headers.Date),
    opening: headers.Opening || 'Uploaded PGN',
    eco: headers.ECO || '',
    analysis: null,
    moves: [],
  };
}

function inferUploadedPlayerIsWhite(whiteName, blackName, usernames = {}) {
  const candidates = [usernames.chesscom, usernames.lichess]
    .filter(Boolean)
    .map((name) => String(name).trim().toLowerCase());
  const white = String(whiteName || '').trim().toLowerCase();
  const black = String(blackName || '').trim().toLowerCase();

  if (candidates.length === 0) {
    return !isCoachOpponent(blackName);
  }
  if (candidates.includes(white)) return true;
  if (candidates.includes(black)) return false;
  return !isCoachOpponent(blackName);
}

function getDateFromWindow(window) {
  const days = WINDOW_TO_DAYS[window] || WINDOW_TO_DAYS.last30Days;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

async function refreshAnalysisInBackground({
  games,
  engineMode,
  authUser,
  usernames,
  setGames,
  setPatterns,
  setAnalysisRuns,
  setAnalysisProgress,
  forceRefresh = false,
}) {
  const refreshedGames = games.map((game) => ({ ...game }));
  setAnalysisProgress({ active: true, completed: 0, total: refreshedGames.length });

  for (let i = 0; i < refreshedGames.length; i += 1) {
    const game = refreshedGames[i];
    if (!game.pgn) {
      game.analysisStatus = 'fallback-material';
      setAnalysisProgress({ active: true, completed: i + 1, total: refreshedGames.length });
      continue;
    }

    try {
      game.analysis = await analyzeGame(game.pgn, game.playerColor, engineMode, { forceRefresh });
      game.analysisStatus = deriveAnalysisStatus(game.analysis);
      setGames([...refreshedGames]);
      setPatterns(resolvePatterns(refreshedGames));
    } catch (err) {
      console.warn(`Background refinement failed for game ${i}:`, err.message);
    }
    setAnalysisProgress({ active: true, completed: i + 1, total: refreshedGames.length });
  }

  const resolvedPatterns = resolvePatterns(refreshedGames);
  setGames(refreshedGames);
  setPatterns(resolvedPatterns);

  const authUserId = getAuthUserId(authUser);
  if (authUserId) {
    recordAnalysisRun({
      userId: authUserId,
      usernames,
      games: refreshedGames,
      patterns: resolvedPatterns,
    });
    setAnalysisRuns(listAnalysisRuns(authUserId));
  }

  setAnalysisProgress((prev) => ({ ...prev, active: false }));
}

function resolvePatterns(games) {
  const detectedPatterns = detectPatterns(games);
  return detectedPatterns.length > 0 ? detectedPatterns : getDefaultPatterns();
}



function resolveRefreshMode(engineMode, games) {
  const hasFallbackGames = games.some((game) => deriveAnalysisStatus(game.analysis) === 'fallback-material');
  if (hasFallbackGames) return 'auto';
  return engineMode;
}

function deriveAnalysisStatus(analysis) {
  if (!analysis || !Array.isArray(analysis.moves) || analysis.moves.length === 0) {
    return 'fallback-material';
  }

  const quality = analysis.quality;
  if (!quality) return 'complete';
  if (quality.primarySource === 'material' || quality.needsRefinement) {
    return 'fallback-material';
  }
  return 'complete';
}

function splitPgnGames(text) {
  return text
    .split(/(?=\[Event\s+")/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes('1.'));
}

function normalizePgnResult(result, userIsWhite) {
  if (result === '1-0') return userIsWhite ? 'win' : 'loss';
  if (result === '0-1') return userIsWhite ? 'loss' : 'win';
  return 'draw';
}

function isCoachOpponent(name = '') {
  return /(coach|bot|computer|stockfish|chesscoach|maia)/i.test(name);
}

function normalizeDate(rawDate = '') {
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(rawDate)) {
    return rawDate.replace(/\./g, '-');
  }
  return new Date().toISOString().split('T')[0];
}


function getAnalysisCompletion(progress) {
  if (!progress.total) return 0;
  return Math.round((progress.completed / progress.total) * 100);
}

function getAuthUserId(user) {
  return user?.id || user?.uid || null;
}

export default App;
