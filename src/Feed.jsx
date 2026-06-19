import React, { useState, useEffect, useCallback, useRef } from 'react';
import PostForm from './PostForm.jsx';
import ManaBar from './ManaBar.jsx';
import NetworkTerminal from './NetworkTerminal.jsx';
import UserProfileModal from './UserProfileModal.jsx';
import { Avatar, TagChip, TrustBadge } from './ui.jsx';
import { getFeed, getMana, votePost, imageUrl, WS_URL } from './api.js';

export default function Feed({ me, setMe, notify }) {
  const [posts, setPosts] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [logs, setLogs] = useState([`> System boot: node ${me.id} linked to mesh.`]);
  const [votedPosts, setVotedPosts] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const wsRef = useRef(null);

  const addLog = useCallback((msg) => setLogs((prev) => [...prev, msg].slice(-50)), []);

  const fetchPosts = useCallback(() => {
    getFeed()
      .then((data) => setPosts(data))
      .catch(() => addLog('> [WARN] Failed to fetch feed from node.'))
      .finally(() => setLoading(false));
  }, [addLog]);

  // Refresh mana directly (fallback when the realtime socket is unavailable).
  const refreshMana = useCallback(() => {
    getMana()
      .then((d) => setMe((prev) => ({ ...prev, mana: d.mana })))
      .catch(() => {});
  }, [setMe]);

  const handlePosted = useCallback(() => {
    fetchPosts();
    refreshMana();
  }, [fetchPosts, refreshMana]);

  useEffect(() => {
    fetchPosts();

    let ws;
    try {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => addLog('> [SYNC] Live mesh socket connected.');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_NODE') {
          fetchPosts();
          addLog('> [GOSSIP] Local state synced with mesh.');
        }
        if (data.type === 'MANA_UPDATE' && data.userId === me.id) {
          setMe((prev) => ({ ...prev, mana: data.mana }));
        }
        if (data.type === 'PEER_UPDATE') addLog(`> [SYNC] Active mesh nodes: ${data.count}.`);
      };
      ws.onerror = () => addLog('> [WARN] Mesh socket error.');
    } catch {
      addLog('> [WARN] Realtime unavailable; using manual refresh.');
    }
    return () => ws?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const handleVote = async (postId, voteValue) => {
    if (votedPosts.has(postId)) {
      notify('You have already voted on this post.');
      return;
    }
    // optimistic lock
    setVotedPosts((prev) => new Set(prev).add(postId));
    try {
      await votePost(postId, voteValue);
      addLog('> [TX] Vote committed and gossiping…');
      refreshMana();
    } catch (err) {
      if (err.status !== 429) {
        // release the lock if it wasn't an "already voted" rejection
        setVotedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
      notify(err.message);
    }
  };

  const displayed = [...posts].sort((a, b) => {
    if (sortBy === 'newest') return b.timestamp - a.timestamp;
    if (sortBy === 'trusted') return (b.score ?? 0) - (a.score ?? 0);
    return 0;
  });

  return (
    <div className="max-w-2xl mx-auto p-4 w-full">
      <ManaBar mana={me.mana} />
      <NetworkTerminal logs={logs} />

      <div className="flex justify-between items-center mb-4 bg-gray-900/80 p-2 rounded-xl border border-gray-800">
        <span className="text-sm font-bold text-gray-400 pl-2">Sort</span>
        <div className="flex gap-1">
          <SortBtn active={sortBy === 'newest'} onClick={() => setSortBy('newest')}>
            Newest
          </SortBtn>
          <SortBtn active={sortBy === 'trusted'} onClick={() => setSortBy('trusted')}>
            Most Trusted
          </SortBtn>
        </div>
      </div>

      <PostForm me={me} onPosted={handlePosted} notify={notify} />

      {loading ? (
        <div className="text-center text-gray-600 font-mono py-12 animate-pulse">Loading the mesh…</div>
      ) : displayed.length === 0 ? (
        <div className="text-center text-gray-600 py-12 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-4xl mb-2">🛰️</p>
          <p className="font-bold text-gray-400">The mesh is quiet.</p>
          <p className="text-sm">Be the first to broadcast a rumor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((post) => {
            const hasVoted = votedPosts.has(post.id);
            return (
              <article
                key={post.id}
                className="bg-gray-900/70 p-4 rounded-2xl border border-gray-800 shadow-lg hover:border-gray-700 transition-colors animate-fade-in"
              >
                <header className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => setViewingUser(post.authorId)}
                    className="rounded-full hover:ring-2 hover:ring-gray-600 transition-shadow"
                    title={`View ${post.authorName}'s profile`}
                  >
                    <Avatar emoji={post.authorEmoji} color={post.authorColor} size={36} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingUser(post.authorId)}
                        className="font-bold text-sm truncate hover:text-green-400 transition-colors text-left"
                      >
                        {post.authorName}
                      </button>
                      <TagChip tag={post.authorTag} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {post.authorId} · {timeAgo(post.timestamp)}
                    </span>
                  </div>
                </header>

                {post.text && <p className="text-[15px] leading-relaxed mb-3 whitespace-pre-wrap break-words">{post.text}</p>}

                {post.image && (
                  <a href={imageUrl(post.image)} target="_blank" rel="noreferrer" className="block mb-3">
                    <img
                      src={imageUrl(post.image)}
                      alt="rumor attachment"
                      loading="lazy"
                      className="max-h-96 w-auto rounded-xl border border-gray-800"
                    />
                  </a>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <div className="flex gap-2">
                    <VoteBtn kind="verify" disabled={hasVoted} onClick={() => handleVote(post.id, 1)}>
                      ▲ Verify
                    </VoteBtn>
                    <VoteBtn kind="dispute" disabled={hasVoted} onClick={() => handleVote(post.id, -1)}>
                      ▼ Dispute
                    </VoteBtn>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                    <span>{post.totalVotes || 0} votes</span>
                    <TrustBadge score={post.score ?? 0.5} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {viewingUser && (
        <UserProfileModal
          userId={viewingUser}
          currentUserId={me.id}
          posts={posts}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}

function SortBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm font-bold rounded-lg transition-colors ${
        active ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function VoteBtn({ kind, disabled, onClick, children }) {
  const base = 'px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border';
  const enabled =
    kind === 'verify'
      ? 'bg-gray-800 hover:bg-green-900/40 text-green-400 border-green-900/50'
      : 'bg-gray-800 hover:bg-red-900/40 text-red-400 border-red-900/50';
  const off = 'bg-gray-800/50 text-gray-600 border-gray-800 cursor-not-allowed';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${disabled ? off : enabled}`}>
      {children}
    </button>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}
