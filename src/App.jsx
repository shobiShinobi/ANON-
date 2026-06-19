import React, { useState, useEffect, useCallback } from 'react';
import Feed from './Feed.jsx';
import Profile from './Profile.jsx';
import Onboarding from './Onboarding.jsx';
import { Avatar, Toast } from './ui.jsx';
import { silentLogin, getMe, clearIdentity, destroyIdentity, loadIdentity } from './api.js';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState(null); // public profile + mana
  const [page, setPage] = useState('feed');
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'error') => setToast({ message, type }), []);

  // Try to resume a session from the locally-held seed on load.
  useEffect(() => {
    (async () => {
      if (loadIdentity()) {
        const ok = await silentLogin();
        if (ok) {
          try {
            setMe(await getMe());
          } catch {
            clearIdentity();
          }
        }
      }
      setBooting(false);
    })();
  }, []);

  const handleAuthed = (data) => {
    setMe({ ...data.user, mana: data.mana });
    setPage('feed');
  };

  const handleLogout = () => {
    clearIdentity();
    setMe(null);
  };

  const handleDestroy = async () => {
    if (
      !window.confirm(
        'WARNING: This permanently erases your identity and all of your posts/votes from the server. This cannot be undone. Continue?'
      )
    )
      return;
    try {
      await destroyIdentity();
    } catch (e) {
      notify(e.message);
    }
    clearIdentity();
    setMe(null);
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-green-500 font-mono animate-pulse">
        Connecting to the mesh…
      </div>
    );
  }

  if (!me) return <Onboarding onAuthed={handleAuthed} />;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <nav className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
            <h1 className="text-lg font-black tracking-tight text-green-500">
              ANON<span className="text-gray-500 font-mono text-xs ml-1">/mesh</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NavBtn active={page === 'feed'} onClick={() => setPage('feed')}>
              Feed
            </NavBtn>
            <NavBtn active={page === 'profile'} onClick={() => setPage('profile')}>
              Profile
            </NavBtn>
            <button onClick={() => setPage('profile')} className="ml-1" title={me.displayName}>
              <Avatar emoji={me.avatarEmoji} color={me.avatarColor} size={32} />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {page === 'feed' ? (
          <Feed me={me} setMe={setMe} notify={notify} />
        ) : (
          <Profile me={me} setMe={setMe} notify={notify} onLogout={handleLogout} onDestroy={handleDestroy} />
        )}
      </main>

      <footer className="text-center text-[11px] text-gray-600 font-mono py-4 border-t border-gray-900">
        ANON MESH · anonymous campus rumor network · your identity lives on this device
      </footer>
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
        active ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
