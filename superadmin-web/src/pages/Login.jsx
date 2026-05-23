import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import api from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Server error. Could not log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: 'var(--bg-dark)'
    }}>
      <div className="glass-card" style={{ width: 400, padding: '2.5rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>ShrutMandir</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          SuperAdmin & Teacher Portal
        </p>

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', padding: '0.75rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: 4, fontWeight: 600 }}>
              <User size={14} /> Username
            </label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul_jain"
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: 4, fontWeight: 600 }}>
              <Lock size={14} /> Password
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Logging in...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
