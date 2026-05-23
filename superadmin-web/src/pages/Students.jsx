import React, { useEffect, useState } from 'react';
import api from '../api';
import { Search, Download, Plus, Trash2, X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null); // Triggers Profile Modal

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [studentRes, classRes] = await Promise.all([
        api.get('/students'),
        api.get('/classes')
      ]);
      setStudents(studentRes.data.data);
      setClasses(classRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.classId?.className || s.village || '').toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    if (students.length === 0) return;
    const header = "Name,Village/Class,Points\n";
    const rows = students.map(s => `"${s.name}","${s.classId?.className || s.village || ''}",${s.points}`);
    const csvContent = "data:text/csv;charset=utf-8," + header + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `students_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Student Management</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => window.print()} className="btn btn-secondary" title="Print QR Code ID Cards">
              <Printer size={16} /> Export ID Cards
            </button>
            <button onClick={exportCSV} className="btn btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <button onClick={() => setAddModalOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Add Student
            </button>
          </div>
        </div>

      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={18} color="var(--text-sub)" />
          <input 
            type="text" 
            placeholder="Search by name or class..." 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class / Village</th>
              <th>Total Points</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No students found</td></tr>
            ) : (
              filteredStudents.map(student => (
                <tr key={student._id}>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  <td>{student.classId?.className || student.village || 'Unassigned'}</td>
                  <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{student.points} pts</td>
                  <td>
                    <button 
                      onClick={() => setSelectedStudentId(student._id)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                    >
                      View Logs
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <AddStudentModal 
          classes={classes} 
          onClose={() => setAddModalOpen(false)} 
          onSuccess={() => { setAddModalOpen(false); fetchData(); }} 
        />
      )}

      {selectedStudentId && (
        <StudentProfileModal 
          studentId={selectedStudentId} 
          onClose={() => setSelectedStudentId(null)}
          onUpdate={fetchData}
        />
      )}
      </div>

      {/* ── Hidden Print Area for ID Cards ── */}
      <div className="print-only">
        <div className="id-card-grid">
          {students.map((student) => (
            <div key={student._id} className="id-card">
              <QRCodeSVG 
                value={student.rollNo} 
                size={120} 
                level="H" 
                includeMargin={false} 
              />
              <h3>{student.name}</h3>
              <p>{student.classId?.className || student.village || 'ShrutMandir Patshala'}</p>
              <p style={{ marginTop: '4px', fontSize: '10px', color: '#888' }}>ID: {student.rollNo}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddStudentModal({ classes, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', rollNo: '', classId: '', phoneNumber: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/students', formData);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="glass-card" style={{ width: 450, padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
        <h2 style={{ marginBottom: '1.5rem' }}>Add New Student</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Full Name</label>
            <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>QR / Roll No</label>
            <input type="text" className="input-field" required value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="e.g. 101" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Assign Class</label>
            <select className="input-field" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} style={{ appearance: 'none' }}>
              <option value="">Select a Class...</option>
              {classes.map(c => <option key={c._id} value={c._id}>{c.className} ({c.ageGroup})</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Saving...' : 'Add Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentProfileModal({ studentId, onClose, onUpdate }) {
  const [profile, setProfile] = useState(null);
  
  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    try {
      // Fetches paginated logs
      const res = await api.get(`/students/${studentId}`);
      setProfile(res.data.data);
    } catch (err) {
      alert('Error fetching profile');
      onClose();
    }
  };

  const deleteActivityLog = async (logId) => {
    if(!window.confirm('Delete this activity log? Points will be automatically subtracted.')) return;
    try {
      await api.delete(`/students/${studentId}/activity/${logId}`);
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert('Error deleting log');
    }
  };

  const deleteAttendanceLog = async (logId) => {
    if(!window.confirm('Delete this attendance record? Points will be automatically subtracted.')) return;
    try {
      await api.delete(`/students/${studentId}/attendance/${logId}`);
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert('Error deleting log');
    }
  };

  if (!profile) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="glass-card" style={{ width: 800, maxHeight: '90vh', padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
        
        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{profile.name}</h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <span className="badge badge-indigo">{profile.classId?.className || profile.village}</span>
            <span className="badge badge-green">Total Score: {profile.points} pts</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', overflowY: 'auto', paddingRight: '1rem' }}>
          
          {/* Activity Logs */}
          <div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-sub)' }}>Recent Activities</h3>
            {profile.activityLogs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activity logs.</p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {profile.activityLogs.map(log => (
                <div key={log._id} style={{ backgroundColor: 'var(--bg-dark)', padding: '1rem', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{log.type}: {log.description}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()} • <span style={{color: 'var(--accent-green)'}}>+{log.pointsAwarded} pts</span></p>
                  </div>
                  <button onClick={() => deleteActivityLog(log._id)} className="btn btn-danger" style={{ padding: '0.5rem' }} title="Delete log & Sync Points">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance Logs */}
          <div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-sub)' }}>Recent Attendance</h3>
            {profile.attendanceLogs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No attendance logs.</p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {profile.attendanceLogs.map(log => (
                <div key={log._id} style={{ backgroundColor: 'var(--bg-dark)', padding: '1rem', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className={`badge ${log.status === 'Present' ? 'badge-green' : log.status === 'Late' ? 'badge-amber' : 'badge-red'}`}>
                      {log.status}
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{new Date(log.date).toLocaleDateString()} • <span style={{color: 'var(--accent-green)'}}>+{log.pointsAwarded} pts</span></p>
                  </div>
                  <button onClick={() => deleteAttendanceLog(log._id)} className="btn btn-danger" style={{ padding: '0.5rem' }} title="Delete record">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
