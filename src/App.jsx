import React, { useState, useEffect } from 'react';
import Feed from './Feed.jsx';
import Onboarding from './Onboarding.jsx';

export default function App() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('anon_user');
    if (saved) setUserId(JSON.parse(saved).id);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('anon_user');
    setUserId(null);
  };

  if (!userId) return <Onboarding onComplete={setUserId} />;
  return <Feed userId={userId} onLogout={handleLogout} />;
}