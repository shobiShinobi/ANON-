import React, { useState } from 'react';

const WORDS = ["apple", "brave", "campus", "delta", "eagle", "falcon", "ghost", "hover", "index", "jungle", "karma", "lunar", "matrix", "nexus", "orbit", "pulse", "quantum", "radar", "solar", "tango"];

export default function Onboarding({ onComplete }) {
  const [mode, setMode] = useState('signup'); 
  const [email, setEmail] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginSeed, setLoginSeed] = useState(''); // NEW: Track seed phrase for login
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState(null);

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    
    const eduRegex = /\.edu(\.[a-z]{2})?$/i;
    
    if (!eduRegex.test(email.trim())) {
      setError('Access Denied: Must be a valid .edu campus email (e.g., .edu or .edu.pk).');
      return;
    }
    
    const id = 'u_' + Math.random().toString(36).substr(2, 9);
    const seed = Array.from({length: 12}, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');

    setIdentity({ id, seed });
    setStep(2);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    
    // Validate Node ID format
    if (!loginId.trim().startsWith('u_')) {
      setError('Invalid Node ID. It should start with "u_".');
      return;
    }

    // Validate Seed Phrase format (must be 12 words)
    const seedWords = loginSeed.trim().split(/\s+/);
    if (seedWords.length !== 12) {
      setError(`Invalid Seed Phrase. It must be exactly 12 words (you entered ${seedWords.length}).`);
      return;
    }

    // Since we don't have a DB yet, if they pass the frontend validation, let them in!
    onComplete(loginId.trim()); 
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
        
        {step === 1 && (
          <div className="flex mb-6 bg-black/50 p-1 rounded-lg">
            <button onClick={() => { setMode('signup'); setError(''); }} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${mode === 'signup' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}>Sign Up</button>
            <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${mode === 'login' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}>Log In</button>
          </div>
        )}

        {mode === 'signup' && step === 1 && (
          <form onSubmit={handleRegister}>
            <h2 className="text-2xl font-bold mb-2">Campus Verification</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your .edu email. It will be verified and discarded for anonymity.</p>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              placeholder="student@university.edu.pk" 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500" required 
            />
            {error && <p className="text-red-500 text-sm mb-4 font-bold">{error}</p>}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors">Verify & Generate ID</button>
          </form>
        )}

        {mode === 'login' && step === 1 && (
          <form onSubmit={handleLogin}>
            <h2 className="text-2xl font-bold mb-2">Node Recovery</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your Node ID and 12-word seed phrase to recover your Mana.</p>
            
            {/* NEW: ID Input */}
            <input 
              type="text" value={loginId} onChange={e => setLoginId(e.target.value)} 
              placeholder="Node ID (e.g., u_xxxxxxxx)" 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-3 outline-none focus:border-green-500 font-mono text-sm" required 
            />
            
            {/* NEW: Seed Phrase Input */}
            <textarea 
              value={loginSeed} onChange={e => setLoginSeed(e.target.value)} 
              placeholder="Enter your 12-word recovery seed phrase..." 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500 font-mono text-sm resize-none h-24" required 
            />

            {error && <p className="text-red-500 text-sm mb-4 font-bold">{error}</p>}
            <button type="submit" className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-3 rounded-lg transition-colors">Recover Identity</button>
          </form>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-2 text-green-400">Identity Secured</h2>
            <p className="text-gray-400 text-sm mb-6">Copy your Node ID and Seed Phrase below. You will need them to log back in!</p>
            <div className="bg-black/50 p-4 rounded-lg mb-4 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">NODE ID</p>
              <p className="font-mono text-green-400 mb-4 text-lg">{identity.id}</p>
              <p className="text-xs text-gray-500 mb-1">RECOVERY SEED</p>
              <p className="font-mono text-yellow-400 text-sm select-all">{identity.seed}</p>
            </div>
            <button onClick={() => onComplete(identity.id)} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg border border-gray-700 transition-colors">Enter Network</button>
          </div>
        )}
      </div>
    </div>
  );
}