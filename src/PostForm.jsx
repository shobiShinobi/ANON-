import React, { useState } from 'react';

// Grab the dynamic port passed by the Node Launcher, fallback to 5000
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || 5000;
const API_URL = `http://localhost:${BACKEND_PORT}`;

export default function PostForm({ userId, onError }) {
  const [text, setText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || text.length > 500) return;

    try {
      // UPDATED: Now uses the dynamic API_URL to match its specific local node
      const res = await fetch(`${API_URL}/api/rumors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          authorId: userId 
        })
      });

      // Catch Anti-Spam limits and pass the error up to the Feed
      if (res.status === 403 || res.status === 429) {
        const data = await res.json();
        onError(data.error); 
        return;
      }
      
      // Clear input on successful broadcast
      setText('');
    } catch (err) {
      console.error("Failed to post:", err);
      onError("Network error: Failed to connect to local node.");
    }
  };

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 mb-6 shadow-sm">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Share an update to the mesh (Costs 50 Mana)..."
          className="w-full bg-black/50 text-white rounded-lg p-3 outline-none resize-none border border-gray-700 focus:border-green-500 transition-colors"
          rows="3"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500 font-mono">
            {text.length}/500
          </span>
          <button 
            type="submit" 
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg"
          >
            Broadcast
          </button>
        </div>
      </form>
    </div>
  );
}