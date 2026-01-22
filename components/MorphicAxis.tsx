
import React, { useState } from 'react';
import { AXIS_NODES } from '../constants';
import { ChevronRight } from 'lucide-react';

const MorphicAxis: React.FC = () => {
  const [activeNode, setActiveNode] = useState(0);

  return (
    <div className="py-20 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 gold-gradient">The Morphic Trade Axis</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          A non-Euclidean corridor of value connecting the Caribbean Diaspora to the African Source.
        </p>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-20 -translate-y-1/2" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {AXIS_NODES.map((node, index) => (
            <div 
              key={node.id}
              onClick={() => setActiveNode(index)}
              className={`cursor-pointer transition-all duration-500 p-8 rounded-2xl obsidian-card group ${
                activeNode === index ? 'ring-2 ring-gold-500 glow-gold scale-105' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
              }`}
            >
              <div className="bg-gradient-to-br from-gold-600 to-gold-400 w-12 h-12 rounded-lg flex items-center justify-center mb-6 shadow-lg">
                {node.icon}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">{node.name}</h3>
              <p className="text-gold-500 text-sm font-semibold mb-4 uppercase tracking-widest">{node.role}</p>
              <p className="text-gray-400 leading-relaxed text-sm">{node.description}</p>
              
              {index < AXIS_NODES.length - 1 && (
                <div className="mt-6 flex items-center text-gold-500 text-xs font-bold uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                  Tunneling to {AXIS_NODES[index+1].name} <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MorphicAxis;
