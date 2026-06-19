import React, { useState, useRef } from 'react';
import { postRumor } from './api.js';
import { Avatar } from './ui.jsx';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function PostForm({ me, onPosted, notify }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      notify('Unsupported image type. Use JPEG, PNG, GIF, or WebP.');
      return;
    }
    if (f.size > MAX_BYTES) {
      notify('Image too large (max 5 MB).');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!text.trim() && !file) {
      notify('Write something or attach an image.');
      return;
    }
    if (me.mana < 50) {
      notify('Need 50 Mana to post. Wait for it to regenerate.');
      return;
    }
    setBusy(true);
    try {
      await postRumor({ text: text.trim(), imageFile: file });
      setText('');
      clearImage();
      onPosted?.();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const lowMana = me.mana < 50;

  return (
    <div className="bg-gray-900/80 p-4 rounded-2xl border border-gray-800 mb-6 shadow-lg">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <Avatar emoji={me.avatarEmoji} color={me.avatarColor} size={40} />
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Drop a campus rumor on the mesh… (costs 50 Mana)"
              className="w-full bg-black/40 text-white rounded-lg p-3 outline-none resize-none border border-gray-700 focus:border-green-500 transition-colors"
              rows="3"
            />

            {preview && (
              <div className="relative mt-3 inline-block">
                <img
                  src={preview}
                  alt="attachment preview"
                  className="max-h-60 rounded-lg border border-gray-700"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full w-7 h-7 flex items-center justify-center text-sm border border-gray-600"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-gray-400 hover:text-green-400 transition-colors flex items-center gap-1 text-sm font-bold"
                >
                  🖼️ <span className="hidden sm:inline">Image</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <span className={`text-xs font-mono ${text.length > 480 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {text.length}/500
                </span>
              </div>
              <button
                type="submit"
                disabled={busy || lowMana}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg"
                title={lowMana ? 'Not enough Mana' : 'Broadcast to the mesh'}
              >
                {busy ? 'Broadcasting…' : 'Broadcast'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
