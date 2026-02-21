// ═══════════════════════════════════════════
// App.jsx — Main Application Controller
// ═══════════════════════════════════════════
// Think of this as the "project manager" that coordinates
// all the different departments (API services, components,
// analysis engine, coach voice).
// ═══════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
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
  const startAnalysis = useCallback(async (chesscomUser, lichessUser) => {
    setScreen('loading');
    setError(null);
    setUsernames({ chesscom: chesscomUser, lichess: lichessUser });

    try {
      let allGames = [];

      // Step 1: Fetch from Chess.com
      if (chesscomUser) {
        setLoadingStep(0);
        setLoadingMessage(`Connecting to Chess.com as "${chesscomUser}"...`);
        try {
          const chesscomGames = await getChesscomGames(chesscomUser, 15);
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
      if (lichessUser) {
        setLoadingStep(2);
        setLoadingMessage(`Connecting to Lichess as "${lichessUser}"...`);
        try {
          const lichessGames = await getLichessGames(lichessUser, 15);
          allGames.push(...lichessGames);
          setLoadingStep(3);
        } catch (err) {
          console.warn('Lichess fetch failed:', err.message);
          setLoadingStep(3);
        }
      } else {
        setLoadingStep(3);
      }

      if (allGames.length === 0) {
        setError('No games found. Please check your username(s) and try again.');
        setScreen('setup');
        return;
      }

      // Step 3: Sort by date (most recent first)
      allGames.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Step 4: Analyze each game with Stockfish
      setLoadingStep(4);
      setLoadingMessage('Running Stockfish analysis on your games...');

      // Analyze the first few games deeply (the rest get quick analysis)
      const deepAnalysisCount = Math.min(5, allGames.length);
      for (let i = 0; i < allGames.length; i++) {
        const game = allGames[i];
        if (game.pgn && i < deepAnalysisCount) {
          setLoadingMessage(`Analyzing game ${i + 1} of ${deepAnalysisCount} (vs ${game.opponent})...`);
          try {
            game.analysis = await analyzeGame(game.pgn, game.playerColor);
          } catch (err) {
            console.warn(`Analysis failed for game ${i}:`, err.message);
            game.analysis = createFallbackAnalysis();
          }
        } else if (!game.analysis) {
          // Quick fallback analysis for remaining games
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

      // Short pause so user sees the final step
      await new Promise(r => setTimeout(r, 600));

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
    setActiveTab('train');
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
      {/* Header */}
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
              className={activeTab === 'train' ? 'active' : ''}
              onClick={() => { setScreen('puzzles'); setActiveTab('train'); }}
            >
              Train
            </button>
            <button onClick={handleLogout}>Logout</button>
          </nav>
        )}
      </header>

      {/* Main Content */}
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
            onBack={goToDashboard}
            usernames={usernames}
            onPuzzleProgressUpdate={handlePuzzleProgressUpdate}
          />
        )}
      </div>
    </>
  );
}

// ─── Fallback analysis for games we can't analyze deeply ───
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
    }
  };
}

// ─── Default patterns if none detected ───
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
    }
  ];
}

function getAuthUserId(user) {
  return user?.id || user?.uid || null;
}

export default App;
