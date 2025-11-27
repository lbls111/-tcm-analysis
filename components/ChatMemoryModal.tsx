import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tokenCount: number;
  messageCount: number;
  onCompress: (keepCount: number) => Promise<void>;
  isCompressing: boolean;
}

export const ChatMemoryModal: React.FC<Props> = ({ isOpen, onClose, tokenCount, messageCount, onCompress, isCompressing }) => {
  const [keepCount, setKeepCount] = useState<number>(20);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div 
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-50 to-slate-50 p-6 flex justify-between items-center border-b border-indigo-100">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-xl shadow-sm">🧠</div>
             <div>
               <h3 className="text-xl font-bold text-slate-800">研讨记忆管理</h3>
               <p className="text-slate-500 text-xs font-medium">整理历史上下文，释放算力</p>
             </div>
           </div>
           <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-slate-500 transition">✕</button>
        </div>

        <div className="p-6 bg-white space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">当前消耗</div>
                    <div className={`text-2xl font-black font-mono ${tokenCount > 100000 ? 'text-red-500' : 'text-slate-700'}`}>
                        {tokenCount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">Tokens</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">对话轮数</div>
                    <div className="text-2xl font-black font-mono text-slate-700">
                        {messageCount}
                    </div>
                    <div className="text-[10px] text-slate-400">Messages</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700">压缩策略</label>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">
                        保留最近 {keepCount} 轮
                    </span>
                </div>
                
                <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    step="5"
                    value={keepCount}
                    onChange={(e) => setKeepCount(parseInt(e.target.value))}
                    className="w-full accent-indigo-600"
                />
                <p className="text-xs text-slate-500">
                    AI 将把更早的对话历史概括为一段摘要，仅保留最近的 {keepCount} 轮对话完整内容。
                    <br/>
                    {messageCount <= keepCount + 1 && (
                        <span className="text-amber-600 font-bold block mt-1">
                            当前轮数较少，点击整理将强制合并历史。
                        </span>
                    )}
                </p>
            </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-100 transition">取消</button>
            <button 
                onClick={() => { onCompress(keepCount); onClose(); }}
                disabled={isCompressing}
                className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition transform active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center gap-2"
            >
                {isCompressing ? <span className="animate-spin">⏳</span> : <span>🗜️</span>}
                {isCompressing ? '整理中...' : '立即整理记忆'}
            </button>
        </div>
      </div>
    </div>
  );
};