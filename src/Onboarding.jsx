import React, { useState } from 'react';
import { register, login } from './api.js';
import { generateSeed } from './seed.js';

export default function Onboarding({ onAuthed }) {
  const [mode, setMode] = useState('signup');
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginSeed, setLoginSeed] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [regData, setRegData] = useState(null);
  const [copied, setCopied] = useState(false);

  const eduRegex = /\.edu(\.[a-z]{2})?$/i;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!eduRegex.test(email.trim())) {
      setError('Access denied: a valid .edu campus email is required.');
      return;
    }
    setBusy(true);
    const seed = generateSeed();
    try {
      const data = await register({ email, seed, displayName: displayName.trim() || undefined });
      setIdentity({ id: data.id, seed });
      setRegData(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^u_[a-z0-9]{6,32}$/i.test(loginId.trim())) {
      setError('Invalid Node ID. It should look like "u_xxxxxxxx".');
      return;
    }
    if (loginSeed.trim().split(/\s+/).length !== 12) {
      setError('Invalid seed phrase. It must be exactly 12 words.');
      return;
    }
    setBusy(true);
    try {
      const data = await login({ id: loginId.trim(), seed: loginSeed.trim() });
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(`${identity.id}\n${identity.seed}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="min-h-screen mesh-grid bg-[#050505] flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black tracking-tight text-green-500">ANON</h1>
          <p className="text-gray-500 text-sm font-mono mt-1">anonymous campus rumor mesh</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur p-8 rounded-2xl border border-gray-800 shadow-2xl animate-fade-in">
          {step === 1 && (
            <div className="flex mb-6 bg-black/50 p-1 rounded-lg">
              <Tab active={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>
                Sign Up
              </Tab>
              <Tab active={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>
                Log In
              </Tab>
            </div>
          )}

          {mode === 'signup' && step === 1 && (
            <form onSubmit={handleRegister}>
              <h2 className="text-2xl font-bold mb-2">Campus verification</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your <span className="text-green-400 font-mono">.edu</span> email. It is hashed in your browser
                and only the hash is checked — we never store or even receive your address.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-3 outline-none focus:border-green-500 transition-colors"
                required
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name (optional, can change later)"
                maxLength={32}
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500 transition-colors"
              />
              {error && <p className="text-red-400 text-sm mb-4 font-bold">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
              >
                {busy ? 'Generating identity…' : 'Verify & Generate Identity'}
              </button>
            </form>
          )}

          {mode === 'login' && step === 1 && (
            <form onSubmit={handleLogin}>
              <h2 className="text-2xl font-bold mb-2">Recover identity</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your Node ID and 12-word seed phrase to sync back in.</p>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Node ID (u_xxxxxxxx)"
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-3 outline-none focus:border-green-500 font-mono text-sm transition-colors"
                required
              />
              <textarea
                value={loginSeed}
                onChange={(e) => setLoginSeed(e.target.value)}
                placeholder="your twelve word recovery seed phrase goes right here…"
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500 font-mono text-sm resize-none h-24 transition-colors"
                required
              />
              {error && <p className="text-red-400 text-sm mb-4 font-bold">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
              >
                {busy ? 'Synchronizing…' : 'Synchronize Identity'}
              </button>
            </form>
          )}

          {step === 2 && identity && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold mb-2 text-green-400">Identity secured</h2>
              <p className="text-gray-400 text-sm mb-6">
                Save your Node ID and seed phrase.{' '}
                <strong className="text-red-400">If you lose these, your account is gone forever</strong> — there is no
                password reset on an anonymous mesh.
              </p>
              <div className="bg-black/50 p-4 rounded-lg mb-4 border border-gray-700">
                <p className="text-xs text-gray-500 mb-1 font-bold">NODE ID (PUBLIC)</p>
                <p className="font-mono text-green-400 mb-4 text-lg select-all break-all">{identity.id}</p>
                <p className="text-xs text-gray-500 mb-1 font-bold">RECOVERY SEED (SECRET)</p>
                <p className="font-mono text-yellow-400 text-sm select-all leading-relaxed">{identity.seed}</p>
              </div>
              <button
                onClick={copySeed}
                className="w-full mb-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-2.5 rounded-lg border border-gray-700 transition-colors text-sm"
              >
                {copied ? '✓ Copied to clipboard' : 'Copy ID + Seed'}
              </button>
              <button
                onClick={() => regData && onAuthed(regData)}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
              >
                I&apos;ve saved it — Enter the Mesh
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-6 font-mono">
          No email stored · No tracking · Identity key held only on your device
        </p>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${
        active ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
