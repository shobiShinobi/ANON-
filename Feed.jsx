import { useState, useEffect } from 'react';
import PostForm from './PostForm';

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

  return (
    <div className="max-w-2xl mx-auto p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Campus Feed (User: {userId})</h1>
      <PostForm userId={userId} />
      
      <div className="space-y-4">
        {posts.map(post => (
          // AC: Each rumor in its own box with text and time
          <div key={post.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-lg mb-2">{post.text}</p>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{new Date(post.timestamp).toLocaleTimeString()}</span>
              <span>Score Placeholder</span> {/* To be updated in US9 */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
