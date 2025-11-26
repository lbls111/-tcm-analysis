
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
      <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-100 animate-in slide-in-from-top-2">
        <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">TWFC 权重算法透视</h4>
        <table className="w-full text-sm text-left">
          <thead className="text-slate-500 font-normal border-b border-slate-200">
            <tr>
              <th className="pb-2">药物</th>
              <th className="pb-2 text-center">分配权重 (Weight)</th>
              <th className="pb-2 text-right">贡献值 (Contri)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contributors.map(h => {
              const weight = h.burnerWeights[burnerKey];
              const value = h.ptiContribution * weight;
              return (
                <tr key={h.id}>
                  <td className="py-2 font-medium text-slate-700">{h.name}</td>
                  <td className="py-2 text-center text-slate-500 font-mono">{(weight * 100).toFixed(0)}%</td>
                  <td className={`py-2 text-right font-mono font-bold ${value > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {value > 0 ? '+' : ''}{value.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBar = (burnerKey: 'upper' | 'middle' | 'lower', label: string, subLabel: string, functionalLabel: string) => {
    const pti = data[burnerKey].pti;
    const info = getPTILabel(pti);
    const percentage = Math.min((Math.abs(pti) / maxScale) * 50, 50); 
    const isActive = activeBurner === burnerKey;
    
    return (
      <div className="flex flex-col mb-8 relative group transition-all">
        <div 
          className="flex justify-between items-end mb-3 cursor-pointer"
          onClick={() => setActiveBurner(isActive ? null : burnerKey)}
        >
          <div>
            <span className="font-bold text-slate-800 text-2xl flex items-center gap-3">
              {label} 
              <span className={`text-xs px-2 py-0.5 rounded-full border font-normal ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {isActive ? '收起透视' : '查看权重'}
              </span>
            </span>
            <span className="text-sm text-slate-500 uppercase tracking-wide font-medium flex items-center gap-2 mt-1">
              {subLabel} <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span> <span className="text-indigo-600">{functionalLabel}</span>
            </span>
          </div>
          <div className={`font-mono text-2xl font-bold ${info.color}`}>
            {pti > 0 ? '+' : ''}{pti.toFixed(3)}
          </div>
        </div>
        
        {/* Bar */}
        <div 
          className="h-10 w-full bg-slate-100 rounded-xl relative flex items-center overflow-hidden border border-slate-200 shadow-inner cursor-pointer"
          onClick={() => setActiveBurner(isActive ? null : burnerKey)}
        >
           <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-10 opacity-50"></div>
           <div 
             className={`h-full absolute transition-all duration-700 ${
                pti > 0 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
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
      <div className="relative w-72 h-72 mx-auto bg-slate-50 rounded-full border-4 border-slate-200 shadow-inner">
         {/* Grid Lines */}
         <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-300"></div>
         <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-300"></div>
         
         {/* Labels */}
         <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-slate-600 font-bold bg-white/90 px-2 py-0.5 rounded shadow-sm border border-slate-100">升 (Lift)</div>
         <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-600 font-bold bg-white/90 px-2 py-0.5 rounded shadow-sm border border-slate-100">降 (Sink)</div>
         <div className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-bold bg-white/90 px-2 py-0.5 rounded shadow-sm border border-slate-100">收 (Close)</div>
         <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-bold bg-white/90 px-2 py-0.5 rounded shadow-sm border border-slate-100">散 (Open)</div>

         {/* Vector Arrow */}
         <div 
           className="absolute top-1/2 left-1/2 w-1 bg-indigo-600 origin-bottom transition-all duration-1000 z-10 shadow-sm"
           style={{
             height: `${Math.min(v.magnitude * 100, 48)}%`,
             transform: `translate(-50%, -100%) rotate(${v.angle + 90}deg)`
           }}
         >
           <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-indigo-600"></div>
         </div>
         <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-indigo-600 rounded-full -translate-x-1/2 -translate-y-1/2 z-20 shadow-lg border-2 border-white"></div>
      </div>
    );
  };

  const renderDynamicsChart = (series: SimulationSeriesPoint[]) => {
    const width = 400;
    const height = 200;
    const maxQ = Math.max(1, ...series.map(s => Math.max(s.qw, s.qy, s.qz))); // Avoid div by zero
    const normalizeY = (val: number) => height - (val / maxQ) * (height - 20) - 10;
    const normalizeX = (t: number) => (t / 120) * width;

    const pathQw = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qw)}`).join(' ');
    const pathQy = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qy)}`).join(' ');
    const pathQz = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${normalizeX(p.time)} ${normalizeY(p.qz)}`).join(' ');

    return (
      <div className="w-full overflow-hidden relative group">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-md bg-white rounded-xl border border-slate-100 p-2">
          <path d={pathQz} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
          <path d={pathQw} fill="none" stroke="#f43f5e" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d={pathQy} fill="none" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex justify-center gap-8 mt-6 text-sm font-bold">
           <span className="flex items-center gap-2 text-rose-600"><span className="w-4 h-1.5 bg-rose-500 rounded-full"></span> 卫气 (Wei Qi)</span>
           <span className="flex items-center gap-2 text-blue-600"><span className="w-4 h-1.5 bg-blue-500 rounded-full"></span> 营阴 (Ying Yin)</span>
           <span className="flex items-center gap-2 text-slate-400"><span className="w-4 h-1.5 bg-slate-300 border-t border-dashed"></span> 谷气 (Source)</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-6 lg:p-12 flex flex-col xl:flex-row gap-10">
      {/* Left: San Jiao Charts */}
      <div className="flex-1 glass-panel rounded-[2.5rem] p-10 bg-white shadow-xl border border-slate-200 flex flex-col">
        <h3 className="text-4xl font-serif-sc font-bold text-slate-900 mb-3 flex items-center gap-5">
          <span className="w-3 h-12 bg-indigo-600 rounded-full shadow-md"></span>
          三焦药势分布 (San Jiao Distribution)
        </h3>
        <p className="text-slate-500 text-lg mb-10 pl-8">
           点击下方条形图可展开算法透视 (TWFC Weight Transparency)
        </p>
        
        {/* Universal Labels: Anatomical/Functional rather than specific treatment methods */}
        {renderBar('upper', '上焦 (Upper)', '心 / 肺', '气机宣发 · 呼吸')}
        {renderBar('middle', '中焦 (Middle)', '脾 / 胃', '气机枢纽 · 运化')}
        {renderBar('lower', '下焦 (Lower)', '肝 / 肾 / 膀胱 / 大肠', '气机潜藏 · 疏泄')}
        
        <div className="mt-auto p-6 bg-indigo-50/60 rounded-2xl text-sm text-slate-700 leading-relaxed border border-indigo-100">
          <strong className="text-indigo-900 block mb-2 text-base">📚 算法公示 (Algorithm Transparency)：</strong> 
          <ul className="list-disc ml-5 space-y-1.5">
             <li>
               <span className="font-bold text-slate-900">TWFC 权重</span>：基于《本草纲目》及现代中药药理学归经理论。
             </li>
             <li>
               <span className="font-bold text-slate-900">归一化分解</span>：三焦数值之和严格等于总PTI，遵循能量守恒。
             </li>
          </ul>
        </div>
      </div>

      {/* Right Column */}
      <div className="w-full xl:w-1/3 flex flex-col gap-8">
         
         {/* Dynamics Panel */}
         {dynamics && (
           <div className="glass-panel rounded-[2.5rem] p-8 bg-white shadow-xl border border-slate-200">
              <h3 className="text-2xl font-serif-sc font-bold text-slate-900 mb-3 flex items-center gap-3">
                <span className="w-2 h-8 bg-orange-500 rounded-full shadow-sm"></span>
                三焦动力学 (Dynamics)
              </h3>
              <p className="text-sm text-slate-500 mb-6 flex justify-between font-medium">
                <span>基于 ODE 微分方程模拟</span>
                <span>0-120分钟</span>
              </p>
              {renderDynamicsChart(dynamics)}
              <div className="mt-4 text-sm text-slate-500 leading-relaxed">
                 模拟服药后谷气(中)化生，以及推动卫气(上)宣发与营阴(下)内守/排泄的动态消长过程。
              </div>
           </div>
         )}

         {/* Vector Compass */}
         {netVector && (
            <div className="glass-panel rounded-[2.5rem] p-8 bg-white shadow-xl border border-slate-200">
                <h3 className="text-2xl font-serif-sc font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <span className="w-2 h-8 bg-emerald-500 rounded-full shadow-sm"></span>
                  气机罗盘 (Compass)
                </h3>
                {renderVectorCompass(netVector)}
                <div className="text-center mt-6 text-base text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100">
                   <div className="font-bold text-slate-900 mb-1">矢量合成说明</div>
                   <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <span className="text-xs text-slate-400 block">X轴 (Horizontal)</span>
                        <span className="font-bold text-indigo-700">收 (-) / 散 (+)</span>
                        <div className="text-[10px] text-slate-400">Opening / Closing</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">Y轴 (Vertical)</span>
                        <span className="font-bold text-indigo-700">降 (-) / 升 (+)</span>
                        <div className="text-[10px] text-slate-400">Ascending / Descending</div>
                      </div>
                   </div>
                </div>
            </div>
         )}
      </div>
    </div>
  );
};
