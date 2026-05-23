import React, { useEffect, useState } from 'react';
import api from '../api';
import { Users, BookOpen, Clock, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalStudents: 0, classesCount: 0 });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to check if a date string is "today"
  const isToday = (dateStr) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return dateStr.startsWith(today);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [studentRes, classRes] = await Promise.all([
        api.get('/students'),
        api.get('/classes')
      ]);
      
      setStudents(studentRes.data.data);
      setStats({
        totalStudents: studentRes.data.count,
        classesCount: classRes.data.count
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute Today's Master Attendance
  const todaysAttendance = students.map(student => {
    const todayLog = student.attendanceLogs?.find(log => isToday(log.date));
    return {
      id: student._id,
      name: student.name,
      className: student.classId?.className || student.village || 'Unassigned',
      status: todayLog ? todayLog.status : 'Pending',
      logId: todayLog ? todayLog._id : null
    };
  });

  const presentCount = todaysAttendance.filter(s => s.status === 'Present').length;
  const absentCount = todaysAttendance.filter(s => s.status === 'Absent').length;
  const lateCount = todaysAttendance.filter(s => s.status === 'Late').length;
  const pendingCount = todaysAttendance.filter(s => s.status === 'Pending').length;

  // Compute Today's Activity Feed
  const todaysActivities = [];
  students.forEach(student => {
    const logs = student.activityLogs?.filter(log => isToday(log.date)) || [];
    logs.forEach(log => {
      todaysActivities.push({
        studentName: student.name,
        className: student.classId?.className || student.village,
        type: log.type,
        description: log.description,
        points: log.pointsAwarded,
        time: new Date(log.loggedAt || log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
  });

  if (loading) {
    return <div style={{ color: 'var(--text-sub)' }}>Loading Dashboard...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Daily Master Review</h1>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Students</h3>
            <Users size={20} color="var(--accent-indigo)" />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{stats.totalStudents}</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Today Present</h3>
            <Activity size={20} color="var(--accent-green)" />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent-green)' }}>
            {presentCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {stats.totalStudents}</span>
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Today Absent</h3>
            <Activity size={20} color="var(--accent-red)" />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent-red)' }}>{absentCount}</p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pending</h3>
            <Clock size={20} color="var(--accent-amber)" />
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent-amber)' }}>{pendingCount}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Today's Master Attendance Table */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Today's Master Attendance</h2>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todaysAttendance.map(student => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.className}</td>
                    <td>
                      <span className={`badge ${
                        student.status === 'Present' ? 'badge-green' : 
                        student.status === 'Absent' ? 'badge-red' : 
                        student.status === 'Late' ? 'badge-amber' : 
                        'badge-indigo'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's Activity Feed */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Live Activity Feed</h2>
          {todaysActivities.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activities logged today yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {todaysActivities.reverse().map((act, idx) => (
                <div key={idx} style={{ padding: '1rem', backgroundColor: 'var(--bg-dark)', borderRadius: '10px', borderLeft: '3px solid var(--accent-indigo)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{act.time}</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>+{act.points} pts</span>
                  </div>
                  <p style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}><strong>{act.studentName}</strong> ({act.className})</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{act.type}: {act.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
