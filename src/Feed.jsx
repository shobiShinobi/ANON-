import React, { useState, useEffect, useRef } from 'react';
import PostForm from './PostForm.jsx'; 
import ManaBar from './ManaBar.jsx';
import PeerGraph from './PeerGraph.jsx';
import NetworkTerminal from './NetworkTerminal.jsx';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 5000;
const API_URL = `http://localhost:${BACKEND_PORT}`;
const WS_URL = `ws://localhost:${BACKEND_PORT}`;

const TrustBadge = ({ score }) => {
  let colorClass = "text-gray-400 bg-gray-700";
  let label = "NEUTRAL";
  if (score >= 0.7) { colorClass = "text-green-400 bg-green-900"; label = "VERIFIED"; } 
  else if (score < 0.3) { colorClass = "text-red-400 bg-red-900"; label = "DISPUTED"; }
  return <span className={`px-2 py-1 rounded text-[10px] font-bold ${colorClass}`}>{label} ({Number(score).toFixed(2)})</span>;
};

export default function Feed({ userId, onLogout, onDestroy }) {
  const [posts, setPosts] = useState([]);
  const [mana, setMana] = useState(100);
  const [peerCount, setPeerCount] = useState(0); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [errorMsg, setErrorMsg] = useState('');
  
  // NEW: State to hold our terminal logs
  const [logs, setLogs] = useState([`> System Boot: Node Identity ${userId} registered.`]);

  const addLog = (msg) => {
    setLogs(prev => [...prev, msg].slice(-50)); // Keep only the last 50 logs to prevent lag
  };

  const fetchPosts = () => {
    fetch(`${API_URL}/api/feed`)
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error("Fetch error:", err));
  };

  useEffect(() => {
    fetchPosts();
    fetch(`${API_URL}/api/users/${userId}/mana`).then(res => res.json()).then(data => setMana(data.mana));
      
    addLog(`> Local WebSocket bound to port ${BACKEND_PORT}`);
    const ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'NEW_NODE') {
        fetchPosts();
        addLog(`> [GOSSIP] Incoming mesh data: DAG synchronized.`);
      }
      if (data.type === 'MANA_UPDATE' && data.userId === userId) {
        setMana(data.mana);
      }
      if (data.type === 'PEER_UPDATE') {
        setPeerCount(data.count);
        addLog(`> [SYNC] Handshake complete. Active peers updated to ${data.count}.`);
      }
    };
    return () => ws.close();
  }, [userId]);

  const triggerError = (msg) => { 
    setErrorMsg(msg); 
    addLog(`> [WARN] ${msg}`);
    setTimeout(() => setErrorMsg(''), 3000); 
  };

  const handleVote = async (parentId, voteValue) => {
    try {
      const res = await fetch(`${API_URL}/api/rumors/${parentId}/votes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteValue, voterId: userId })
      });
      if (res.status === 403 || res.status === 429) { 
        const data = await res.json(); 
        triggerError(data.error); 
      } else {
        addLog(`> [TX] Vote broadcasted to mesh.`);
      }
    } catch (err) { console.error(err); }
  };

  // US6: Sort and Filter Logic
  const displayedPosts = posts
    .filter(post => (post.score ?? 0.5) >= 0.1) // Hide archived/highly disputed content
    .sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'trusted') return (b.score ?? 0) - (a.score ?? 0);
      return 0;
    });

  return (
    <div className="max-w-2xl mx-auto p-4 text-white relative">
      {errorMsg && <div className="fixed top-4 left-1/2 -translate-x-1/2 w-max max-w-sm text-center bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-40 animate-bounce">{errorMsg}</div>}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Campus Feed</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-gray-500">{userId}</span>
          <button onClick={onLogout} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">Log Out</button>
          <button onClick={onDestroy} className="text-sm font-bold text-red-400 hover:text-red-300 border border-red-900/50 px-3 py-1 rounded-lg bg-red-900/20 transition-colors">Destroy</button>
        </div>
      </div>

      <PeerGraph peerCount={peerCount} />
      <ManaBar mana={mana} />
      
      {/* NEW: Live Network Logs */}
      <NetworkTerminal logs={logs} />
      
      <div className="flex justify-between items-center mb-4 bg-gray-900 p-2 rounded-lg border border-gray-800">
        <span className="text-sm font-bold text-gray-400 pl-2">Sort Feed By:</span>
        <div className="flex gap-2">
          <button onClick={() => setSortBy('newest')} className={`px-4 py-1 text-sm font-bold rounded-md transition-colors ${sortBy === 'newest' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Newest</button>
          <button onClick={() => setSortBy('trusted')} className={`px-4 py-1 text-sm font-bold rounded-md transition-colors ${sortBy === 'trusted' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Trusted</button>
        </div>
      </div>

      <PostForm userId={userId} onError={triggerError} />
      
      <div className="space-y-4">
        {displayedPosts.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden">
            <p className="text-lg mb-3">{post.text}</p>
            <div className="flex gap-2 mb-3 pt-3 border-t border-gray-700">
              <button onClick={() => handleVote(post.id, 1)} className="bg-gray-800 hover:bg-green-900/40 text-green-400 border border-green-900/50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">+1 Verify</button>
              <button onClick={() => handleVote(post.id, -1)} className="bg-gray-800 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">-1 Dispute</button>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono pt-2">
              <span>{new Date(post.timestamp).toLocaleTimeString()}</span>
              <div className="flex items-center gap-3">
                <span>Votes: {post.totalVotes || 0}</span>
                <TrustBadge score={post.score ?? 0.5} />
              </div>
            </div>
          </div>
        ))}
        {displayedPosts.length === 0 && <p className="text-center text-gray-500 py-8 italic border border-dashed border-gray-700 rounded-xl">No content matches your filters.</p>}
      </div>
    </div>
  );
}