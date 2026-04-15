import React, { useEffect, useRef } from 'react';

export default function NetworkTerminal({ logs }) {
  const endRef = useRef(null);

  // Auto-scroll to the bottom when a new log arrives
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 h-36 overflow-y-auto font-mono text-[11px] mb-6 shadow-inner relative">
      <div className="sticky top-0 bg-[#0a0a0a] text-gray-500 mb-2 border-b border-gray-800 pb-1 flex justify-between">
        <span>📡 LIVE MESH LOGS</span>
        <span className="animate-pulse text-green-500">Listening...</span>
      </div>
      
      <div className="space-y-1">
        {logs.length === 0 && <div className="text-gray-600 italic">No network traffic detected...</div>}
        {logs.map((log, i) => {
          // Color code the terminal outputs
          let color = "text-green-500";
          if (log.includes('GOSSIP')) color = "text-blue-400";
          if (log.includes('SYNC')) color = "text-purple-400";
          if (log.includes('WARN') || log.includes('ERR')) color = "text-red-500";

          return (
            <div key={i} className={`${color} opacity-90 hover:opacity-100 transition-opacity`}>
              <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}