import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { Calendar, Users, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

const STATUS_CONFIG = {
  Present: { color: 'var(--accent-green)',  badgeClass: 'badge-green',  icon: '✅' },
  Absent:  { color: 'var(--accent-red)',    badgeClass: 'badge-red',    icon: '❌' },
  Late:    { color: 'var(--accent-amber)',  badgeClass: 'badge-amber',  icon: '🕐' },
  Pending: { color: 'var(--accent-indigo-light)', badgeClass: 'badge-indigo', icon: '⏳' },
};

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [selectedClass, setSelectedClass] = useState('all');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentRes, classRes] = await Promise.all([
        api.get('/students'),
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

  // Build per-student attendance record for the selected date
  const attendanceRows = students
    .filter(s => {
      // Filter by class
      if (selectedClass !== 'all') {
        const cid = s.classId?._id || s.classId;
        if (cid !== selectedClass) return false;
      }
      // Filter by search
      if (search.trim()) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q);
      }
      return true;
    })
    .map(s => {
      const log = (s.attendanceLogs || []).find(l => l.date === selectedDate);
      return {
        id: s._id,
        rollNo: s.rollNo,
        name: s.name,
        className: s.classId?.className || '—',
        status: log?.status || 'Pending',
        pointsAwarded: log?.pointsAwarded ?? null,
        loggedBy: log?.loggedBy || '—',
        time: log?.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Summary counts
  const summary = {
    present: attendanceRows.filter(r => r.status === 'Present').length,
    absent:  attendanceRows.filter(r => r.status === 'Absent').length,
    late:    attendanceRows.filter(r => r.status === 'Late').length,
    pending: attendanceRows.filter(r => r.status === 'Pending').length,
  };

  // Export current view as CSV
  const exportCSV = () => {
    const header = 'Roll No,Name,Class,Status,Points Awarded,Logged By,Time\n';
    const rows = attendanceRows.map(r =>
      `"${r.rollNo}","${r.name}","${r.className}","${r.status}","${r.pointsAwarded ?? 0}","${r.loggedBy}","${r.time}"`
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}${selectedClass !== 'all' ? '_' + selectedClass : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isToday = selectedDate === todayIST();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>📋 Attendance Register</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            View attendance for any date across all classes
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportCSV}>
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters row */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Date picker */}
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
              📅 Date
            </label>
            <input
              type="date"
              className="input-field"
              value={selectedDate}
              max={todayIST()}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: '100%', colorScheme: 'dark' }}
            />
          </div>

          {/* Class filter */}
          <div style={{ flex: '1', minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
              🏫 Class
            </label>
            <select
              className="input-field"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c._id} value={c._id}>{c.className}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
              🔍 Search
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Search by name or roll no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Present', count: summary.present, color: 'var(--accent-green)', icon: '✅' },
          { label: 'Absent',  count: summary.absent,  color: 'var(--accent-red)',   icon: '❌' },
          { label: 'Late',    count: summary.late,    color: 'var(--accent-amber)', icon: '🕐' },
          { label: 'Pending', count: summary.pending, color: 'var(--accent-indigo-light)', icon: '⏳' },
        ].map(({ label, count, color, icon }) => (
          <div key={label} className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{icon}</div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{count}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Date info banner */}
      <div style={{
        padding: '0.75rem 1rem',
        borderRadius: '10px',
        marginBottom: '1rem',
        backgroundColor: isToday ? 'rgba(34, 197, 94, 0.08)' : 'rgba(99, 102, 241, 0.08)',
        border: `1px solid ${isToday ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
        fontSize: '0.9rem',
        color: isToday ? 'var(--accent-green)' : 'var(--accent-indigo-light)',
        fontWeight: 600,
      }}>
        {isToday ? '📅 Showing today\'s live attendance' : `📅 Showing attendance for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        {summary.pending > 0 && isToday && (
          <span style={{ marginLeft: '1rem', color: 'var(--accent-amber)' }}>
            ⚠️ {summary.pending} students not yet marked
          </span>
        )}
      </div>

      {/* Main table */}
      <div className="glass-card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading...</p>
        ) : attendanceRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No students found for the selected filters.</p>
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
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row, idx) => (
                  <tr key={row.id}>
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
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.loggedBy}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>
        Showing {attendanceRows.length} student{attendanceRows.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
