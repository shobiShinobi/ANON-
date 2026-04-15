import React, { useState, useEffect } from 'react';
import Feed from './Feed.jsx';
import Profile from './Profile.jsx';
import Onboarding from './Onboarding.jsx';

export default function App() {
  const [userId, setUserId] = useState(null);
  const [page, setPage] = useState('feed'); // 'feed' or 'profile'

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
    setUserId(null);
  };

  const handleDestroy = async () => {
    if (window.confirm("WARNING: This permanently wipes your identity and posts from the ENTIRE MESH NETWORK. Are you sure?")) {
      try {
        const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 5000;
        await fetch(`http://localhost:${BACKEND_PORT}/api/users/${userId}`, { method: 'DELETE' });
      } catch (err) { console.error("Mesh wipe failed", err); }
      localStorage.removeItem('anon_user');
      setUserId(null);
    }
  };

  if (!userId) return <Onboarding onComplete={handleLogin} />;
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Universal Navigation */}
      <nav className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-bold text-green-500">ANON MESH</h1>
        <div className="flex gap-4">
          <button onClick={() => setPage('feed')} className={`font-bold transition-colors ${page === 'feed' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Feed</button>
          <button onClick={() => setPage('profile')} className={`font-bold transition-colors ${page === 'profile' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Profile</button>
        </div>
      </nav>

      {/* Page Routing */}
      {page === 'feed' ? <Feed userId={userId} /> : <Profile userId={userId} onLogout={handleLogout} onDestroy={handleDestroy} />}
    </div>
  );
}