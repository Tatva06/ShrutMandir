import React, { useEffect, useState } from 'react';
import api from '../api';
import { Save, Plus, Trash2, Clock, List, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from '../utils/toast';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New class form state
  const [newClassName, setNewClassName] = useState('');
  const [newAgeGroup, setNewAgeGroup] = useState('');
  const [addingClass, setAddingClass] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, classRes] = await Promise.all([
        api.get('/settings'),
        api.get('/classes'),
      ]);
      setSettings(settingsRes.data.data);
      setClasses(classRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Error loading settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        lateCutoffTime: settings.lateCutoffTime,
        gathaList: settings.gathaList
      });
      toast.success('Settings saved successfully!');
    } catch (err) {
      toast.error('Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateGatha = (index, field, value) => {
    const updated = [...settings.gathaList];
    updated[index][field] = field === 'pts' ? Number(value) : value;
    setSettings({ ...settings, gathaList: updated });
  };

  const addGatha = () => {
    setSettings({
      ...settings,
      gathaList: [...settings.gathaList, { name: '', pts: 10 }]
    });
  };

  const removeGatha = (index) => {
    const updated = settings.gathaList.filter((_, i) => i !== index);
    setSettings({ ...settings, gathaList: updated });
  };

  // ── Class Management ──────────────────────────────────────────────────────
  const addClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newAgeGroup.trim()) {
      toast.error('Both Class Name and Age Group are required.');
      return;
    }
    setAddingClass(true);
    try {
      const res = await api.post('/classes', { className: newClassName.trim(), ageGroup: newAgeGroup.trim() });
      setClasses(prev => [...prev, res.data.data]);
      setNewClassName('');
      setNewAgeGroup('');
      toast.success(`Class "${res.data.data.className}" created!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating class.');
    } finally {
      setAddingClass(false);
    }
  };

  const deleteClass = async (classId, className) => {
    if (!window.confirm(`Delete class "${className}"?\n\nAll students in this class will become unassigned. This cannot be undone.`)) return;
    try {
      await api.delete(`/classes/${classId}`);
      setClasses(prev => prev.filter(c => c._id !== classId));
      toast.success(`Class "${className}" deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting class.');
    }
  };

  if (loading || !settings) return <div style={{ color: 'var(--text-sub)' }}>Loading Settings...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1>Global Settings</h1>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ flexShrink: 0 }}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* ── Row 1: Cutoff Time + Gatha List ── */}
        <div className="settings-top-grid">

          {/* Cutoff Time */}
          <div className="glass-card" style={{ alignSelf: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Clock size={20} color="var(--accent-amber)" />
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Attendance Rules</h2>
            </div>

            <div>
              <label
                htmlFor="lateCutoffTime"
                style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}
              >
                Late Cutoff Time (24H)
              </label>
              <input
                id="lateCutoffTime"
                type="time"
                className="input-field"
                value={settings.lateCutoffTime}
                onChange={e => setSettings({...settings, lateCutoffTime: e.target.value})}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Students marked present after this time will be flagged as Late.
              </p>
            </div>
          </div>

          {/* Gatha List Configuration */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={20} color="var(--accent-indigo)" />
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Dynamic Gatha List</h2>
              </div>
              <button
                type="button"
                onClick={addGatha}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Add Gatha
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {settings.gathaList.map((gatha, index) => (
                <div key={gatha._id || gatha.name || `new-${index}`} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ flex: 2 }}>
                    <input
                      type="text"
                      className="input-field"
                      value={gatha.name}
                      onChange={e => updateGatha(index, 'name', e.target.value)}
                      placeholder="e.g. Navkar Mantra"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      className="input-field"
                      value={gatha.pts}
                      onChange={e => updateGatha(index, 'pts', e.target.value)}
                      placeholder="Points"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGatha(index)}
                    className="btn btn-danger"
                    style={{ padding: '0.6rem' }}
                    title="Remove Gatha"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 2: Class Management ── */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <BookOpen size={20} color="var(--accent-green)" />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Class Management</h2>
          </div>

          {/* Add Class Form */}
          <form onSubmit={addClass} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '160px' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                Class Name
              </label>
              <input
                type="text"
                className="input-field"
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
                placeholder="e.g. Bal Varg"
              />
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                Age Group
              </label>
              <input
                type="text"
                className="input-field"
                value={newAgeGroup}
                onChange={e => setNewAgeGroup(e.target.value)}
                placeholder="e.g. 5-10"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.85rem 1.5rem' }}
              disabled={addingClass}
            >
              <Plus size={16} /> {addingClass ? 'Adding...' : 'Add Class'}
            </button>
          </form>

          {/* Classes Table */}
          {classes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
              No classes configured yet. Add one above.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Age Group</th>
                  <th>Students</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c.className}</td>
                    <td style={{ color: 'var(--text-sub)' }}>{c.ageGroup}</td>
                    <td>
                      <span className="badge badge-indigo">{c.studentCount ?? '—'} students</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteClass(c._id, c.className)}
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                        title="Delete class (students will be unassigned)"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{
            marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8,
            backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--accent-amber)'
          }}>
            <AlertTriangle size={14} />
            Deleting a class unassigns all its students. Student attendance history is preserved.
          </div>
        </div>

      </div>
    </div>
  );
}
