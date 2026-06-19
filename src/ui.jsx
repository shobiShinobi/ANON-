import React, { useEffect } from 'react';

// Round identity avatar built from the user's chosen emoji + color.
export function Avatar({ emoji = '🛰️', color = '#22c55e', size = 40, ring = true }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${ring ? 'ring-2 ring-black/40' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${color}cc, ${color}55)`,
        fontSize: size * 0.5,
        boxShadow: `0 0 0 1px ${color}55, 0 4px 14px ${color}22`,
      }}
      aria-hidden="true"
    >
      <span>{emoji}</span>
    </div>
  );
}

// Author reputation tag chip.
export function TagChip({ tag }) {
  let cls = 'bg-gray-700/40 text-gray-300 border-gray-600/40';
  if (tag === 'Trusted User') cls = 'bg-blue-900/40 text-blue-300 border-blue-700/50';
  if (tag === 'Untrustworthy User') cls = 'bg-red-900/40 text-red-300 border-red-700/50';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{tag}</span>;
}

export function TrustBadge({ score }) {
  let cls = 'text-gray-300 bg-gray-700/50 border-gray-600/40';
  let label = 'NEUTRAL';
  if (score >= 0.7) {
    cls = 'text-green-300 bg-green-900/40 border-green-700/50';
    label = 'VERIFIED';
  } else if (score < 0.3) {
    cls = 'text-red-300 bg-red-900/40 border-red-700/50';
    label = 'DISPUTED';
  }
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${cls}`}>
      {label} ({Number(score).toFixed(2)})
    </span>
  );
}

// Lightweight auto-dismissing toast.
export function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  const color = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${color} text-white px-5 py-3 rounded-xl font-bold shadow-2xl animate-fade-in max-w-[90vw] text-center`}
      role="status"
    >
      {message}
    </div>
  );
}
