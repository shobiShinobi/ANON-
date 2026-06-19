import React, { useEffect, useState } from 'react';
import { Avatar, TagChip, TrustBadge } from './ui.jsx';
import { getPublicProfile, imageUrl } from './api.js';

// Read-only public profile, opened by clicking an author in the feed.
export default function UserProfileModal({ userId, currentUserId, posts = [], onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError('');
    getPublicProfile(userId)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const theirPosts = posts.filter((p) => p.authorId === userId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg my-8 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h3 className="font-bold text-gray-300 text-sm tracking-wider">NODE PROFILE</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="p-6 text-red-400 font-bold text-sm">{error}</p>}

        {!profile && !error && (
          <p className="p-8 text-center text-gray-600 font-mono animate-pulse">Loading node…</p>
        )}

        {profile && (
          <div className="p-5">
            <div className="flex items-start gap-4">
              <Avatar emoji={profile.avatarEmoji} color={profile.avatarColor} size={64} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black truncate">{profile.displayName}</h2>
                  <TagChip tag={profile.authorTag} />
                  {profile.id === currentUserId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-700/50 bg-green-900/40 text-green-300">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono mt-1 break-all">{profile.id}</p>
                {profile.bio ? (
                  <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-gray-600 italic mt-3">No bio yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between bg-black/40 border border-gray-800 rounded-xl px-4 py-3 mt-5">
              <span className="text-sm font-bold text-gray-400">🛡️ Global trust</span>
              <span className="font-mono text-sm font-bold text-blue-400">
                {Number(profile.trust ?? 1).toFixed(2)}× multiplier
              </span>
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-bold text-gray-500 tracking-wider mb-2">
                RECENT POSTS ({theirPosts.length})
              </h4>
              {theirPosts.length === 0 ? (
                <p className="text-sm text-gray-600 italic">Nothing on the feed right now.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {theirPosts.slice(0, 20).map((p) => (
                    <div key={p.id} className="bg-black/40 border border-gray-800 rounded-xl p-3">
                      {p.text && <p className="text-sm whitespace-pre-wrap break-words mb-2">{p.text}</p>}
                      {p.image && (
                        <img
                          src={imageUrl(p.image)}
                          alt="attachment"
                          loading="lazy"
                          className="max-h-40 rounded-lg border border-gray-800 mb-2"
                        />
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
                        <span>{p.totalVotes || 0} votes</span>
                        <TrustBadge score={p.score ?? 0.5} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
