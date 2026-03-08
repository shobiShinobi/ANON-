import { useState } from 'react';

export default function PostForm({ userId }) {
  const [text, setText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || text.length > 500) return;

    await fetch('http://localhost:5000/api/rumors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        authorId: userId,
        privateKeyMock: 'mock_key_123'
      })
    });
    setText('');
  };

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 mb-6">
      <form onSubmit={handleSubmit}>
        {/* AC: Input field max 500 chars */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Share an update or rumor..."
          className="w-full bg-black/50 text-white rounded-lg p-3 outline-none resize-none border border-gray-700 focus:border-green-500"
          rows="3"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">{text.length}/500</span>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
            Broadcast
          </button>
        </div>
      </form>
    </div>
  );
}