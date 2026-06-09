import React, { useEffect, useState } from 'react';
import api from '../api';
import { Search, Download, Plus, Trash2, X, Printer, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '../utils/toast';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  
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

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.classId?.className || s.village || '').toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClassFilter === 'all' || s.classId?._id === selectedClassFilter;
    return matchSearch && matchClass;
  });

  const PAGE_SIZE = 25;
  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 if filters change
  useEffect(() => { setCurrentPage(1); }, [search, selectedClassFilter]);

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
            <button 
              type="button"
              onClick={() => window.print()} 
              className="btn btn-secondary" 
              title="Print QR Code ID Cards"
            >
              <Printer size={16} /> Export ID Cards
            </button>
            <button 
              type="button"
              onClick={exportCSV} 
              className="btn btn-secondary"
            >
              <Download size={16} /> Export CSV
            </button>
            <button 
              type="button"
              onClick={() => setAddModalOpen(true)} 
              className="btn btn-primary"
            >
              <Plus size={16} /> Add Student
            </button>
          </div>
        </div>

      <div className="glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.5rem', display: 'flex', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <Search size={18} color="var(--text-sub)" />
          <input 
            type="text" 
            placeholder="Search by name or class…" 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '1rem' }}>
          <select 
            className="input-field" 
            style={{ width: '200px', appearance: 'none' }}
            value={selectedClassFilter}
            onChange={e => setSelectedClassFilter(e.target.value)}
          >
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c._id} value={c._id}>{c.className}</option>)}
          </select>
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
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading…</td></tr>
            ) : paginatedStudents.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No students found</td></tr>
            ) : (
              paginatedStudents.map(student => (
                <tr key={student._id}>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  <td>{student.classId?.className || student.village || 'Unassigned'}</td>
                  <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{student.points} pts</td>
                  <td>
                    <button 
                      type="button"
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
        
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem' }} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem' }} 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
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
          classes={classes}
          onClose={() => setSelectedStudentId(null)}
          onUpdate={() => { setSelectedStudentId(null); fetchData(); }}
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
                level="M" 
                includeMargin={true} 
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
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    classId: '',
    phoneNumber: '',
    altPhone: '',
    fatherName: '',
    motherName: '',
    age: '',
    gender: 'Male',
    dob: '',
    village: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/students', formData);
      toast.success('Student added successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error adding student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="glass-card" style={{ width: 600, padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
        <h2 style={{ marginBottom: '1.5rem' }}>Add New Student</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Full Name *</label>
              <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Aarav Mehta" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>QR / Roll No *</label>
              <input type="text" className="input-field" required value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="e.g. 101" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Father's Name</label>
              <input type="text" className="input-field" value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} placeholder="e.g. Rajesh Bhai" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Mother's Name</label>
              <input type="text" className="input-field" value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} placeholder="e.g. Rekha Ben" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Primary Phone</label>
              <input type="text" className="input-field" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="e.g. +91 9825..." />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Alternative Phone</label>
              <input type="text" className="input-field" value={formData.altPhone} onChange={e => setFormData({...formData, altPhone: e.target.value})} placeholder="e.g. Landline or mother's no" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Age</label>
              <input type="number" className="input-field" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="e.g. 12" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Gender</label>
              <select className="input-field" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} style={{ appearance: 'none' }}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Date of Birth</label>
              <input type="date" className="input-field" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Village / Area</label>
              <input type="text" className="input-field" value={formData.village} onChange={e => setFormData({...formData, village: e.target.value})} placeholder="e.g. Palitana" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Assign Class</label>
              <select className="input-field" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} style={{ appearance: 'none' }}>
                <option value="">Select a Class...</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.className} ({c.ageGroup})</option>)}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Saving...' : 'Add Student'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentProfileModal({ studentId, classes, onClose, onUpdate }) {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'edit'
  const [deleting, setDeleting] = useState(false);
  
  // Edit Form state
  const [editForm, setEditForm] = useState({
    name: '',
    rollNo: '',
    phoneNumber: '',
    altPhone: '',
    fatherName: '',
    motherName: '',
    age: '',
    gender: 'Male',
    dob: '',
    village: '',
    classId: ''
  });
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/students/${studentId}`);
      const data = res.data.data;
      setProfile(data);
      setEditForm({
        name: data.name || '',
        rollNo: data.rollNo || '',
        phoneNumber: data.phoneNumber || '',
        altPhone: data.altPhone || '',
        fatherName: data.fatherName || '',
        motherName: data.motherName || '',
        age: data.age || '',
        gender: data.gender || 'Male',
        dob: data.dob || '',
        village: data.village || '',
        classId: data.classId?._id || ''
      });
    } catch (err) {
      toast.error('Error fetching profile');
      onClose();
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/students/${studentId}`, editForm);
      toast.success('Student details updated successfully!');
      fetchProfile();
      onUpdate();
      setActiveTab('logs');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating student profile');
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async () => {
    if (!window.confirm(`Permanently delete ${profile.name}?\n\nThis will remove all their attendance and activity logs. This action CANNOT be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${studentId}`);
      toast.success(`${profile.name} deleted successfully.`);
      onUpdate(); // closes modal and refreshes list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting student');
      setDeleting(false);
    }
  };

  const deleteActivityLog = async (logId) => {
    if(!window.confirm('Delete this activity log? Points will be automatically subtracted.')) return;
    try {
      await api.delete(`/students/${studentId}/activity/${logId}`);
      toast.success('Log deleted');
      fetchProfile();
      onUpdate();
    } catch (err) {
      toast.error('Error deleting log');
    }
  };

  const deleteAttendanceLog = async (logId) => {
    if(!window.confirm('Delete this attendance record? Points will be automatically subtracted.')) return;
    try {
      await api.delete(`/students/${studentId}/attendance/${logId}`);
      toast.success('Record deleted');
      fetchProfile();
      onUpdate();
    } catch (err) {
      toast.error('Error deleting log');
    }
  };

  if (!profile) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="glass-card" style={{ width: 800, maxHeight: '90vh', padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
        
        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>{profile.name}</h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <span className="badge badge-indigo">{profile.classId?.className || profile.village || 'Unassigned'}</span>
              <span className="badge badge-green">Total Score: {profile.points} pts</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              Activity Logs
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`btn ${activeTab === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              Edit Details & Class Transfer
            </button>
            <button
              type="button"
              onClick={deleteStudent}
              disabled={deleting}
              className="btn btn-danger"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              title="Permanently delete this student"
            >
              <UserX size={14} /> {deleting ? 'Deleting...' : 'Delete Student'}
            </button>
          </div>
        </div>

        {activeTab === 'logs' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', overflowY: 'auto', paddingRight: '1rem', flex: 1 }}>
            
            {/* Activity Logs */}
            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-sub)' }}>Recent Activities</h3>
              {profile.activityLogs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No activity logs.</p> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {profile.activityLogs.map(log => (
                  <div key={log._id} style={{ backgroundColor: 'var(--bg-dark)', padding: '1rem', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{log.type}: {log.description}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(log.date).toLocaleDateString()} • <span style={{color: 'var(--accent-green)'}}>+{log.pointsAwarded} pts</span>
                        {log.loggedBy && <span style={{ color: 'var(--accent-indigo)', fontStyle: 'italic', marginLeft: 8 }}>by {log.loggedBy}</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => deleteActivityLog(log._id)} className="btn btn-danger" style={{ padding: '0.5rem' }} title="Delete log & Sync Points">
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
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        {new Date(log.date).toLocaleDateString()} • <span style={{color: 'var(--accent-green)'}}>+{log.pointsAwarded} pts</span>
                        {log.loggedBy && <span style={{ color: 'var(--accent-indigo)', fontStyle: 'italic', marginLeft: 8 }}>by {log.loggedBy}</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => deleteAttendanceLog(log._id)} className="btn btn-danger" style={{ padding: '0.5rem' }} title="Delete record">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '1rem', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Full Name</label>
                <input type="text" className="input-field" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>QR / Roll No</label>
                <input type="text" className="input-field" required value={editForm.rollNo} onChange={e => setEditForm({...editForm, rollNo: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Father's Name</label>
                <input type="text" className="input-field" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Mother's Name</label>
                <input type="text" className="input-field" value={editForm.motherName} onChange={e => setEditForm({...editForm, motherName: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Primary Phone</label>
                <input type="text" className="input-field" value={editForm.phoneNumber} onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Alternative Phone</label>
                <input type="text" className="input-field" value={editForm.altPhone} onChange={e => setEditForm({...editForm, altPhone: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Age</label>
                <input type="number" className="input-field" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Gender</label>
                <select className="input-field" value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} style={{ appearance: 'none' }}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Date of Birth</label>
                <input type="date" className="input-field" value={editForm.dob} onChange={e => setEditForm({...editForm, dob: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Village / Area</label>
                <input type="text" className="input-field" value={editForm.village} onChange={e => setEditForm({...editForm, village: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 600, color: 'var(--accent-indigo)' }}>Transfer Class (Class Assignment)</label>
                <select className="input-field" value={editForm.classId} onChange={e => setEditForm({...editForm, classId: e.target.value})} style={{ appearance: 'none', borderColor: 'var(--accent-indigo)', borderWidth: 1.5 }}>
                  <option value="">Select Class to Transfer...</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.className} ({c.ageGroup})</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', alignSelf: 'flex-end', padding: '0.75rem 2rem' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Student Changes & Transfer Class'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
