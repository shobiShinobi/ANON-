import React, { useState, useEffect } from 'react';
import Feed from './Feed.jsx';
import Onboarding from './Onboarding.jsx';

export default function App() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('anon_user');
    if (saved) setUserId(JSON.parse(saved).id);
  }, []);

  const handleLogin = (id) => {
    localStorage.setItem('anon_user', JSON.stringify({ id }));
    setUserId(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('anon_user');
    setUserId(null); // Soft logout: keeps backend Mana intact
  };

  const handleDestroy = async () => {
    if (window.confirm("WARNING: This will permanently delete your identity and Mana from this node. Are you sure?")) {
      try {
        // Hard destroy: tell backend to wipe the user
        await fetch(`http://localhost:5000/api/users/${userId}`, { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to destroy backend identity", err);
      }
      localStorage.removeItem('anon_user');
      setUserId(null);
    }
  };

  if (!userId) return <Onboarding onComplete={handleLogin} />;
  return <Feed userId={userId} onLogout={handleLogout} onDestroy={handleDestroy} />;
}