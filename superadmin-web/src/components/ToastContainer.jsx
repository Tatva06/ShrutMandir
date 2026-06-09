import React, { useEffect, useState } from 'react';
import { toastManager } from '../utils/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((message, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      
      // Auto dismiss
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      zIndex: 9999,
    }}>
      {toasts.map(t => (
        <div 
          key={t.id} 
          className="toast"
          style={{
            background: t.type === 'error' ? 'var(--accent-red)' : 
                        t.type === 'info' ? 'var(--accent-indigo)' : 
                        'var(--accent-green)',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
