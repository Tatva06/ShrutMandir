import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { RefreshCw } from 'lucide-react';

const STATUS_CONFIG = {
  Present: { badgeClass: 'badge-green',  icon: '✅', pts: 10 },
  Absent:  { badgeClass: 'badge-red',    icon: '❌', pts: 0  },
  Late:    { badgeClass: 'badge-amber',  icon: '🕐', pts: 5  },
  Pending: { badgeClass: 'badge-indigo', icon: '⏳', pts: 0  },
};

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function Attendance() {
  const [selectedDate,  setSelectedDate]  = useState(todayIST());
  const [selectedClass, setSelectedClass] = useState('all');
  const [search,        setSearch]        = useState('');
  const [students,      setStudents]      = useState([]);
  const [classes,       setClasses]       = useState([]);
  const [loading,       setLoading]       = useState(true);

  // Track per-student override selections { [studentId]: 'Present'|'Absent'|'Late' }
  const [overrideMap,   setOverrideMap]   = useState({});
  // Track which rows are currently saving
  const [savingIds,     setSavingIds]     = useState(new Set());
  // Track which class is being reset
  const [resettingClass, setResettingClass] = useState(null);

  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [studentRes, classRes] = await Promise.all([
        api.get(`/students?t=${Date.now()}`),
        api.get('/classes'),
      ]);
      setStudents(studentRes.data.data || []);
      setClasses(classRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build per-student rows
  const attendanceRows = students
    .filter(s => {
      if (selectedClass !== 'all') {
        const cid = s.classId?._id || s.classId;
        if (cid !== selectedClass) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q);
      }
      return true;
    })
    .map(s => {
      const log = (s.attendanceLogs || []).find(l => l.date === selectedDate);
      return {
        id:            s._id,
        rollNo:        s.rollNo,
        name:          s.name,
        classIdRaw:    s.classId?._id || s.classId,
        className:     s.classId?.className || '—',
        status:        log?.status || 'Pending',
        pointsAwarded: log?.pointsAwarded ?? null,
        loggedBy:      log?.loggedBy || '—',
        time:          log?.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    present: attendanceRows.filter(r => r.status === 'Present').length,
    absent:  attendanceRows.filter(r => r.status === 'Absent').length,
    late:    attendanceRows.filter(r => r.status === 'Late').length,
    pending: attendanceRows.filter(r => r.status === 'Pending').length,
  };

  // ── Override a single student ──────────────────────────────────────────────
  const handleOverride = async (row) => {
    const newStatus = overrideMap[row.id];
    if (!newStatus || newStatus === row.status) return;

    setSavingIds(prev => new Set(prev).add(row.id));
    try {
      const token = localStorage.getItem('token');
      await api.put(`/students/${row.id}/attendance-override`, {
        status:    newStatus,
        date:      selectedDate,
        loggedBy:  `SuperAdmin (${adminUser.name || 'Admin'})`,
      }, { headers: { Authorization: `Bearer ${token}` } });

      // Optimistically update local state
      setStudents(prev => prev.map(s => {
        if (s._id !== row.id) return s;
        const filtered = (s.attendanceLogs || []).filter(l => l.date !== selectedDate);
        const pts = STATUS_CONFIG[newStatus]?.pts ?? 0;
        return {
          ...s,
          points: (s.points || 0) - (row.pointsAwarded ?? 0) + pts,
          attendanceLogs: [
            ...filtered,
            { date: selectedDate, status: newStatus, pointsAwarded: pts, timestamp: new Date().toISOString(), loggedBy: `SuperAdmin (${adminUser.name || 'Admin'})` }
          ],
        };
      }));
      setOverrideMap(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (err) {
      alert(`Failed to override: ${err.response?.data?.message || err.message}`);
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  };

  // ── Reset entire class for a date ──────────────────────────────────────────
  const handleResetClass = async (classId, className) => {
    if (!window.confirm(`⚠️ This will DELETE ALL attendance for "${className}" on ${selectedDate} and unlock the class.\n\nAll points earned from attendance that day will be reversed.\n\nAre you sure?`)) return;

    setResettingClass(classId);
    try {
      const token = localStorage.getItem('token');
      const res = await api.post(`/classes/${classId}/reset-attendance`, { date: selectedDate }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ ${res.data.message}`);
      await fetchData(true);
      setOverrideMap({});
    } catch (err) {
      alert(`Failed to reset: ${err.response?.data?.message || err.message}`);
    } finally {
      setResettingClass(null);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const header = 'Roll No,Name,Class,Status,Points Awarded,Logged By,Time\n';
    const rows = attendanceRows.map(r =>
      `"${r.rollNo}","${r.name}","${r.className}","${r.status}","${r.pointsAwarded ?? 0}","${r.loggedBy}","${r.time}"`
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isToday = selectedDate === todayIST();

  // Group unique classes present in filtered rows (for reset buttons)
  const classesInView = [...new Map(
    attendanceRows.filter(r => r.classIdRaw).map(r => [r.classIdRaw, r.className])
  ).entries()];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>📋 Attendance Register</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            View, override, and reset attendance — SuperAdmin changes always override teacher inputs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => fetchData(true)}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>⬇️ Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={labelStyle}>📅 Date</label>
            <input type="date" className="input-field" value={selectedDate} max={todayIST()}
              onChange={e => { setSelectedDate(e.target.value); setOverrideMap({}); }}
              style={{ width: '100%', colorScheme: 'dark' }} />
          </div>
          <div style={{ flex: '1', minWidth: '180px' }}>
            <label style={labelStyle}>🏫 Class</label>
            <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c._id} value={c._id}>{c.className}</option>)}
            </select>
          </div>
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label style={labelStyle}>🔍 Search</label>
            <input type="text" className="input-field" placeholder="Name or roll no..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Present', count: summary.present, color: 'var(--accent-green)',         icon: '✅' },
          { label: 'Absent',  count: summary.absent,  color: 'var(--accent-red)',           icon: '❌' },
          { label: 'Late',    count: summary.late,    color: 'var(--accent-amber)',         icon: '🕐' },
          { label: 'Pending', count: summary.pending, color: 'var(--accent-indigo-light)', icon: '⏳' },
        ].map(({ label, count, color, icon }) => (
          <div key={label} className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{icon}</div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, color }}>{count}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Reset buttons per class */}
      {classesInView.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>🔄 Reset class attendance:</span>
          {classesInView.map(([cid, cname]) => (
            <button
              key={cid}
              className="btn btn-danger"
              style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }}
              onClick={() => handleResetClass(cid, cname)}
              disabled={resettingClass === cid}
            >
              {resettingClass === cid ? 'Resetting…' : `🗑 ${cname}`}
            </button>
          ))}
        </div>
      )}

      {/* Date banner */}
      <div style={{
        padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
        backgroundColor: isToday ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.08)',
        border: `1px solid ${isToday ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
        fontSize: '0.9rem', fontWeight: 600,
        color: isToday ? 'var(--accent-green)' : 'var(--accent-indigo-light)',
      }}>
        {isToday
          ? "📅 Today's live attendance — you can override any row below"
          : `📅 Historical attendance for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        {summary.pending > 0 && (
          <span style={{ marginLeft: '1rem', color: 'var(--accent-amber)' }}>
            ⚠️ {summary.pending} students not yet marked
          </span>
        )}
      </div>

      {/* Main table */}
      <div className="glass-card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading…</p>
        ) : attendanceRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No students found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Roll</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Logged By</th>
                  <th>Time</th>
                  <th style={{ color: 'var(--accent-amber)' }}>Override</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row, idx) => {
                  const pendingOverride = overrideMap[row.id];
                  const isSaving = savingIds.has(row.id);
                  const hasChange = pendingOverride && pendingOverride !== row.status;
                  return (
                    <tr key={row.id} style={{ backgroundColor: hasChange ? 'rgba(245,158,11,0.07)' : undefined }}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ color: 'var(--text-sub)', fontWeight: 600 }}>{row.rollNo}</td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{row.className}</td>
                      <td>
                        <span className={`badge ${STATUS_CONFIG[row.status]?.badgeClass || 'badge-indigo'}`}>
                          {STATUS_CONFIG[row.status]?.icon} {row.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                        {row.status === 'Pending' ? '—' : `+${row.pointsAwarded ?? 0} pts`}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{row.loggedBy}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{row.time}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select
                            value={pendingOverride || row.status}
                            onChange={e => setOverrideMap(prev => ({ ...prev, [row.id]: e.target.value }))}
                            style={{
                              background: 'var(--bg-dark)', color: 'var(--text-main)',
                              border: `1px solid ${hasChange ? 'var(--accent-amber)' : 'var(--border-light)'}`,
                              borderRadius: '8px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', cursor: 'pointer',
                            }}
                          >
                            <option value="Present">✅ Present</option>
                            <option value="Absent">❌ Absent</option>
                            <option value="Late">🕐 Late</option>
                            {row.status === 'Pending' && <option value="Pending" disabled>⏳ Pending</option>}
                          </select>
                          {hasChange && (
                            <button
                              onClick={() => handleOverride(row)}
                              disabled={isSaving}
                              style={{
                                background: 'var(--accent-amber)', color: '#000',
                                border: 'none', borderRadius: '8px',
                                padding: '0.3rem 0.75rem', fontSize: '0.8rem',
                                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              {isSaving ? '…' : 'Save'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>
        {attendanceRows.length} students shown
      </p>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)',
  fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px',
};
