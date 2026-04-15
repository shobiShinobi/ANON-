import React, { useState } from 'react';

// Wordlist for generating the 12-word recovery seed
const WORDS = ["apple", "brave", "campus", "delta", "eagle", "falcon", "ghost", "hover", "index", "jungle", "karma", "lunar", "matrix", "nexus", "orbit", "pulse", "quantum", "radar", "solar", "tango"];

// Dynamic routing to match whichever port the Node Launcher assigned to the backend
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 5000;
const API_URL = `http://localhost:${BACKEND_PORT}`;

export default function Onboarding({ onComplete }) {
  const [mode, setMode] = useState('signup'); // 'signup' or 'login'
  const [email, setEmail] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginSeed, setLoginSeed] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    // Strict Regex to allow .edu, .edu.pk, .edu.uk, etc.
    const eduRegex = /\.edu(\.[a-z]{2})?$/i;
    
    if (!eduRegex.test(email.trim())) {
      setError('Access Denied: Must be a valid .edu campus email (e.g., .edu or .edu.pk).');
      return;
    }
    
    // Generate Identity
    const id = 'u_' + Math.random().toString(36).substr(2, 9);
    const seed = Array.from({length: 12}, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');

    try {
      // Register globally to the mesh DB
      await fetch(`${API_URL}/api/users/register`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, seed })
      });
      
      setIdentity({ id, seed });
      setStep(2);
    } catch (err) { 
      setError("Mesh network error: Could not reach local database."); 
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    // Frontend Validation
    if (!loginId.trim().startsWith('u_')) {
      setError('Invalid Node ID. It should start with "u_".');
      return;
    }

    const seedWords = loginSeed.trim().split(/\s+/);
    if (seedWords.length !== 12) {
      setError(`Invalid Seed Phrase. It must be exactly 12 words (you entered ${seedWords.length}).`);
      return;
    }

    try {
      // Verify globally across the mesh DB
      const res = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: loginId.trim(), seed: loginSeed.trim() })
      });
      
      if (res.status === 401) {
        setError('Identity not found on this mesh node. Are you connected to peers?');
        return;
      }
      
      // If successful, log them into the feed
      onComplete(loginId.trim()); 
    } catch (err) { 
      setError("Mesh network error: Could not reach local database."); 
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
        
        {/* Mode Toggle */}
        {step === 1 && (
          <div className="flex mb-6 bg-black/50 p-1 rounded-lg">
            <button 
              onClick={() => { setMode('signup'); setError(''); }} 
              className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${mode === 'signup' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
            >
              Sign Up
            </button>
            <button 
              onClick={() => { setMode('login'); setError(''); }} 
              className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${mode === 'login' ? 'bg-gray-800 text-white shadow-md border border-gray-700' : 'text-gray-500 hover:text-white'}`}
            >
              Log In
            </button>
          </div>
        )}

        {/* SIGN UP FORM */}
        {mode === 'signup' && step === 1 && (
          <form onSubmit={handleRegister}>
            <h2 className="text-2xl font-bold mb-2">Campus Verification</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your .edu email. It will be mathematically verified and immediately discarded to ensure total anonymity.</p>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="student@university.edu.pk" 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500 transition-colors" 
              required 
            />
            {error && <p className="text-red-500 text-sm mb-4 font-bold animate-pulse">{error}</p>}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
              Verify & Generate ID
            </button>
          </form>
        )}

        {/* LOG IN FORM */}
        {mode === 'login' && step === 1 && (
          <form onSubmit={handleLogin}>
            <h2 className="text-2xl font-bold mb-2">Node Recovery</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your Node ID and 12-word seed phrase to synchronize your reputation with the mesh.</p>
            
            <input 
              type="text" 
              value={loginId} 
              onChange={e => setLoginId(e.target.value)} 
              placeholder="Node ID (e.g., u_xxxxxxxx)" 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-3 outline-none focus:border-green-500 font-mono text-sm transition-colors" 
              required 
            />
            
            <textarea 
              value={loginSeed} 
              onChange={e => setLoginSeed(e.target.value)} 
              placeholder="Enter your 12-word recovery seed phrase..." 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500 font-mono text-sm resize-none h-24 transition-colors" 
              required 
            />

            {error && <p className="text-red-500 text-sm mb-4 font-bold animate-pulse">{error}</p>}
            <button type="submit" className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
              Synchronize Identity
            </button>
          </form>
        )}

        {/* STEP 2: SECURE CREDENTIALS (Only shown after successful signup) */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-2 text-green-400">Identity Secured</h2>
            <p className="text-gray-400 text-sm mb-6">Your email is permanently decoupled. Copy your Node ID and Seed Phrase below. <strong className="text-red-400">If you lose these, you lose your account forever.</strong></p>
            
            <div className="bg-black/50 p-4 rounded-lg mb-4 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1 font-bold">NODE ID (PUBLIC)</p>
              <p className="font-mono text-green-400 mb-4 text-lg select-all">{identity.id}</p>
              
              <p className="text-xs text-gray-500 mb-1 font-bold">RECOVERY SEED (SECRET)</p>
              <p className="font-mono text-yellow-400 text-sm select-all leading-relaxed">{identity.seed}</p>
            </div>
            
            <button 
              onClick={() => onComplete(identity.id)} 
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg border border-gray-700 transition-colors shadow-lg mt-2"
            >
              Enter the Mesh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}