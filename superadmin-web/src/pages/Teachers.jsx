import React, { useEffect, useState } from 'react';
import api from '../api';
import { UserPlus, Trash2, Shield, User } from 'lucide-react';

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

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
      fetchTeachers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting teacher');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Teacher Logins</h1>
        <button onClick={() => setAddModalOpen(true)} className="btn btn-primary">
          <UserPlus size={16} /> Add Login
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
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
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No teachers found</td></tr>
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
                  <td>
                    <button 
                      onClick={() => deleteTeacher(teacher._id, teacher.name)}
                      className="btn btn-danger" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <AddTeacherModal 
          onClose={() => setAddModalOpen(false)} 
          onSuccess={() => { setAddModalOpen(false); fetchTeachers(); }} 
        />
      )}
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddTeacherModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'Teacher' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/teachers', formData);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding teacher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="glass-card" style={{ width: 450, padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        <h2 style={{ marginBottom: '1.5rem' }}>Create Teacher Login</h2>
        
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
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
