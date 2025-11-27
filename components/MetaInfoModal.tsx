
import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  metaInfo: string;
  onSave: (info: string) => Promise<void> | void;
}

export const MetaInfoModal: React.FC<Props> = ({ isOpen, onClose, metaInfo, onSave }) => {
  const [localInfo, setLocalInfo] = useState(metaInfo);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalInfo(metaInfo);
  }, [metaInfo, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await onSave(localInfo);
        onClose();
    } catch (e) {
        console.error("Failed to save meta info", e);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div 
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 flex justify-between items-center border-b border-amber-100">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-xl shadow-sm">🧠</div>
             <div>
               <h3 className="text-xl font-bold text-amber-900">研讨元信息 (Context)</h3>
               <p className="text-amber-700/60 text-xs font-medium">设定AI问答的背景上下文</p>
             </div>
           </div>
           <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-slate-500 transition">✕</button>
        </div>

        <div className="p-6 bg-white space-y-4">
            <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm border border-blue-100 flex gap-3">
                <span className="text-lg">ℹ️</span>
                <div>
                    <strong>什么是元信息？</strong>
                    <p className="mt-1 opacity-80">
                        在此输入患者的四诊信息（如脉象、舌苔）、主诉、既往病史、体质特征或季节环境等。
                        <br/>
                        AI 在回答问题时，将<strong>强制引用</strong>此处的上下文。AI 也可以根据对话内容<strong>自动更新</strong>此信息。
                    </p>
                </div>
            </div>

            <textarea
                value={localInfo}
                onChange={(e) => setLocalInfo(e.target.value)}
                placeholder="例如：患者女性，45岁，主诉失眠多梦，舌红少苔，脉细数。既往有甲亢病史..."
                className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none resize-none text-base leading-relaxed custom-scrollbar"
            />
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-100 transition">取消</button>
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 transition transform active:scale-95 flex items-center gap-2 disabled:bg-amber-300 disabled:cursor-not-allowed"
            >
                {isSaving ? <span className="animate-spin">⏳</span> : <span>💾</span>}
                {isSaving ? '同步中...' : '保存并同步'}
            </button>
        </div>
      </div>
    </div>
  );
};
