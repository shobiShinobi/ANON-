import React, { useState, useEffect } from 'react';
import ManaBar from './ManaBar.jsx';
import PeerGraph from './PeerGraph.jsx';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 5000;
const API_URL = `http://localhost:${BACKEND_PORT}`;
const WS_URL = `ws://localhost:${BACKEND_PORT}`;

export default function Profile({ userId, onLogout, onDestroy }) {
  const [mana, setMana] = useState(100);
  const [peerCount, setPeerCount] = useState(0); 
  const [trust, setTrust] = useState(1.0); 

  useEffect(() => {
    fetch(`${API_URL}/api/users/${userId}/mana`).then(res => res.json()).then(data => setMana(data.mana));
    fetch(`${API_URL}/api/users/${userId}/trust`).then(res => res.json()).then(data => setTrust(data.trust));
      
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'MANA_UPDATE' && data.userId === userId) setMana(data.mana);
      if (data.type === 'PEER_UPDATE') setPeerCount(data.count);
      if (data.type === 'NEW_NODE') {
        fetch(`${API_URL}/api/users/${userId}/trust`).then(res => res.json()).then(d => setTrust(d.trust));
      }
    };
    return () => ws.close();
  }, [userId]);

  return (
    <div className="max-w-2xl mx-auto p-4 w-full mt-4">
      <h2 className="text-3xl font-black mb-2">Node Identity</h2>
      <p className="text-gray-500 font-mono mb-8 bg-gray-900 p-3 rounded-lg border border-gray-800">{userId}</p>

      <ManaBar mana={mana} />

      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-gray-300 text-sm tracking-wider">
          <span>🛡️ GLOBAL TRUST</span>
        </div>
        <div className="font-mono text-sm font-bold px-3 py-1 rounded bg-black border border-gray-700 text-blue-400">
          {(trust).toFixed(2)} Multiplier
        </div>
      </div>
      
      <PeerGraph peerCount={peerCount} />

      <div className="mt-12 bg-red-950/20 border border-red-900/50 p-6 rounded-xl">
        <h3 className="text-red-500 font-bold mb-4">Danger Zone</h3>
        <div className="flex flex-col gap-4">
          <button onClick={onLogout} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors">Log Out (Keep Identity in Mesh)</button>
          <button onClick={onDestroy} className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 rounded-lg transition-colors border border-red-700">Destroy Identity (Nuke from Mesh)</button>
        </div>
      </div>
    </div>
  );
}