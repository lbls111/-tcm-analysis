

import React, { useState, useMemo, useEffect } from 'react';
import { BenCaoHerb, AISettings } from '../types';
import { FULL_HERB_LIST, HERB_ALIASES, loadCustomHerbs } from '../data/herbDatabase'; 
import { BEN_CAO_NATURES, BEN_CAO_FLAVORS, BEN_CAO_PROCESSING } from '../data/benCaoData';
import { HerbDetailModal } from './HerbDetailModal';
import { EditHerbModal } from './EditHerbModal';
import { parseRawPharmacopoeiaText } from '../utils/pharmacopoeiaParser';
import { bulkUpsertHerbs, updateCloudHerb } from '../services/supabaseService';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from '../constants';

// Helper Component for Highlighting
const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  // Escape special regex chars
  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm px-0.5 mx-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const BenCaoDatabase: React.FC = () => {
  const [herbs, setHerbs] = useState<BenCaoHerb[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNature, setSelectedNature] = useState<string>('全部');
  const [selectedFlavor, setSelectedFlavor] = useState<string>('全部');
  const [selectedProcessing, setSelectedProcessing] = useState<string>('全部');
  const [selectedHerb, setSelectedHerb] = useState<BenCaoHerb | null>(null);
  
  // Edit Mode State
  const [editingHerb, setEditingHerb] = useState<BenCaoHerb | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Import Mode State
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedHerbs, setParsedHerbs] = useState<BenCaoHerb[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Sync with global list on initial load
  useEffect(() => {
    // Initial load from the global list, which is populated on app start
    setHerbs([...FULL_HERB_LIST]);
  }, []);

  const refreshHerbs = async () => {
      await loadCustomHerbs();
      setHerbs([...FULL_HERB_LIST]);
  };

  // Filter Logic
  const filteredHerbs = useMemo(() => {
    const cleanSearch = searchTerm.trim();
    const aliasTarget = HERB_ALIASES[cleanSearch] || cleanSearch;

    return herbs.filter(herb => {
      let matchName = herb.name.includes(cleanSearch);
      
      if (!matchName && aliasTarget !== cleanSearch) {
         matchName = herb.name.includes(aliasTarget);
      }
      
      const matchPinyin = (herb.pinyin && herb.pinyin.includes(cleanSearch.toLowerCase()));
      const matchEfficacy = (herb.efficacy && herb.efficacy.includes(cleanSearch));
      
      const matchSearch = matchName || matchPinyin || matchEfficacy;
      
      const matchNature = selectedNature === '全部' || herb.nature.includes(selectedNature);
      const matchFlavor = selectedFlavor === '全部' || herb.flavors.some(f => f.includes(selectedFlavor));
      
      let matchProcessing = true;
      if (selectedProcessing !== '全部') {
         if (selectedProcessing === '生用') {
             matchProcessing = !herb.processing || herb.processing === '生用';
         } else {
             matchProcessing = (herb.processing || '').includes(selectedProcessing.replace('炙', ''));
         }
      }

      return matchSearch && matchNature && matchFlavor && matchProcessing;
    });
  }, [herbs, searchTerm, selectedNature, selectedFlavor, selectedProcessing]);

  const getNatureColor = (nature: string) => {
    if (nature.includes('大热') || nature.includes('热') || nature.includes('温')) return 'text-red-600 bg-red-50 border-red-200';
    if (nature.includes('大寒') || nature.includes('寒') || nature.includes('凉')) return 'text-cyan-600 bg-cyan-50 border-cyan-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };
  
  const getSettings = (): AISettings => {
    const savedSettings = localStorage.getItem("logicmaster_ai_settings");
    let settings: AISettings = savedSettings ? JSON.parse(savedSettings) : {};
    if (!settings.supabaseUrl) settings.supabaseUrl = DEFAULT_SUPABASE_URL;
    if (!settings.supabaseKey) settings.supabaseKey = DEFAULT_SUPABASE_KEY;
    return settings;
  };

  const handleParse = () => {
     if (!importText.trim()) return;
     const results = parseRawPharmacopoeiaText(importText);
     setParsedHerbs(results);
     setImportError(null);
     if (results.length === 0) {
         alert("未能识别出有效数据。\n请确保文本包含【性味与归经】【功能主治】等标准药典标签。\n已自动过滤无医疗属性的条目(如前言、目录、图片说明)。");
     }
  };

  const handleUpload = async () => {
      if (parsedHerbs.length === 0) return;
      setIsUploading(true);
      setImportError(null);
      
      const settings = getSettings();
      const { success, failed, error } = await bulkUpsertHerbs(parsedHerbs, settings);
      
      setIsUploading(false);

      if (error && error.includes("Could not find the table")) {
          setImportError("上传失败：数据库中未找到 'herbs' 数据表。请先运行下方的初始化SQL代码创建数据表，然后再重新上传。");
          setShowSqlGuide(true);
          return;
      }
      
      alert(`导入完成！\n成功: ${success} 条\n失败: ${failed} 条\n注意：同名药材已覆盖更新。`);
      
      if (success > 0) {
          setShowImportModal(false);
          setImportText('');
          setParsedHerbs([]);
          await refreshHerbs();
      }
  };
  
  const handleEditHerb = (herb: BenCaoHerb, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setSelectedHerb(null); // Close detail modal if open
      setEditingHerb(herb);
  };
  
  const saveHerbChanges = async (updatedHerb: BenCaoHerb) => {
      setIsSaving(true);
      try {
        const settings = getSettings();
        const success = await updateCloudHerb(updatedHerb.id, updatedHerb, settings);
        if (success) {
            setEditingHerb(null);
            await refreshHerbs();
        } else {
            alert("保存失败，请检查网络连接或 Supabase 权限。");
        }
      } catch (e: any) {
          alert(`保存时发生错误: ${e.message}`);
      } finally {
          setIsSaving(false);
      }
  };

  const copySqlToClipboard = () => {
      const sql = `create table if not exists herbs (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  nature text,
  flavors jsonb,
  meridians jsonb,
  efficacy text,
  usage text,
  category text,
  processing text,
  is_raw boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table herbs enable row level security;
create policy "Public read access" on herbs for select using (true);
create policy "Public insert access" on herbs for insert with check (true);
create policy "Public update access" on herbs for update using (true);
create policy "Public delete access" on herbs for delete using (true);`;
      navigator.clipboard.writeText(sql);
      alert("SQL 代码已复制！请前往 Supabase Dashboard -> SQL Editor 粘贴运行。");
  };

  return (
    <div className="w-full h-full min-h-[80vh] flex flex-col gap-6 animate-in fade-in relative font-sans">
      
      {/* Header */}
      <div className="bg-[#fcfaf5] p-6 rounded-[2rem] border border-stone-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center mb-6 relative z-10">
          <div>
            <h2 className="text-3xl font-serif-sc font-black text-stone-800 flex items-center gap-3">
              <span className="w-12 h-12 bg-stone-800 text-amber-50 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-stone-200">药</span>
              中国药典数据库 (Cloud)
            </h2>
            <p className="text-stone-500 text-sm mt-2 ml-1 font-medium flex items-center gap-2">
              当前收录 <span className="text-amber-700 font-bold text-lg">{herbs.length}</span> 味药材 
              <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Supabase 实时同步
              </span>
            </p>
          </div>
          
          <div className="flex flex-col gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-80 group">
                <input 
                  type="text" 
                  placeholder="搜药名、别名、性味、功效..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all shadow-sm group-hover:border-stone-300"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-hover:text-stone-600 transition-colors">🔍</span>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500"
                  >✕</button>
                )}
             </div>
             <div className="flex items-center gap-2 self-start md:self-end">
                <button 
                    onClick={() => setShowImportModal(true)}
                    className="text-xs text-white font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-lg shadow-md shadow-indigo-200"
                >
                    <span>📥</span> 批量导入
                </button>
             </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 text-sm bg-white/60 p-3 rounded-xl border border-stone-100 backdrop-blur-sm relative z-10">
           <div className="flex items-center gap-2">
              <span className="font-bold text-stone-400 mr-1 text-xs">四气:</span>
              <select 
                value={selectedNature} 
                onChange={(e) => setSelectedNature(e.target.value)}
                className="bg-transparent font-bold border-b border-stone-200 px-2 py-1 outline-none focus:border-amber-500 text-stone-700 cursor-pointer hover:bg-stone-50 rounded"
              >
                <option value="全部">全部</option>
                {BEN_CAO_NATURES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
           </div>
           <div className="w-px h-4 bg-stone-300"></div>
           <div className="flex items-center gap-2">
              <span className="font-bold text-stone-400 mr-1 text-xs">五味:</span>
              <select 
                value={selectedFlavor} 
                onChange={(e) => setSelectedFlavor(e.target.value)}
                className="bg-transparent font-bold border-b border-stone-200 px-2 py-1 outline-none focus:border-amber-500 text-stone-700 cursor-pointer hover:bg-stone-50 rounded"
              >
                <option value="全部">全部</option>
                {BEN_CAO_FLAVORS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
           </div>
           <div className="w-px h-4 bg-stone-300"></div>
           <div className="flex items-center gap-2">
              <span className="font-bold text-stone-400 mr-1 text-xs">炮制:</span>
              <select 
                value={selectedProcessing} 
                onChange={(e) => setSelectedProcessing(e.target.value)}
                className="bg-transparent font-bold border-b border-stone-200 px-2 py-1 outline-none focus:border-amber-500 text-stone-700 cursor-pointer hover:bg-stone-50 rounded"
              >
                <option value="全部">全部</option>
                {BEN_CAO_PROCESSING.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
           </div>
           
           <div className="ml-auto flex items-center gap-2 text-xs text-stone-400">
             <span>Results:</span>
             <span className="bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md font-bold">{filteredHerbs.length}</span>
           </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
        {filteredHerbs.length > 0 ? filteredHerbs.map(herb => {
          const cleanDisplayName = herb.name.replace(/[^\u4e00-\u9fa5（）\(\)]/g, ''); 
          const isProcessed = herb.processing && herb.processing !== '生用';
          const isCloud = herb.source === 'cloud';
          
          return (
            <div 
              key={herb.id}
              onClick={() => setSelectedHerb(herb)}
              className={`group bg-white rounded-2xl border p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col h-56 ${isCloud ? 'border-emerald-100 hover:border-emerald-300' : 'border-stone-200 hover:border-amber-400'}`}
            >
              
              <div className="flex justify-between items-start mb-3">
                <div>
                   <div className="flex gap-1 mb-2">
                      {isCloud && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1">
                              ☁️ Cloud
                          </span>
                      )}
                      
                      {isProcessed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            {herb.processing}
                        </span>
                      )}
                   </div>
                   <h3 className="text-2xl font-black font-serif-sc text-stone-800 group-hover:text-amber-800 transition-colors tracking-tight">
                      <HighlightText text={cleanDisplayName} highlight={searchTerm} />
                   </h3>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold border ${getNatureColor(herb.nature)}`}>
                   {herb.nature}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mb-4">
                 {herb.flavors.map(f => (
                   <span key={f} className="text-xs bg-[#fdfbf7] text-stone-600 px-2 py-0.5 rounded-full border border-stone-200 font-serif-sc">{f}</span>
                 ))}
              </div>

              <div className="text-sm text-stone-500 leading-relaxed font-serif-sc flex-1 overflow-hidden relative">
                 <span className="line-clamp-2">
                   <HighlightText text={herb.efficacy || ''} highlight={searchTerm} />
                 </span>
                 <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-white to-transparent"></div>
              </div>

              <div className="flex flex-wrap gap-1 mt-4 pt-3 border-t border-dashed border-stone-100">
                 {herb.meridians.slice(0, 3).map(m => (
                   <span key={m} className="text-[10px] text-stone-400 font-bold px-1">{m}</span>
                 ))}
                 {herb.meridians.length > 3 && <span className="text-[10px] text-stone-400">...</span>}
              </div>
            </div>
          );
        }) : (
            <div className="col-span-full text-center py-20 text-stone-400">
                <div className="text-4xl mb-4">📭</div>
                <p>暂无数据，请点击右上角“导入”按钮添加药典数据。</p>
                <p className="text-xs mt-2">如果看到错误提示"Could not find table"，请点击导入窗口中的初始化按钮。</p>
            </div>
        )}
      </div>

      {/* Detail Modal with Edit/Delete Handlers */}
      {selectedHerb && (
        <HerbDetailModal 
            herb={selectedHerb} 
            onClose={() => setSelectedHerb(null)} 
            onEdit={(h) => handleEditHerb(h)}
            // onDelete is removed
        />
      )}
      
      {/* Edit Modal */}
      {editingHerb && (
        <EditHerbModal 
            herb={editingHerb} 
            onClose={() => setEditingHerb(null)} 
            onSave={saveHerbChanges}
            isSaving={isSaving}
        />
      )}
      
      {/* Import Modal */}
      {showImportModal && (
         <div className="fixed inset-0 z-[110] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
               <div className="bg-stone-900 text-white p-6 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-2xl font-bold font-serif-sc">药典数据批量导入工具</h3>
                        <p className="text-stone-400 text-sm mt-1">
                        智能文本清洗 · 自动提取核心字段 · 批量上传
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowSqlGuide(!showSqlGuide)}
                        className="px-3 py-1.5 rounded-lg border border-stone-600 text-stone-300 text-xs hover:bg-stone-800 hover:text-white transition-colors"
                      >
                        🛠️ 数据库初始化 (SQL)
                      </button>
                  </div>
                  <button onClick={() => setShowImportModal(false)} className="text-stone-400 hover:text-white text-2xl w-10 h-10 flex items-center justify-center bg-white/10 rounded-full">✕</button>
               </div>
               
               {showSqlGuide ? (
                   <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
                       <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                           {importError && (
                               <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold mb-6">
                                  {importError}
                               </div>
                           )}
                           <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                               <span>🗄️</span> 首次使用必读：数据库表结构初始化
                           </h3>
                           <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                               如果您在控制台看到 <code className="bg-red-50 text-red-600 px-1 rounded">Could not find the table 'public.herbs'</code> 错误，说明您的 Supabase 项目中尚未创建数据表。请复制以下 SQL 代码，并在 Supabase 的 SQL Editor 中运行。
                           </p>
                           <div className="bg-slate-900 rounded-xl overflow-hidden mb-6 relative group">
                               <pre className="p-4 text-xs text-emerald-400 font-mono overflow-x-auto custom-scrollbar">
{`create table if not exists herbs (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  nature text,
  flavors jsonb,
  meridians jsonb,
  efficacy text,
  usage text,
  category text,
  processing text,
  is_raw boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 开启安全策略 (RLS)
alter table herbs enable row level security;

-- 允许所有人读取/写入/删除 (根据需求调整)
create policy "Public read access" on herbs for select using (true);
create policy "Public insert access" on herbs for insert with check (true);
create policy "Public update access" on herbs for update using (true);
create policy "Public delete access" on herbs for delete using (true);`}
                               </pre>
                               <button 
                                 onClick={copySqlToClipboard}
                                 className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs backdrop-blur-md transition-colors"
                               >
                                 复制代码
                               </button>
                           </div>
                           <div className="flex justify-center">
                               <button onClick={() => setShowSqlGuide(false)} className="text-indigo-600 font-bold hover:underline text-sm">
                                   ← 返回导入界面
                               </button>
                           </div>
                       </div>
                   </div>
               ) : (
               <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  {/* Left: Input */}
                  <div className="w-full md:w-1/2 p-6 flex flex-col border-r border-stone-200 bg-stone-50">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-stone-700">1. 粘贴原始文本 (Raw Text)</label>
                        <span className="text-xs text-stone-400">支持粘贴整章内容</span>
                      </div>
                      <textarea 
                         className="flex-1 w-full p-4 bg-white border border-stone-300 rounded-xl font-mono text-xs resize-none focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner leading-relaxed"
                         placeholder="在此粘贴《中国药典》的文本内容。例如：
【性状】...
【鉴别】...
【性味与归经】...
【功能与主治】...
..."
                         value={importText}
                         onChange={e => setImportText(e.target.value)}
                      />
                      <button 
                         onClick={handleParse}
                         disabled={!importText.trim()}
                         className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
                      >
                         🔍 智能识别与清洗
                      </button>
                  </div>
                  
                  {/* Right: Preview */}
                  <div className="w-full md:w-1/2 p-6 flex flex-col bg-white">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-stone-700">2. 清洗结果预览 (Preview)</label>
                        <div className="text-xs font-mono">
                            {parsedHerbs.length > 0 ? (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                    已识别 {parsedHerbs.length} 条有效数据
                                </span>
                            ) : (
                                <span className="text-stone-400">等待解析...</span>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto border border-stone-200 rounded-xl bg-stone-50 p-2 custom-scrollbar">
                          {parsedHerbs.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-stone-300 text-sm italic space-y-2">
                                 <div className="text-4xl">📄</div>
                                 <div>请在左侧粘贴文本并点击解析</div>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {parsedHerbs.map((h, i) => (
                                      <div key={i} className="p-4 border border-stone-200 rounded-xl bg-white shadow-sm hover:border-indigo-300 transition-all group">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="flex items-center gap-2">
                                                  <span className="font-bold text-stone-800 text-lg">{h.name}</span>
                                                  {h.category && <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{h.category}</span>}
                                              </div>
                                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getNatureColor(h.nature)}`}>{h.nature}</span>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-1 mb-2">
                                              {h.flavors.map(f => <span key={f} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">{f}</span>)}
                                              {h.meridians.map(m => <span key={m} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">{m}</span>)}
                                          </div>
                                          
                                          <div className="text-xs text-stone-500 line-clamp-2 group-hover:line-clamp-none transition-all">
                                              <span className="font-bold text-stone-700">功能：</span>{h.efficacy}
                                          </div>
                                          <div className="text-xs text-stone-400 mt-1 truncate">
                                              <span className="font-bold text-stone-600">用法：</span>{h.usage}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                      
                      <button 
                         onClick={handleUpload}
                         disabled={parsedHerbs.length === 0 || isUploading}
                         className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all flex justify-center items-center gap-2"
                      >
                         {isUploading ? (
                             <>
                               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                               <span>正在写入云数据库...</span>
                             </>
                         ) : (
                             <>
                               <span>🚀</span> 确认并批量上传至云端
                             </>
                         )}
                      </button>
                  </div>
               </div>
               )}
            </div>
         </div>
      )}
    </div>
  );
};

export default BenCaoDatabase;