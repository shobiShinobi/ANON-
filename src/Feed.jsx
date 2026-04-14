import React, { useState, useEffect, useRef } from 'react';
import PostForm from './PostForm.jsx'; 
import ManaBar from './ManaBar.jsx';

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

export default function Feed({ userId, onLogout, onDestroy }) {
  const [posts, setPosts] = useState([]);
  const [mana, setMana] = useState(100);
  const [flash67, setFlash67] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hasFlashedEver = useRef(false);
  const prevPosts = useRef([]);

  const fetchPosts = () => {
    fetch('http://localhost:5000/api/feed')
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error("Fetch error:", err));
  };

  useEffect(() => {
    fetchPosts();
    
    fetch(`http://localhost:5000/api/users/${userId}/mana`)
      .then(res => res.json())
      .then(data => setMana(data.mana))
      .catch(err => console.error(err));
      
    const ws = new WebSocket('ws://localhost:5000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_NODE' || data.type === 'NEW_VOTE') {
        fetchPosts();
      }
      
      if (data.type === 'MANA_UPDATE' && data.userId === userId) {
        setMana(data.mana);
      }
    };
    return () => ws.close();
  }, [userId]);

  // FIXED: Bulletproof Easter Egg Logic
  useEffect(() => {
    // 1. If it has already flashed this session, instantly abort.
    if (hasFlashedEver.current) {
      prevPosts.current = posts;
      return;
    }
    
    // 2. Ignore the initial data load.
    if (prevPosts.current.length === 0 && posts.length > 0) {
      prevPosts.current = posts;
      return;
    }

    // 3. Find if any post *just now* transitioned to exactly 67
    const newlyHit67 = posts.some(currentPost => {
      const isCurrently67 = currentPost.totalVotes === 67 || Number(currentPost.score).toFixed(2) === "0.67";
      if (!isCurrently67) return false; 
      
      const prevPost = prevPosts.current.find(p => p.id === currentPost.id);
      const wasPreviously67 = prevPost ? (prevPost.totalVotes === 67 || Number(prevPost.score).toFixed(2) === "0.67") : false;
      
      return !wasPreviously67;
    });

    // 4. Trigger the flash and lock it forever
    if (newlyHit67) {
      setFlash67(true);
      hasFlashedEver.current = true; // Lock it immediately
      
      // We removed the clearTimeout return here to prevent React 
      // Strict Mode from accidentally cancelling the turn-off timer.
      setTimeout(() => {
        setFlash67(false);
      }, 2000);
    }
    
    // 5. Save current state for the next render comparison
    prevPosts.current = posts;
  }, [posts]);

  const triggerError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  const handleVote = async (parentId, voteValue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/rumors/${parentId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteValue, voterId: userId, reputationMock: 0.5 })
      });

      if (res.status === 403 || res.status === 429) {
        const data = await res.json();
        triggerError(data.error);
      }
    } catch (err) {
      console.error("Vote error:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 text-white relative">
      {flash67 && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <h1 className="text-[25rem] font-black text-green-500 animate-ping opacity-80 mix-blend-screen drop-shadow-2xl">
            67
          </h1>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-max max-w-sm text-center bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-40 animate-bounce">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Campus Feed</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-gray-500">{userId}</span>
          <button onClick={onLogout} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">
            Log Out
          </button>
          <button onClick={onDestroy} className="text-sm font-bold text-red-400 hover:text-red-300 border border-red-900/50 px-3 py-1 rounded-lg transition-colors bg-red-900/20">
            Destroy Identity
          </button>
        </div>
      </div>

      <ManaBar mana={mana} />
      
      <PostForm userId={userId} onError={triggerError} />
      
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