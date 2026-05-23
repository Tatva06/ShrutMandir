import React, { useEffect, useState } from 'react';
import api from '../api';
import { Save, Plus, Trash2, Clock, List } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data);
    } catch (err) {
      console.error(err);
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
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Error saving settings.');
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

  if (loading || !settings) return <div style={{ color: 'var(--text-sub)' }}>Loading Settings...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Global Settings</h1>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Cutoff Time */}
        <div className="glass-card" style={{ alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Clock size={20} color="var(--accent-amber)" />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Attendance Rules</h2>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>Late Cutoff Time (24H)</label>
            <input 
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
            <button onClick={addGatha} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
              <Plus size={14} /> Add Gatha
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {settings.gathaList.map((gatha, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                <button onClick={() => removeGatha(index)} className="btn btn-danger" style={{ padding: '0.6rem' }} title="Remove Gatha">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
}
