import { useState } from 'react';
import { isAuthConfigured, loginWithPassword } from '../services/auth';

export default function LoginScreen({ onLoginSuccess, onError }) {
  const configured = isAuthConfigured();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await loginWithPassword(email, password);
      onLoginSuccess();
    } catch (err) {
      onError(err.message || 'Authentication failed.');
    }
  };

  return (
    <div className="setup-card animate-in" style={{ textAlign: 'left' }}>
      <h2 style={{ marginBottom: 8 }}>Sign in required</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        Log in to run analysis and track long-term improvement trends.
      </p>
      <div className="input-group">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      </div>
      <div className="input-group">
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      </div>
      <button className="btn-primary" onClick={handleLogin} disabled={!configured || !email || !password}>
        Continue
      </button>
      {!configured && (
        <p style={{ color: 'var(--accent-amber)', marginTop: 12, fontSize: 12 }}>
          Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth.
        </p>
      )}
    </div>
  );
}
