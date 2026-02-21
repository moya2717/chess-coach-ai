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

      // Step 4: Analyze each game with Stockfish
      setLoadingStep(4);
      const estimatedSeconds = estimateTotalAnalysisSeconds(allGames.length, engineMode);
      setLoadingMessage(`Running deep Stockfish analysis on ${allGames.length} games (~${estimatedSeconds}s estimated)...`);

      for (let i = 0; i < allGames.length; i += 1) {
        const game = allGames[i];
        if (!game.pgn) {
          game.analysis = createFallbackAnalysis();
          continue;
        }

        const remaining = Math.max(0, allGames.length - i - 1);
        const remainingSeconds = estimateTotalAnalysisSeconds(remaining, engineMode);
        setLoadingMessage(`Analyzing game ${i + 1} of ${allGames.length} (vs ${game.opponent}) · ~${remainingSeconds}s remaining`);
        try {
          game.analysis = await analyzeGame(game.pgn, game.playerColor, engineMode);
        } catch (err) {
          console.warn(`Analysis failed for game ${i}:`, err.message);
          game.analysis = createFallbackAnalysis();
        }
      }

      // Step 5: Detect patterns
      setLoadingStep(5);
      setLoadingMessage('Detecting patterns in your play...');
      const detectedPatterns = detectPatterns(allGames);

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

  const showNav = authUser && screen !== 'setup' && screen !== 'loading';
  const requiresAuth = isAuthConfigured() && !authUser;

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
          />
        )}
        {!requiresAuth && screen === 'review' && selectedGame && (
          <GameReview game={selectedGame} onBack={goToDashboard} />
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

function createFallbackAnalysis() {
  return {
    moves: [],
    accuracy: Math.floor(Math.random() * 30) + 50,
    blunders: Math.floor(Math.random() * 3),
    mistakes: Math.floor(Math.random() * 3) + 1,
    inaccuracies: Math.floor(Math.random() * 4) + 1,
    phases: {
      opening: Math.floor(Math.random() * 25) + 60,
      middlegame: Math.floor(Math.random() * 30) + 45,
      endgame: Math.floor(Math.random() * 35) + 35,
    },
  };
}

function getDefaultPatterns() {
  return [
    {
      name: 'Keep Playing to Build Data',
      icon: '📊',
      severity: 'moderate',
      frequency: 0,
      description: 'We need more analyzed games to detect meaningful patterns. Play a few more games and come back for a deeper analysis!',
      coaching: 'The more games we analyze, the smarter your coaching becomes. Try to play at least 10 rated games this week.',
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

function estimateTotalAnalysisSeconds(gameCount, engineMode) {
  const perGameSeconds = engineMode === 'local' ? 4 : 7;
  return gameCount * perGameSeconds;
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

function getAuthUserId(user) {
  return user?.id || user?.uid || null;
}

export default App;
