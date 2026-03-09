import React, { useState, useEffect } from 'react';
import PostForm from './PostForm.jsx'; 

const TrustBadge = ({ score }) => {
  let colorClass = "text-gray-400 bg-gray-700";
  let label = "NEUTRAL";

  if (score > 0.7) {
    colorClass = "text-green-400 bg-green-900";
    label = "VERIFIED";
  } else if (score < 0.3) {
    colorClass = "text-red-400 bg-red-900";
    label = "DISPUTED";
  }

  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold ${colorClass}`}>
      {label} ({Number(score).toFixed(2)})
    </span>
  );
};

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [userId] = useState(() => Math.floor(Math.random() * 1000).toString());
  
  // NEW: State for Easter Egg and Error Messages
  const [flash67, setFlash67] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPosts = () => {
    fetch('http://localhost:5000/api/feed')
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error("Fetch error:", err));
  };

  useEffect(() => {
    fetchPosts();
      
    const ws = new WebSocket('ws://localhost:5000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_NODE' || data.type === 'NEW_VOTE') {
        fetchPosts();
      }
    };
    return () => ws.close();
  }, []);

  // NEW: Easter Egg Trigger
  useEffect(() => {
    // If any post hits exactly 67 votes OR a score of 0.67 (67%)
    const has67 = posts.some(p => p.totalVotes === 67 || Number(p.score).toFixed(2) === "0.67");
    
    if (has67 && !flash67) {
      setFlash67(true);
      // Hide it after 2 seconds
      const timer = setTimeout(() => setFlash67(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [posts]);

  const handleVote = async (parentId, voteValue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/rumors/${parentId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteValue, voterId: userId, reputationMock: 0.5 })
      });

      // NEW: Catch the Anti-Spam Rate Limit
      if (res.status === 429) {
        const data = await res.json();
        setErrorMsg(data.error);
        // Clear error after 3 seconds
        setTimeout(() => setErrorMsg(''), 3000);
      }
    } catch (err) {
      console.error("Vote error:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 text-white relative">
      {/* NEW: 67 Easter Egg Overlay */}
      {flash67 && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <h1 className="text-[25rem] font-black text-green-500 animate-ping opacity-80 mix-blend-screen drop-shadow-2xl">
            67
          </h1>
        </div>
      )}

      {/* NEW: Rate Limit Error Toast */}
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-40 animate-bounce">
          {errorMsg}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">Campus Feed (User: {userId})</h1>
      <PostForm userId={userId} />
      
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden">
            <p className="text-lg mb-3">{post.text}</p>
            
            <div className="flex gap-2 mb-3 pt-3 border-t border-gray-700">
              <button 
                onClick={() => handleVote(post.id, 1)}
                className="bg-gray-800 hover:bg-green-900/40 text-green-400 border border-green-900/50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                +1 Verify
              </button>
              <button 
                onClick={() => handleVote(post.id, -1)}
                className="bg-gray-800 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                -1 Dispute
              </button>
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
      </div>
    </div>
  );
}