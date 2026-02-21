import { useState, useCallback } from 'react';
import SetupScreen from './components/SetupScreen';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard';
import GameReview from './components/GameReview';
import PuzzleTrainer from './components/PuzzleTrainer';
import { getRecentGames as getChesscomGames } from './services/chesscom-api';
import { getRecentGames as getLichessGames } from './services/lichess-api';
import { detectPatterns } from './services/analysis';
import { createAnalysisJob, getAnalysisJob } from './services/analysis-jobs-api';

const DEEP_ANALYSIS_LIMIT = 5;
const POLL_INTERVAL_MS = 1200;

function App() {
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

  const startAnalysis = useCallback(async (chesscomUser, lichessUser) => {
    setScreen('loading');
    setError(null);
    setUsernames({ chesscom: chesscomUser, lichess: lichessUser });

    try {
      const allGames = await fetchGames(chesscomUser, lichessUser, setLoadingStep, setLoadingMessage);
      if (allGames.length === 0) {
        setError('No games found. Please check your username(s) and try again.');
        setScreen('setup');
        return;
      }

      allGames.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLoadingStep(4);
      await analyzeGamesWithJobs(allGames, setLoadingMessage);

      setLoadingStep(5);
      setLoadingMessage('Detecting patterns in your play...');
      const detectedPatterns = detectPatterns(allGames);

      setLoadingStep(6);
      setLoadingMessage('Your coaching report is ready!');
      await wait(600);

      setGames(allGames);
      setPatterns(detectedPatterns.length > 0 ? detectedPatterns : getDefaultPatterns());
      setScreen('dashboard');
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Analysis pipeline error:', err);
      setError(`Something went wrong: ${err.message}. Please try again.`);
      setScreen('setup');
    }
  }, []);

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

  const showNav = screen !== 'setup' && screen !== 'loading';

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <div className="logo">♞</div>
          <h1>Chess<span>Coach</span> AI</h1>
        </div>
        {showNav && (
          <nav className="header-nav">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={goToDashboard}>
              Dashboard
            </button>
            <button
              className={activeTab === 'train' ? 'active' : ''}
              onClick={() => { setScreen('puzzles'); setActiveTab('train'); }}
            >
              Train
            </button>
          </nav>
        )}
      </header>

      <div className="app-container">
        {screen === 'setup' && <SetupScreen onSubmit={startAnalysis} error={error} />}
        {screen === 'loading' && <LoadingScreen step={loadingStep} message={loadingMessage} />}
        {screen === 'dashboard' && (
          <Dashboard
            games={games}
            patterns={patterns}
            onSelectGame={handleSelectGame}
            onNavigateToPuzzles={handleNavigateToPuzzles}
          />
        )}
        {screen === 'review' && selectedGame && <GameReview game={selectedGame} onBack={goToDashboard} />}
        {screen === 'puzzles' && (
          <PuzzleTrainer pattern={selectedPattern} patterns={patterns} onBack={goToDashboard} />
        )}
      </div>
    </>
  );
}

async function fetchGames(chesscomUser, lichessUser, setLoadingStep, setLoadingMessage) {
  const allGames = [];

  if (chesscomUser) {
    setLoadingStep(0);
    setLoadingMessage(`Connecting to Chess.com as "${chesscomUser}"...`);
    try {
      const chesscomGames = await getChesscomGames(chesscomUser, 15);
      allGames.push(...chesscomGames);
    } catch (err) {
      console.warn('Chess.com fetch failed:', err.message);
    }
  }
  setLoadingStep(1);

  if (lichessUser) {
    setLoadingStep(2);
    setLoadingMessage(`Connecting to Lichess as "${lichessUser}"...`);
    try {
      const lichessGames = await getLichessGames(lichessUser, 15);
      allGames.push(...lichessGames);
    } catch (err) {
      console.warn('Lichess fetch failed:', err.message);
    }
  }

  setLoadingStep(3);
  return allGames;
}

async function analyzeGamesWithJobs(games, setLoadingMessage) {
  const deepGames = games.slice(0, Math.min(DEEP_ANALYSIS_LIMIT, games.length));
  for (let i = 0; i < deepGames.length; i++) {
    const game = deepGames[i];
    setLoadingStepMessage(setLoadingMessage, i + 1, deepGames.length, game.opponent, 0, 0);
    game.analysis = await runGameJob(game, (processed, total) => {
      setLoadingStepMessage(setLoadingMessage, i + 1, deepGames.length, game.opponent, processed, total);
    });
  }

  for (let i = deepGames.length; i < games.length; i++) {
    if (!games[i].analysis) games[i].analysis = createFallbackAnalysis();
  }
}

async function runGameJob(game, onProgress) {
  const { jobId } = await createAnalysisJob({
    gameId: game.id,
    pgn: game.pgn,
    playerColor: game.playerColor,
    metadata: { platform: game.platform, opponent: game.opponent },
  });

  while (true) {
    const job = await getAnalysisJob(jobId);
    onProgress(job.progress?.processedMoves || 0, job.progress?.totalMoves || 0);
    if (job.status === 'completed') return job.result;
    if (job.status === 'failed') throw new Error(job.error || 'Analysis failed');
    await wait(POLL_INTERVAL_MS);
  }
}

function setLoadingStepMessage(setLoadingMessage, index, total, opponent, processed, moveTotal) {
  const moveLabel = moveTotal > 0 ? ` (${processed}/${moveTotal} moves)` : '';
  setLoadingMessage(`Analyzing game ${index} of ${total} (vs ${opponent})${moveLabel}...`);
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
    }
  };
}

function getDefaultPatterns() {
  return [{
    name: 'Keep Playing to Build Data',
    icon: '📊',
    severity: 'moderate',
    frequency: 0,
    description: 'We need more analyzed games to detect meaningful patterns. Play a few more games and come back for a deeper analysis!',
    coaching: 'The more games we analyze, the smarter your coaching becomes. Try to play at least 10 rated games this week.',
    puzzleTheme: 'short',
  }];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default App;
