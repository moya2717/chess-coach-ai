import { useState } from 'react';

export default function SetupScreen({ onSubmit, error }) {
  const [chesscomUser, setChesscomUser] = useState('');
  const [lichessUser, setLichessUser] = useState('');
  const [engineMode, setEngineMode] = useState('auto');
  const [timeWindow, setTimeWindow] = useState('last30Days');
  const [uploadedPgn, setUploadedPgn] = useState('');

  const canAnalyze = Boolean(chesscomUser || lichessUser || uploadedPgn.trim());

  const handlePgnUpload = async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const rawText = await file.text();
    setUploadedPgn(rawText);
  };

  return (
    <div className="setup-screen">
      <div className="hero-icon animate-in">♞</div>
      <h2 className="animate-in delay-1">Welcome to ChessCoach AI</h2>
      <p className="animate-in delay-2">
        Connect your chess accounts and I'll analyze your games, find your
        recurring patterns, and coach you through your weaknesses — in plain
        English, like a real coach sitting next to you.
      </p>
      {error && (
        <div style={{
          background: 'var(--accent-red-dim)', color: 'var(--accent-red)',
          padding: '12px 20px', borderRadius: 'var(--radius-sm)',
          marginBottom: 16, fontSize: 14, maxWidth: 480
        }}>
          {error}
        </div>
      )}
      <div className="setup-form animate-in delay-3">
        <div className="input-group">
          <label>Chess.com Username</label>
          <input
            placeholder="e.g. hikaru"
            value={chesscomUser}
            onChange={e => setChesscomUser(e.target.value.trim())}
          />
          <div className="hint">Leave blank if you only play on Lichess</div>
        </div>
        <div className="input-group">
          <label>Lichess Username</label>
          <input
            placeholder="e.g. DrNykterstein"
            value={lichessUser}
            onChange={e => setLichessUser(e.target.value.trim())}
          />
          <div className="hint">Leave blank if you only play on Chess.com</div>
        </div>
        <div className="input-group">
          <label>Game Window</label>
          <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
            <option value="last30Days">Last 30 days</option>
            <option value="lastWeek">Last week</option>
          </select>
          <div className="hint">Used for Chess.com/Lichess fetches. PGN upload analyzes uploaded games only.</div>
        </div>
        <div className="input-group">
          <label>Upload PGN File (optional)</label>
          <input type="file" accept=".pgn,text/plain" onChange={handlePgnUpload} />
          <div className="hint">Upload your own PGNs to include custom games in pattern analysis.</div>
        </div>
        <div className="input-group">
          <label>Analysis Engine</label>
          <select value={engineMode} onChange={(e) => setEngineMode(e.target.value)}>
            <option value="auto">Auto (local first, then web/material fallback)</option>
            <option value="web">Stockfish Web API</option>
            <option value="local">Stockfish Local Binary</option>
          </select>
        </div>
        <button
          className="btn-primary"
          disabled={!canAnalyze}
          onClick={() => onSubmit({ chesscomUser, lichessUser, uploadedPgn, engineMode, timeWindow })}
        >
          Analyze My Games →
        </button>
      </div>
    </div>
  );
}
