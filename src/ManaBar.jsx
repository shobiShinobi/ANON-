import React from 'react';

export default function ManaBar({ mana }) {
  const percentage = Math.max(0, Math.min(100, mana));
  
  let color = "bg-green-500";
  if (percentage < 50) color = "bg-yellow-500";
  if (percentage < 20) color = "bg-red-500";

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-2 font-bold text-gray-300 text-sm tracking-wider">
        <span>⚡ MANA</span>
      </div>
      
      <div className="w-1/2 bg-black h-3 rounded-full overflow-hidden border border-gray-700">
        <div 
          className={`h-full ${color} transition-all duration-700 ease-out`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      
      <div className="font-mono text-sm text-gray-400 font-bold">{mana} / 100</div>
    </div>
  );
}