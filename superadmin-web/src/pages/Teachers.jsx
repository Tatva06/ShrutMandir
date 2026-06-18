import React, { useEffect, useState } from 'react';
import api from '../api';
import { UserPlus, Trash2, Shield, User, Key, X } from 'lucide-react';
import { toast } from '../utils/toast';

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [resetTeacher, setResetTeacher] = useState(null);

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teachers');
      setTeachers(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteTeacher = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}'s login?`)) return;
    try {
      await api.delete(`/teachers/${id}`);
      toast.success('Teacher deleted successfully');
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting teacher');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1>Teacher Logins</h1>
        <button onClick={() => setAddModalOpen(true)} className="btn btn-primary" style={{ flexShrink: 0 }}>
          <UserPlus size={16} /> Add Login
        </button>
      </div>

      {/* Desktop Table */}
      <div className="glass-card teachers-table-wrap" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No teachers found</td></tr>
            ) : (
              teachers.map(teacher => (
                <tr key={teacher._id}>
                  <td style={{ fontWeight: 600 }}>{teacher.name}</td>
                  <td style={{ color: 'var(--text-sub)' }}>@{teacher.username}</td>
                  <td>
                    {teacher.role === 'SuperAdmin' ? (
                      <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={12} /> SuperAdmin
                      </span>
                    ) : (
                      <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} /> Teacher
                      </span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setResetTeacher({ id: teacher._id, name: teacher.name })} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                      <Key size={14} /> Reset Password
                    </button>
                    <button onClick={() => deleteTeacher(teacher._id, teacher.name)} className="btn btn-danger" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="teachers-mobile-cards">
        {loading ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>
        ) : teachers.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No teachers found</div>
        ) : (
          teachers.map(teacher => (
            <div key={teacher._id} className="glass-card" style={{ marginBottom: '0.75rem', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{teacher.name}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>@{teacher.username}</p>
                </div>
                {teacher.role === 'SuperAdmin' ? (
                  <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={12} /> SuperAdmin
                  </span>
                ) : (
                  <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <User size={12} /> Teacher
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button onClick={() => setResetTeacher({ id: teacher._id, name: teacher.name })} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                  <Key size={14} /> Reset Password
                </button>
                <button onClick={() => deleteTeacher(teacher._id, teacher.name)} className="btn btn-danger" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAddModalOpen && (
        <AddTeacherModal onClose={() => setAddModalOpen(false)} onSuccess={() => { setAddModalOpen(false); fetchTeachers(); }} />
      )}
      {resetTeacher && (
        <ResetPasswordModal teacher={resetTeacher} onClose={() => setResetTeacher(null)} />
      )}
    </div>
  );
}

function ResetPasswordModal({ teacher, onClose }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/teachers/${teacher.id}/reset-password`, { newPassword: password });
      toast.success(`Password reset for ${teacher.name}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="glass-card modal-sheet" style={{ maxWidth: 420, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22}/></button>
        <h2 style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>Reset Password</h2>
        <p style={{ color: 'var(--text-sub)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Resetting password for <strong>{teacher.name}</strong>
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>New Password</label>
            <input type="text" className="input-field" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" minLength={4} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddTeacherModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'Teacher' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/teachers', formData);
      toast.success('Teacher created successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error adding teacher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="glass-card modal-sheet" style={{ maxWidth: 480, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22}/></button>
        <h2 style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>Create Teacher Login</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Full Name</label>
            <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Rahul Jain" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Username</label>
            <input type="text" className="input-field" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="e.g. rahul_jain" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Temporary Password</label>
            <input type="text" className="input-field" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="e.g. patshala123" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Role</label>
            <select className="input-field" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ appearance: 'none' }}>
              <option value="Teacher">Standard Teacher</option>
              <option value="SuperAdmin">SuperAdmin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
