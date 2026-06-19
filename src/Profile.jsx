import React, { useState, useEffect } from 'react';
import ManaBar from './ManaBar.jsx';
import PeerGraph from './PeerGraph.jsx';
import { Avatar, TagChip } from './ui.jsx';
import { updateProfile, getMe, WS_URL, loadIdentity } from './api.js';

const EMOJIS = ['🛰️', '🦉', '👻', '🐱', '🦊', '🐸', '🤖', '👾', '🐺', '🦅', '🌙', '⚡', '🔥', '🌵', '🍄', '💀'];
const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#14b8a6'];

export default function Profile({ me, setMe, notify, onLogout, onDestroy }) {
  const [peerCount, setPeerCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    displayName: me.displayName || '',
    bio: me.bio || '',
    avatarEmoji: me.avatarEmoji || '🛰️',
    avatarColor: me.avatarColor || '#22c55e',
  });
  const [saving, setSaving] = useState(false);
  const identity = loadIdentity();

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'MANA_UPDATE' && data.userId === me.id) setMe((prev) => ({ ...prev, mana: data.mana }));
        if (data.type === 'PEER_UPDATE') setPeerCount(data.count);
        if (data.type === 'NEW_NODE') getMe().then(setMe).catch(() => {});
      };
    } catch {
      /* realtime optional */
    }
    return () => ws?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const startEdit = () => {
    setDraft({
      displayName: me.displayName || '',
      bio: me.bio || '',
      avatarEmoji: me.avatarEmoji || '🛰️',
      avatarColor: me.avatarColor || '#22c55e',
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile(draft);
      setMe((prev) => ({ ...prev, ...updated }));
      setEditing(false);
      notify('Profile updated.', 'success');
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 w-full">
      {/* Identity banner */}
      <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 mb-6 shadow-lg">
        <div className="flex items-start gap-4">
          <Avatar emoji={me.avatarEmoji} color={me.avatarColor} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-black truncate">{me.displayName}</h2>
              <TagChip tag={me.authorTag} />
            </div>
            <p className="text-xs text-gray-500 font-mono mt-1 break-all">{me.id}</p>
            {me.bio && <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{me.bio}</p>}
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="bg-gray-800 hover:bg-gray-700 text-sm font-bold px-3 py-1.5 rounded-lg border border-gray-700 shrink-0"
            >
              Edit
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-5 pt-5 border-t border-gray-800 space-y-4 animate-fade-in">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">DISPLAY NAME</label>
              <input
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                maxLength={32}
                className="w-full bg-black/40 border border-gray-700 rounded-lg p-2.5 outline-none focus:border-green-500"
                placeholder="Anonymous"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">BIO</label>
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                maxLength={160}
                rows="2"
                className="w-full bg-black/40 border border-gray-700 rounded-lg p-2.5 outline-none focus:border-green-500 resize-none"
                placeholder="Say something cryptic… (160 chars)"
              />
              <span className="text-[11px] text-gray-600 font-mono">{draft.bio.length}/160</span>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-2">AVATAR</label>
              <div className="flex items-center gap-4 flex-wrap">
                <Avatar emoji={draft.avatarEmoji} color={draft.avatarColor} size={56} />
                <div className="flex gap-1.5 flex-wrap">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => setDraft({ ...draft, avatarEmoji: em })}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors ${
                        draft.avatarEmoji === em ? 'border-green-500 bg-green-900/30' : 'border-gray-700 bg-black/30 hover:border-gray-500'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, avatarColor: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      draft.avatarColor === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    aria-label={`color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-lg text-sm"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-4 py-2 rounded-lg text-sm border border-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <ManaBar mana={me.mana} />

      <div className="bg-gray-900/70 border border-gray-800 p-4 rounded-2xl mb-6 shadow-sm flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-gray-300 text-sm tracking-wider">🛡️ GLOBAL TRUST</span>
        <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-black border border-gray-700 text-blue-400">
          {Number(me.trust ?? 1).toFixed(2)}× multiplier
        </span>
      </div>

      <PeerGraph peerCount={peerCount} />

      {/* Recovery reminder */}
      {identity?.seed && (
        <div className="bg-yellow-950/20 border border-yellow-900/40 rounded-2xl p-4 mb-6">
          <h3 className="text-yellow-400 font-bold text-sm mb-1">🔑 Your recovery key is stored on this device</h3>
          <p className="text-xs text-gray-400">
            Your seed never leaves your browser except to authenticate. Back it up offline — losing it means losing this
            identity permanently.
          </p>
        </div>
      )}

      <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl">
        <h3 className="text-red-500 font-bold mb-4">Danger zone</h3>
        <div className="flex flex-col gap-3">
          <button
            onClick={onLogout}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Log out (keep identity)
          </button>
          <button
            onClick={onDestroy}
            className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 rounded-lg transition-colors border border-red-700"
          >
            Destroy identity (erase everything)
          </button>
        </div>
      </div>
    </div>
  );
}
