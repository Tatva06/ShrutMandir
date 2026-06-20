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
        if (res.data.user.role !== 'SuperAdmin') {
          setError('Access Denied. Only SuperAdmin accounts can log in here.');
          return;
        }
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
      minHeight: '100vh', backgroundColor: 'var(--bg-dark)',
      padding: '1.5rem'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 'clamp(1.5rem, 5vw, 2.5rem)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <img
            src="/shrutmandir-logo.png"
            alt="ShrutMandir"
            style={{
              width: 140,
              height: 140,
              objectFit: 'contain',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.03)',
              padding: 6,
              boxShadow: '0 0 30px rgba(195,192,255,0.2)',
              marginBottom: '1rem',
            }}
          />
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SuperAdmin Portal
          </p>
        </div>

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
            <input type="text" className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. rahul_jain" required />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: 4, fontWeight: 600 }}>
              <Lock size={14} /> Password
            </label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Logging in...' : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
}
