
import React, { useMemo } from 'react';
import { BenCaoHerb } from '../types';
import { FULL_HERB_LIST } from '../data/herbDatabase';
import { COMMON_PAIRS } from '../utils/tcmMath';

interface HerbDetailModalProps {
  herb: BenCaoHerb;
  onClose: () => void;
  onEdit?: (herb: BenCaoHerb) => void;
  onSwitch?: (herbName: string) => void;
}

export const HerbDetailModal: React.FC<HerbDetailModalProps> = ({ herb, onClose, onEdit, onSwitch }) => {

  const getNatureColor = (nature: string) => {
    if (nature.includes('大热') || nature.includes('热') || nature.includes('温')) return 'text-red-600 bg-red-50 border-red-200';
    if (nature.includes('大寒') || nature.includes('寒') || nature.includes('凉')) return 'text-cyan-600 bg-cyan-50 border-cyan-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const relations = useMemo(() => {
      // 1. Variants (Name inclusion)
      const variants = FULL_HERB_LIST.filter(h => 
          h.name !== herb.name && 
          (h.name.includes(herb.name) || (herb.name.length > 1 && herb.name.includes(h.name)))
      ).slice(0, 5);

      // 2. Pairs (From Common Pairs)
      const pairs = COMMON_PAIRS
          .filter(p => p.names.includes(herb.name))
          .map(p => {
              const partnerName = p.names.find(n => n !== herb.name) || '';
              return { partner: partnerName, label: p.label, effect: p.effect };
          });

      // 3. Similar (Scoring)
      const similar = FULL_HERB_LIST
          .filter(h => h.name !== herb.name && !variants.includes(h))
          .map(h => {
              let score = 0;
              // Same nature (fuzzy)
              if (h.nature[h.nature.length-1] === herb.nature[herb.nature.length-1]) score += 2;
              // Shared flavors
              const sharedFlavors = h.flavors.filter(f => herb.flavors.includes(f));
              score += sharedFlavors.length;
              // Shared meridians
              const sharedMeridians = h.meridians.filter(m => herb.meridians.includes(m));
              score += sharedMeridians.length;
              return { herb: h, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map(item => item.herb);

      return { variants, pairs, similar };
  }, [herb]);

  return (
    <div className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-4 md:p-8" onClick={onClose}>
      <div 
        className="bg-[#fdfbf7] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 border border-stone-200"
        onClick={e => e.stopPropagation()}
      >
         {/* Modal Header */}
         <div className="bg-stone-900 text-amber-50 p-8 flex justify-between items-start relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-30"></div>
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-3 mb-3">
                 <span className="bg-amber-900/80 text-amber-100 text-xs px-2 py-1 rounded border border-amber-800 font-bold tracking-wider">{herb.category || '药材'}</span>
                 {herb.processing && herb.processing !== '生用' && <span className="bg-rose-900 text-rose-100 text-xs px-2 py-1 rounded border border-rose-800 font-bold">炮制: {herb.processing}</span>}
                 {herb.parentHerb && <span className="bg-stone-700 text-stone-200 text-xs px-2 py-1 rounded border border-stone-600">基原: {herb.parentHerb}</span>}
                 <span className="text-stone-500 font-mono text-xs uppercase tracking-widest">NO. {herb.id.slice(0,8)}</span>
              </div>
              <h2 className="text-5xl font-black font-serif-sc tracking-wide text-amber-50 drop-shadow-sm">{herb.name}</h2>
            </div>
            
            {/* Actions */}
            <div className="relative z-10 flex items-center gap-3">
                {onEdit && (
                <button 
                    onClick={() => onEdit(herb)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-100 hover:text-white border border-indigo-500/30 transition-all text-sm font-bold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    修改
                </button>
                )}
                <div className="w-px h-8 bg-white/20 mx-2"></div>
                <button onClick={onClose} className="text-stone-500 hover:text-white text-3xl transition-colors bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center">✕</button>
            </div>
         </div>

         {/* Modal Body */}
         <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
            
            {/* Properties Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
               <div className="border-r border-stone-100 pr-4">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-wider">四气 Nature</div>
                  <div className={`font-bold text-xl font-serif-sc ${getNatureColor(herb.nature).split(' ')[0]}`}>{herb.nature}</div>
               </div>
               <div className="border-r border-stone-100 pr-4">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-wider">五味 Flavor</div>
                  <div className="font-bold text-stone-800 text-xl font-serif-sc">{herb.flavors.join(' ')}</div>
               </div>
               <div className="col-span-2 pl-2">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1 tracking-wider">归经 Meridians</div>
                  <div className="flex flex-wrap gap-2">
                    {herb.meridians.map(m => (
                        <span key={m} className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-sm font-bold">{m}</span>
                    ))}
                  </div>
               </div>
            </div>

            {/* Efficacy & Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <h3 className="text-stone-900 font-bold border-l-4 border-amber-600 pl-4 mb-3 text-lg font-serif-sc flex items-center gap-2">
                        功能主治
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 font-normal">2025药典</span>
                    </h3>
                    <p className="text-stone-700 leading-loose text-lg text-justify font-serif-sc bg-white p-6 rounded-xl border border-stone-100 shadow-inner">
                        {herb.efficacy}
                    </p>
                </div>
                
                <div>
                    <h3 className="text-stone-900 font-bold border-l-4 border-stone-400 pl-4 mb-3 text-lg font-serif-sc">
                        用法用量
                    </h3>
                    <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 text-stone-800 font-serif-sc leading-relaxed">
                        {herb.usage || '暂无数据'}
                    </div>
                </div>
            </div>

            {herb.classicContent && (
              <div className="relative group my-8">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-amber-800/20 rounded-full"></div>
                <div className="pl-6">
                    <h3 className="text-amber-800 font-bold mb-4 text-sm uppercase tracking-widest">备注 / 原文</h3>
                    <div className="relative">
                        <span className="absolute -top-4 -left-4 text-6xl text-stone-200 font-serif-sc z-0">“</span>
                        <p className="relative z-10 italic font-serif-sc text-xl text-stone-800 leading-loose indent-8">
                              {herb.classicContent}
                        </p>
                        <span className="absolute -bottom-8 right-0 text-6xl text-stone-200 font-serif-sc z-0">”</span>
                    </div>
                </div>
              </div>
            )}

            {/* Related Herbs Section */}
            {(relations.variants.length > 0 || relations.pairs.length > 0 || relations.similar.length > 0) && (
                <div className="pt-8 border-t border-stone-200">
                    <h3 className="text-stone-800 font-bold text-lg mb-6 flex items-center gap-2">
                        <span className="text-xl">🔗</span> 关联药材
                    </h3>
                    
                    <div className="space-y-6">
                        {/* 1. Variants/Processed */}
                        {relations.variants.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">同源 / 炮制</span>
                                <div className="flex flex-wrap gap-2">
                                    {relations.variants.map(h => (
                                        <button 
                                            key={h.id}
                                            onClick={() => onSwitch && onSwitch(h.name)}
                                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 text-sm font-bold transition-colors"
                                        >
                                            {h.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Pairs */}
                        {relations.pairs.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">经典药对</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {relations.pairs.map(p => (
                                        <div key={p.partner} className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl hover:border-indigo-300 transition-all cursor-pointer" onClick={() => onSwitch && onSwitch(p.partner)}>
                                            <span className="text-2xl">🤝</span>
                                            <div>
                                                <div className="font-bold text-indigo-900 text-sm">{p.label} (配{p.partner})</div>
                                                <div className="text-xs text-indigo-600/80">{p.effect}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Similar */}
                        {relations.similar.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">性味相近 / 可替换</span>
                                <div className="flex flex-wrap gap-2">
                                    {relations.similar.map(h => (
                                        <button 
                                            key={h.id}
                                            onClick={() => onSwitch && onSwitch(h.name)}
                                            className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-600 rounded-lg border border-stone-200 hover:border-stone-300 text-sm transition-colors flex items-center gap-2"
                                        >
                                            <span>{h.name}</span>
                                            <span className={`w-2 h-2 rounded-full ${getNatureColor(h.nature).split(' ')[1]}`}></span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};
