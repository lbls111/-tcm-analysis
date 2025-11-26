


import React, { useState } from 'react';
import { SanJiaoAnalysis, HerbPair, Vector2D, SimulationSeriesPoint, CalculatedHerb } from '../types';
import { getPTILabel } from '../utils/tcmMath';

interface Props {
  data: SanJiaoAnalysis;
  herbs: CalculatedHerb[];
  herbPairs: HerbPair[];
  netVector?: Vector2D;
  dynamics?: SimulationSeriesPoint[];
}

export const QiFlowVisualizer: React.FC<Props> = ({ data, herbs, herbPairs, netVector, dynamics }) => {
  const maxScale = 1.5; 
  const [activeBurner, setActiveBurner] = useState<'upper' | 'middle' | 'lower' | null>(null);

  const renderBurnerBreakdown = (burnerKey: 'upper' | 'middle' | 'lower') => {
    const contributors = herbs
      .filter(h => h.burnerWeights[burnerKey] > 0)
      .sort((a, b) => (Math.abs(b.ptiContribution) * b.burnerWeights[burnerKey]) - (Math.abs(a.ptiContribution) * a.burnerWeights[burnerKey]));

    if (contributors.length === 0) return <div className="text-sm text-slate-400 italic p-2">无显著药物归入此焦</div>;

    return (
      <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 animate-in slide-in-from-top-2">
        <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-wider">TWFC 权重透视</h4>
        <table className="w-full text-sm text-left">
          <tbody className="divide-y divide-slate-100">
            {contributors.map(h => {
              const weight = h.burnerWeights[burnerKey];
              const value = h.ptiContribution * weight;
              return (
                <tr key={h.id} className="hover:bg-slate-100/50 transition-colors">
                  <td className="py-1.5 font-medium text-slate-700">{h.name}</td>
                  <td className="py-1.5 text-center text-slate-400 text-xs font-mono">{(weight * 100).toFixed(0)}%</td>
                  <td className={`py-1.5 text-right font-mono font-bold text-xs ${value > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                    {value > 0 ? '+' : ''}{value.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBar = (burnerKey: 'upper' | 'middle' | 'lower', label: string, subLabel: string, functionalLabel: string, icon: string) => {
    const pti = data[burnerKey].pti;
    const info = getPTILabel(pti);
    const percentage = Math.min((Math.abs(pti) / maxScale) * 50, 50); 
    const isActive = activeBurner === burnerKey;
    
    return (
      <div className={`flex flex-col mb-4 relative group transition-all duration-300 ${isActive ? 'bg-white/50 p-4 rounded-2xl shadow-sm border border-indigo-50' : ''}`}>
        <div 
          className="flex justify-between items-center mb-3 cursor-pointer select-none"
          onClick={() => setActiveBurner(isActive ? null : burnerKey)}
        >
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                {icon}
             </div>
             <div>
                <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                   {label}
                   <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                      {functionalLabel}
                   </span>
                </h4>
                <div className="text-xs text-slate-400 font-medium mt-0.5">{subLabel}</div>
             </div>
          </div>
          
          <div className="text-right">
             <div className={`font-mono text-xl font-black ${pti > 0 ? 'text-rose-500' : pti < 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                {pti > 0 ? '+' : ''}{pti.toFixed(3)}
             </div>
             <div className={`text-[10px] font-bold uppercase tracking-wider ${pti > 0 ? 'text-rose-300' : pti < 0 ? 'text-blue-300' : 'text-emerald-300'}`}>
                PTI Index
             </div>
          </div>
        </div>
        
        {/* Bar */}
        <div 
          className="h-3 w-full bg-slate-100 rounded-full relative flex items-center overflow-hidden cursor-pointer hover:bg-slate-200 transition-colors"
          onClick={() => setActiveBurner(isActive ? null : burnerKey)}
        >
           <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-10 opacity-50"></div>
           <div 
             className={`h-full absolute transition-all duration-1000 ease-out rounded-full shadow-sm ${
                pti > 0 ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 
                pti < 0 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-emerald-400'
             }`}
             style={{
               left: pti >= 0 ? '50%' : `calc(50% - ${percentage}%)`,
               width: `${percentage}%`
             }}
           ></div>
        </div>

        {/* Breakdown Details */}
        {isActive && renderBurnerBreakdown(burnerKey)}
      </div>
    );
  };

  const renderVectorCompass = (v: Vector2D) => {
    return (
      <div className="relative w-full aspect-square max-w-[320px] mx-auto bg-white rounded-full border border-slate-100 shadow-[0_0_40px_-10px_rgba(0,0,0,0.05)] p-2">
         {/* Inner Circles */}
         <div className="absolute inset-4 rounded-full border border-slate-100"></div>
         <div className="absolute inset-16 rounded-full border border-dashed border-slate-200 opacity-50"></div>
         
         {/* Grid Lines */}
         <div className="absolute top-4 bottom-4 left-1/2 w-px bg-slate-200"></div>
         <div className="absolute left-4 right-4 top-1/2 h-px bg-slate-200"></div>
         
         {/* Labels */}
         <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 bg-white px-1">升 (Lift)</div>
         <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 bg-white px-1">降 (Sink)</div>
         <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 bg-white px-1">收 (Close)</div>
         <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 bg-white px-1">散 (Open)</div>

         {/* Vector Arrow */}
         <div 
           className="absolute top-1/2 left-1/2 w-1.5 bg-indigo-600 origin-bottom transition-all duration-1000 z-10 shadow-lg rounded-full"
           style={{
             height: `${Math.min(v.magnitude * 80, 42)}%`,
             transform: `translate(-50%, -100%) rotate(${v.angle + 90}deg)`,
             opacity: v.magnitude > 0.01 ? 1 : 0
           }}
         >
           <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full shadow-md border-2 border-white"></div>
         </div>
         
         {/* Center Point */}
         <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-slate-300 rounded-full -translate-x-1/2 -translate-y-1/2 z-0"></div>
      </div>
    );
  };

  const renderDynamicsChart = (series: SimulationSeriesPoint[]) => {
    const width = 400;
    const height = 180;
    const maxQ = Math.max(1, ...series.map(s => Math.max(s.qw, s.qy, s.qz))); // Avoid div by zero
    const normalizeY = (val: number) => height - (val / maxQ) * (height - 20) - 10;
    const normalizeX = (t: number) => (t / 120) * width;

    const pathQw = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qw)}`).join(' ');
    const pathQy = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qy)}`).join(' ');
    const pathQz = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qz)}`).join(' ');

    return (
      <div className="w-full overflow-hidden relative group">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm bg-white rounded-xl border border-slate-50 p-4">
          <defs>
              <linearGradient id="gradQw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="gradQy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
              </linearGradient>
          </defs>
          <path d={pathQz} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
          
          <path d={`${pathQw} L ${width} ${height} L 0 ${height} Z`} fill="url(#gradQw)" stroke="none" />
          <path d={pathQw} fill="none" stroke="#f43f5e" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          
          <path d={`${pathQy} L ${width} ${height} L 0 ${height} Z`} fill="url(#gradQy)" stroke="none" />
          <path d={pathQy} fill="none" stroke="#3b82f6" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-4 lg:p-8 flex flex-col xl:flex-row gap-8">
      {/* Left: San Jiao Charts */}
      <div className="flex-[3] bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl shadow-indigo-100/50 border border-white flex flex-col">
        <h3 className="text-2xl font-serif-sc font-black text-slate-800 mb-8 flex items-center gap-3">
          <span className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-200">焦</span>
          三焦药势分布 (San Jiao Distribution)
        </h3>
        
        <div className="space-y-4">
           {renderBar('upper', '上焦', '心 / 肺', '宣发 · 呼吸', '🫁')}
           {renderBar('middle', '中焦', '脾 / 胃', '运化 · 枢纽', '🥣')}
           {renderBar('lower', '下焦', '肝 / 肾', '潜藏 · 疏泄', '🌱')}
        </div>
        
        <div className="mt-auto pt-8 border-t border-slate-100">
           <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-lg">💡</span>
              <div className="text-xs text-slate-500 leading-relaxed">
                 <strong className="text-slate-800 block mb-1">算法说明</strong> 
                 三焦数值基于 TWFC 归经权重算法动态分配。总能量守恒，但正负值代表寒热势能方向。点击上方条形图可查看具体药物贡献。
              </div>
           </div>
        </div>
      </div>

      {/* Right Column: Visualization */}
      <div className="flex-[2] flex flex-col gap-6">
         
         {/* Vector Compass */}
         {netVector && (
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl shadow-emerald-100/50 border border-white flex flex-col items-center">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 self-start">
                  <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                  气机罗盘 (Compass)
                </h3>
                {renderVectorCompass(netVector)}
                <div className="grid grid-cols-2 gap-4 w-full mt-6">
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">升降趋势 (Y)</div>
                      <div className={`font-mono font-bold ${netVector.y > 0 ? 'text-indigo-600' : 'text-blue-600'}`}>
                         {netVector.y > 0.1 ? '↑ 升' : netVector.y < -0.1 ? '↓ 降' : '• 平'}
                      </div>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">收散趋势 (X)</div>
                      <div className={`font-mono font-bold ${netVector.x > 0 ? 'text-indigo-600' : 'text-blue-600'}`}>
                         {netVector.x > 0.1 ? '→ 散' : netVector.x < -0.1 ? '← 收' : '• 平'}
                      </div>
                   </div>
                </div>
            </div>
         )}

         {/* Dynamics Panel */}
         {dynamics && (
           <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl shadow-rose-100/50 border border-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
                  动力学 (Dynamics)
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">0-120min</span>
              </div>
              
              {renderDynamicsChart(dynamics)}
              
              <div className="flex justify-center gap-6 mt-4 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-rose-500"><span className="w-2 h-2 bg-rose-500 rounded-full"></span> 卫气 (Wei)</span>
                  <span className="flex items-center gap-1.5 text-blue-500"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> 营阴 (Ying)</span>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};