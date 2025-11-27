
import React, { useState } from 'react';
import { useLog } from '../contexts/LogContext';
import { LogEntry } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LogViewer: React.FC<Props> = ({ isOpen, onClose }) => {
  const { logs, clearLogs } = useLog();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>('ALL');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const modules = ['ALL', ...Array.from(new Set(logs.map(l => l.module)))];
  const filteredLogs = filterModule === 'ALL' ? logs : logs.filter(l => l.module === filterModule);

  const getLevelColor = (level: string) => {
    switch(level) {
        case 'error': return 'bg-red-100 text-red-800 border-red-200';
        case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'action': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handleCopyLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 font-mono">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xl">📟</span>
                    <h3 className="font-bold text-lg">系统事件日志 (System Event Log)</h3>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-slate-300">
                        Total: {logs.length}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCopyLogs} 
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition flex items-center gap-1"
                    >
                        {isCopied ? '✅ 已复制' : '📋 复制日志'}
                    </button>
                    <button onClick={clearLogs} className="text-xs bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded transition">
                        清空日志
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex gap-2 overflow-x-auto">
                {modules.map(m => (
                    <button
                        key={m}
                        onClick={() => setFilterModule(m)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                            filterModule === m 
                            ? 'bg-slate-800 text-white shadow-sm' 
                            : 'bg-white text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-2 space-y-1 custom-scrollbar">
                {filteredLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        暂无日志记录
                    </div>
                ) : (
                    filteredLogs.map(log => (
                        <div key={log.id} className="border border-slate-200 rounded bg-white shadow-sm overflow-hidden text-xs">
                            <div 
                                className={`flex items-center p-2 cursor-pointer hover:bg-slate-50 gap-3 ${expandedId === log.id ? 'bg-slate-50' : ''}`}
                                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                                <span className="text-slate-400 w-16 shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded border uppercase text-[10px] w-16 text-center font-bold shrink-0 ${getLevelColor(log.level)}`}>
                                    {log.level}
                                </span>
                                <span className="font-bold text-slate-700 w-24 shrink-0 truncate" title={log.module}>
                                    [{log.module}]
                                </span>
                                <span className="text-slate-800 truncate flex-1">
                                    {log.message}
                                </span>
                                {log.details && (
                                    <span className="text-indigo-600 font-bold shrink-0">
                                        {expandedId === log.id ? '▼' : '▶'} JSON
                                    </span>
                                )}
                            </div>
                            
                            {expandedId === log.id && log.details && (
                                <div className="p-4 bg-slate-900 text-emerald-400 border-t border-slate-200 overflow-x-auto">
                                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};
