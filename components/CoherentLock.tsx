
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

const CoherentLock: React.FC = () => {
  const data = [
    { name: 'Supply Lock', value: 85, fill: '#D4AF37' },
    { name: 'Mechanism Lock', value: 72, fill: '#AA771C' },
    { name: 'Demand Lock', value: 91, fill: '#BF953F' },
  ];

  return (
    <div className="obsidian-card p-6 rounded-xl glow-gold">
      <h3 className="text-xl font-bold mb-6 gold-gradient">Coherent Lock Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.map((item) => (
          <div key={item.name} className="flex flex-col items-center">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  innerRadius="80%" 
                  outerRadius="100%" 
                  data={[item]} 
                  startAngle={90} 
                  endAngle={90 + (3.6 * item.value)}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    background
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{item.value}%</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-400 font-medium">{item.name}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-gray-800 flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">System Phase</p>
          <p className="text-xl font-bold text-white">SCALING</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Global Coherence</p>
          <p className="text-3xl font-bold gold-gradient">82.4%</p>
        </div>
      </div>
    </div>
  );
};

export default CoherentLock;
