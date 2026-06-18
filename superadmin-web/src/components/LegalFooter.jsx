import React, { useState } from 'react';

export default function LegalFooter() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{
      marginTop: 'auto',
      paddingTop: '1.5rem',
      borderTop: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '0.4rem',
      fontSize: '0.75rem',
      color: 'var(--text-muted)'
    }}>
      <p style={{ margin: 0, fontWeight: 600 }}>© 2026 Shrut Mandir. All Rights Reserved.</p>
      <p style={{ margin: 0, color: 'var(--accent-indigo)', fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>Designed & Developed by Tatvam Studios</p>
      <button 
        onClick={() => setModalOpen(true)}
        style={{ 
          background: 'none', border: 'none', color: 'var(--text-sub)', 
          textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: '0.25rem' 
        }}
      >
        Terms & Conditions
      </button>

      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.5rem' }}>Terms & Conditions</h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Close
              </button>
            </div>
            <div style={{ color: 'var(--text-sub)', lineHeight: '1.6', fontSize: '0.9rem' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1rem', marginTop: '1rem' }}>Authorized Use Only</h3>
              <p>This application is strictly for the authorized staff and teachers of Shrut Mandir. Unauthorized access, distribution, or sharing of credentials is strictly prohibited.</p>
              
              <h3 style={{ color: 'var(--text-main)', fontSize: '1rem', marginTop: '1rem' }}>Data Privacy & Confidentiality</h3>
              <p>This platform contains sensitive student information, including names, contact details, and performance metrics. By using this application, you agree to maintain strict confidentiality and not share any student data outside of authorized educational purposes.</p>
              
              <h3 style={{ color: 'var(--text-main)', fontSize: '1rem', marginTop: '1rem' }}>Intellectual Property</h3>
              <p>All designs, code, and systems associated with this platform are the intellectual property of Tatvam Studios and Shrut Mandir. Reverse engineering, copying, or unauthorized modification is forbidden.</p>
              
              <h3 style={{ color: 'var(--text-main)', fontSize: '1rem', marginTop: '1rem' }}>Usage Monitoring</h3>
              <p>Activity on this platform is logged for security and administrative purposes. Abuse of the system, including fraudulent attendance logging or point manipulation, may result in access revocation.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
