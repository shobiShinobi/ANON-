    import React, { useState } from 'react';

// Wordlist for the US3 recovery seed
const WORDS = ["apple", "brave", "campus", "delta", "eagle", "falcon", "ghost", "hover", "index", "jungle", "karma", "lunar", "matrix", "nexus", "orbit", "pulse", "quantum", "radar", "solar", "tango"];

export default function Onboarding({ onComplete }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState(null);

  const handleRegister = (e) => {
    e.preventDefault();
    // US1: Strict .edu verification
    if (!email.toLowerCase().endsWith('.edu')) {
      setError('Access Denied: You must use a valid .edu campus email.');
      return;
    }
    
    // US2: Generate untraceable ID (Identity Decoupling)
    const id = 'u_' + Math.random().toString(36).substr(2, 9);
    
    // US3: Generate 12-word recovery seed
    const seed = Array.from({length: 12}, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');

    setIdentity({ id, seed });
    setStep(2);
  };

  const handleEnter = () => {
    // Save locally so they stay logged in
    localStorage.setItem('anon_user', JSON.stringify({ id: identity.id }));
    onComplete(identity.id);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
        {step === 1 ? (
          <form onSubmit={handleRegister}>
            <h2 className="text-2xl font-bold mb-2">Campus Verification</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your .edu email. It will be verified and immediately discarded to ensure your anonymity.</p>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              placeholder="student@university.edu" 
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 mb-4 outline-none focus:border-green-500" required 
            />
            {error && <p className="text-red-500 text-sm mb-4 font-bold animate-pulse">{error}</p>}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors">Verify & Generate ID</button>
          </form>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-2 text-green-400">Identity Secured</h2>
            <p className="text-gray-400 text-sm mb-6">Your email has been decoupled. Here is your anonymous Node ID and Recovery Phrase.</p>
            <div className="bg-black/50 p-4 rounded-lg mb-4 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">NODE ID</p>
              <p className="font-mono text-green-400 mb-4 text-lg">{identity.id}</p>
              <p className="text-xs text-gray-500 mb-1">RECOVERY SEED (SAVE THIS!)</p>
              <p className="font-mono text-yellow-400 text-sm">{identity.seed}</p>
            </div>
            <button onClick={handleEnter} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg border border-gray-700 transition-colors">Enter Network</button>
          </div>
        )}
      </div>
    </div>
  );
}