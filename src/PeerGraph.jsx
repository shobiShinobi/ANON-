import React from 'react';

export default function PeerGraph({ peerCount }) {
  // Generate orbital positions for connected peers
  const peers = Array.from({ length: peerCount }).map((_, i) => {
    const angle = (i / peerCount) * (2 * Math.PI);
    const radius = 40; // Distance from center
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-gray-400">Mesh Network Topology</h3>
        <span className="flex h-3 w-3 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${peerCount > 0 ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 ${peerCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </span>
      </div>
      
      <div className="relative w-full h-28 bg-black rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center">
        {peerCount === 0 ? (
          <p className="text-xs text-red-500 font-mono animate-pulse">Scanning for peers...</p>
        ) : (
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-80">
            {/* Draw lines from center (You) to all peers */}
            {peers.map((peer, i) => (
              <line key={`line-${i}`} x1="50" y1="50" x2={peer.x} y2={peer.y} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="2,2" className="animate-pulse" />
            ))}
            {/* Center Node (You) */}
            <circle cx="50" cy="50" r="4" fill="#3b82f6" />
            <text x="50" y="60" fontSize="4" fill="white" textAnchor="middle">YOU</text>
            
            {/* Peer Nodes */}
            {peers.map((peer, i) => (
              <circle key={`node-${i}`} cx={peer.x} cy={peer.y} r="3" fill="#22c55e" />
            ))}
          </svg>
        )}
      </div>
      <p className="text-xs text-gray-500 text-center mt-2 font-mono">
        {peerCount === 0 ? 'Isolated Node' : `Securely connected to ${peerCount} peers`}
      </p>
    </div>
  );
}