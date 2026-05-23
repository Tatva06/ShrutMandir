import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, Settings, LogOut } from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ShrutMandir
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
            Logged in as <strong style={{ color: 'var(--text-sub)' }}>{user.name}</strong>
          </p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink to="/" end className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          
          <NavLink to="/students" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <Users size={18} /> Students
          </NavLink>

          <NavLink to="/teachers" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <BookOpen size={18} /> Teachers
          </NavLink>

          {user.role === 'SuperAdmin' && (
            <NavLink to="/settings" className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
              <Settings size={18} /> Settings
            </NavLink>
          )}
        </nav>

        <button onClick={handleLogout} className="btn btn-danger" style={{ justifyContent: 'flex-start', marginTop: 'auto' }}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
