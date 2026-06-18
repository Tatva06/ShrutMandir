import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, ClipboardList, Menu, X } from 'lucide-react';
import LegalFooter from '../components/LegalFooter';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      try {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'SuperAdmin') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        } else {
          setUser(parsedUser);
        }
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Close sidebar on mobile when a link is clicked
  const closeSidebar = () => setSidebarOpen(false);

  if (!user) return null;

  return (
    <div className="app-container">
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-indigo)' }}>ShrutMandir</h2>
        <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ShrutMandir
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
            Logged in as <strong style={{ color: 'var(--text-sub)' }}>{user.name}</strong>
          </p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink to="/" end onClick={closeSidebar} className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          
          <NavLink to="/students" onClick={closeSidebar} className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <Users size={18} /> Students
          </NavLink>

          <NavLink to="/teachers" onClick={closeSidebar} className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <BookOpen size={18} /> Teachers
          </NavLink>

          <NavLink to="/attendance" onClick={closeSidebar} className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
            <ClipboardList size={18} /> Attendance
          </NavLink>

          {user.role === 'SuperAdmin' && (
            <NavLink to="/settings" onClick={closeSidebar} className={({ isActive }) => `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`} style={{ justifyContent: 'flex-start' }}>
              <Settings size={18} /> Settings
            </NavLink>
          )}
        </nav>

        <button onClick={handleLogout} className="btn btn-danger" style={{ justifyContent: 'flex-start', marginTop: 'auto', marginBottom: '1rem' }}>
          <LogOut size={18} /> Logout
        </button>

        <LegalFooter />
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
