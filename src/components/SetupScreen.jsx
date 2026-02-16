import { useState } from 'react';

export default function SetupScreen({ onSubmit, error }) {
  const [chesscomUser, setChesscomUser] = useState('');
  const [lichessUser, setLichessUser] = useState('');

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
        <button
          className="btn-primary"
          disabled={!chesscomUser && !lichessUser}
          onClick={() => onSubmit(chesscomUser, lichessUser)}
        >
          Analyze My Games →
        </button>
      </div>
    </div>
  );
}
