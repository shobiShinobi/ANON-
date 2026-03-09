import { useState, useEffect } from 'react';
import PostForm from './PostForm';
import TrustBadge from './TrustBadge';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  // Auto-generate simple ID (1, 2, 3, etc.) for this session
  const [userId] = useState(() => Math.floor(Math.random() * 1000).toString());

  useEffect(() => {
    // AC: Fetch recent rumors from local database
    fetch('http://localhost:5000/api/feed')
      .then(res => res.json())
      .then(data => setPosts(data));
      
    // Basic socket listener for updates
    const ws = new WebSocket('ws://localhost:5000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_NODE' && data.node.type === 'RUMOR') {
        setPosts(prev => [data.node, ...prev]);
      }
    };
    return () => ws.close();

  }, []);

    const handleVote = async (parentId, voteValue) => {
    await fetch(`http://localhost:5000/api/rumors/${parentId}/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: voteValue, voterId: userId, reputationMock: 0.5 })
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Campus Feed (User: {userId})</h1>
      <PostForm userId={userId} />
      
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-lg mb-3">{post.text}</p>
            
            <div className="flex gap-2 mb-3 pt-3 border-t border-gray-700">
              {/* AC: UI Verify (+1) and Dispute (-1) buttons */}
              <button 
                onClick={() => handleVote(post.id, 1)}
                className="bg-gray-700 hover:bg-green-900 text-green-400 px-3 py-1 rounded text-sm font-bold"
              >
                +1 Verify
              </button>
              <button 
                onClick={() => handleVote(post.id, -1)}
                className="bg-gray-700 hover:bg-red-900 text-red-400 px-3 py-1 rounded text-sm font-bold"
              >
                -1 Dispute
              </button>
            </div>

            <div className="flex justify-between text-xs text-gray-400">
              <span>{new Date(post.timestamp).toLocaleTimeString()}</span>
              <TrustBadge score={post.score ?? 0.5} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// AC: Color Code Green (>0.7), Gray (0.3-0.7), Red (<0.3)
const TrustBadge = ({ score }) => {
  let colorClass = "text-gray-400 bg-gray-700"; // Default Gray
  let label = "NEUTRAL";

  if (score > 0.7) {
    colorClass = "text-green-400 bg-green-900";
    label = "VERIFIED";
  } else if (score < 0.3) {
    colorClass = "text-red-400 bg-red-900";
    label = "DISPUTED";
  }

  return (
    // AC: Display score (0.0 to 1.0) on every post
    <span className={`px-2 py-1 rounded text-[10px] font-bold ${colorClass}`}>
      {label} ({score.toFixed(2)})
    </span>
  );
};
