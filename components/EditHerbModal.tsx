
import React, { useState } from 'react';
import { BenCaoHerb, AISettings } from '../types';
import { BEN_CAO_NATURES, BEN_CAO_FLAVORS, BEN_CAO_PROCESSING } from '../data/benCaoData';
import { generateHerbDataWithAI } from '../services/openaiService';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from '../constants';

interface Props {
  herb: BenCaoHerb;
  onClose: () => void;
  onSave: (updatedHerb: BenCaoHerb) => Promise<void>;
  isSaving: boolean;
}

export const EditHerbModal: React.FC<Props> = ({ herb, onClose, onSave, isSaving }) => {
  const [formData, setFormData] = useState<BenCaoHerb>({ ...herb });
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleSave = () => {
    onSave(formData);
  };

  const toggleFlavor = (flavor: string) => {
    const currentFlavors = formData.flavors;
    if (currentFlavors.includes(flavor)) {
      setFormData({ ...formData, flavors: currentFlavors.filter(f => f !== flavor) });
    } else {
      setFormData({ ...formData, flavors: [...currentFlavors, flavor] });
    }
  };

  const handleAiAutoFill = async () => {
      const savedSettings = localStorage.getItem("logicmaster_ai_settings");
      let settings: AISettings = savedSettings ? JSON.parse(savedSettings) : {};
      
      if (!settings.apiKey) {
          alert("请先在首页配置 API Key，才能使用 AI 补全功能。");
          return;
      }

      setIsAiLoading(true);
      try {
          const aiData = await generateHerbDataWithAI(formData.name, settings);
          if (aiData) {
              setFormData({
                  ...formData,
                  nature: aiData.nature,
                  flavors: aiData.flavors,
                  meridians: aiData.meridians,
                  efficacy: aiData.efficacy,
                  usage: aiData.usage,
                  category: aiData.category,
                  processing: aiData.processing
              });
              alert(`AI 补全成功！\n已更新【${formData.name}】的性味、归经与功能主治。\n请特别检查炮制品的功效描述。`);
          } else {
              alert("AI 无法生成数据，请检查药名是否正确。");
          }
      } catch (e: any) {
          alert(`AI 请求失败: ${e.message}`);
      } finally {
          setIsAiLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-indigo-600 text-white p-6 flex justify-between items-center">
           <h3 className="text-xl font-bold flex items-center gap-2">
             <span>✏️</span> 编辑药材数据
           </h3>
           <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
           {/* Name & Category */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">药名 (Name)</label>
                 <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={formData.name} 
                       onChange={e => setFormData({...formData, name: e.target.value})}
                       className="flex-1 p-3 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                     />
                     <button
                        onClick={handleAiAutoFill}
                        disabled={isAiLoading || !formData.name}
                        className="px-3 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="使用 AI 根据药名自动填充所有字段"
                     >
                        {isAiLoading ? <span className="animate-spin">⏳</span> : '✨'} AI补全
                     </button>
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">分类/来源 (Category)</label>
                 <input 
                   type="text" 
                   value={formData.category || ''} 
                   onChange={e => setFormData({...formData, category: e.target.value})}
                   className="w-full p-3 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
              </div>
           </div>

           {/* Nature & Processing */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">四气 (Nature)</label>
                 <select 
                   value={formData.nature} 
                   onChange={e => setFormData({...formData, nature: e.target.value})}
                   className="w-full p-3 border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                    {BEN_CAO_NATURES.map(n => <option key={n} value={n}>{n}</option>)}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1">炮制 (Processing)</label>
                 <select 
                   value={formData.processing || '生用'} 
                   onChange={e => setFormData({...formData, processing: e.target.value})}
                   className="w-full p-3 border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                    {BEN_CAO_PROCESSING.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
              </div>
           </div>

           {/* Flavors */}
           <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">五味 (Flavors)</label>
              <div className="flex flex-wrap gap-2">
                 {BEN_CAO_FLAVORS.map(f => (
                    <button
                      key={f}
                      onClick={() => toggleFlavor(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        formData.flavors.includes(f) 
                          ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f}
                    </button>
                 ))}
              </div>
           </div>

           {/* Meridians */}
           <div>
               <label className="block text-xs font-bold text-slate-500 mb-1">归经 (Meridians - 逗号分隔)</label>
               <input 
                  type="text" 
                  value={formData.meridians.join(', ')} 
                  onChange={e => setFormData({...formData, meridians: e.target.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean)})}
                  className="w-full p-3 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="例如: 肝, 肾"
               />
           </div>

           {/* Efficacy */}
           <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">功能主治 (Efficacy)</label>
              <textarea 
                 value={formData.efficacy}
                 onChange={e => setFormData({...formData, efficacy: e.target.value})}
                 className="w-full p-3 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                 placeholder="简述功效..."
              />
           </div>

           {/* Usage */}
           <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">用法用量 (Usage)</label>
              <input 
                 type="text"
                 value={formData.usage || ''}
                 onChange={e => setFormData({...formData, usage: e.target.value})}
                 className="w-full p-3 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                 placeholder="例如: 3~9g"
              />
           </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-4 bg-slate-50">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-200 font-bold transition-colors">取消</button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg transition-all flex items-center gap-2"
            >
              {isSaving ? '保存中...' : '保存修改'}
            </button>
        </div>
      </div>
    </div>
  );
};
