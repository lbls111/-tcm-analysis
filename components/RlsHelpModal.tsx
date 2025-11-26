import React from 'react';

interface RlsHelpModalProps {
  message: string;
  onClose: () => void;
}

export const RlsHelpModal: React.FC<RlsHelpModalProps> = ({ message, onClose }) => {
  const sqlMatch = message.match(/```sql\n([\s\S]*?)\n```/);
  const sqlCode = sqlMatch ? sqlMatch[1].trim() : '';

  const mainMessage = message.split('```sql')[0].trim();

  const copySqlToClipboard = () => {
    if (sqlCode) {
      navigator.clipboard.writeText(sqlCode);
      alert("SQL 代码已复制！请前往 Supabase Dashboard -> SQL Editor 粘贴并运行。");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
        <div 
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 border-4 border-red-500"
            onClick={e => e.stopPropagation()}
        >
            <div className="bg-red-600 text-white p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    操作失败：需要数据库权限
                </h3>
                <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">✕</button>
            </div>
            <div className="p-8 overflow-y-auto space-y-4">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{mainMessage}</p>
                
                {sqlCode && (
                    <div className="mt-4">
                        <div className="bg-slate-900 rounded-xl overflow-hidden mt-2 relative group">
                            <pre className="p-4 text-xs text-emerald-400 font-mono overflow-x-auto">
                                <code>{sqlCode}</code>
                            </pre>
                            <button 
                                onClick={copySqlToClipboard}
                                className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs backdrop-blur-md transition-colors"
                            >
                                复制代码
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 text-right">
                <button onClick={onClose} className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg transition-all">
                    我明白了
                </button>
            </div>
        </div>
    </div>
  );
};
