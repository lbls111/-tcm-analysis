
import React, { useState } from 'react';

interface Props {
  tokenCount: number;
  limit?: number;
  messageCount: number;
}

export const TokenCapsule: React.FC<Props> = ({ tokenCount, limit = 200000, messageCount }) => {
  const [showDetail, setShowDetail] = useState(false);

  // Calculate health percentage based on limit (capped at 100%)
  const percentage = Math.min((tokenCount / limit) * 100, 100);
  
  // Determine Color State
  let colorClass = 'bg-emerald-500 shadow-emerald-200';
  let textColor = 'text-emerald-700';
  let bgColor = 'bg-emerald-50';
  let label = '健康';

  if (tokenCount > limit * 0.8) {
      colorClass = 'bg-red-500 shadow-red-200 animate-pulse';
      textColor = 'text-red-700';
      bgColor = 'bg-red-50';
      label = '高危';
  } else if (tokenCount > limit * 0.5) {
      colorClass = 'bg-amber-400 shadow-amber-200';
      textColor = 'text-amber-700';
      bgColor = 'bg-amber-50';
      label = '繁忙';
  } else if (tokenCount > limit * 0.25) {
      colorClass = 'bg-sky-500 shadow-sky-200';
      textColor = 'text-sky-700';
      bgColor = 'bg-sky-50';
      label = '活跃';
  }

  return (
    <div className="relative inline-block mt-2">
        {/* The Capsule Trigger */}
        <button 
            onClick={() => setShowDetail(!showDetail)}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-sm group`}
        >
            <div className="relative w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500 ${colorClass}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Token Load</span>
                <span className={`text-xs font-black font-mono ${textColor}`}>
                    {tokenCount.toLocaleString()} <span className="text-[9px] text-slate-300">/ {limit/1000}k</span>
                </span>
            </div>
            {/* Status Dot */}
            <span className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`}></span>
        </button>

        {/* Detail Popover */}
        {showDetail && (
            <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDetail(false)}></div>
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-slate-800">上下文详情</h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bgColor} ${textColor}`}>
                        {label}状态
                    </span>
                </div>
                
                <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">当前对话轮数</span>
                        <span className="font-mono font-bold text-slate-700">{messageCount} msgs</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">估算消耗</span>
                        <span className="font-mono font-bold text-slate-700">{tokenCount} tokens</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">剩余配额 (Limit)</span>
                        <span className="font-mono font-bold text-slate-700">{(limit - tokenCount).toLocaleString()} tokens</span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div 
                            className={`h-full transition-all duration-500 ${colorClass.split(' ')[0]}`} 
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 leading-tight pt-2 border-t border-slate-50">
                        * Token 数值为基于字符数的估算值 (0.8 ratio)。包含系统提示词、对话历史与当前输入。
                    </p>
                </div>
            </div>
            </>
        )}
    </div>
  );
};
