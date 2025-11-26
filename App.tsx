
import React, { useState, useEffect, useRef } from 'react';
import { analyzePrescriptionWithAI, generateHerbDataWithAI, DEFAULT_ANALYZE_SYSTEM_INSTRUCTION } from './services/openaiService';
import { calculatePrescription, getPTILabel } from './utils/tcmMath';
import { parsePrescription } from './utils/prescriptionParser';
import { AnalysisResult, ViewMode, Constitution, AdministrationMode, BenCaoHerb, AISettings } from './types';
import { QiFlowVisualizer } from './components/QiFlowVisualizer';
import BenCaoDatabase from './components/BenCaoDatabase';
import { HerbDetailModal } from './components/HerbDetailModal';
import { AIChatbot } from './components/AIChatbot';
import { AISettingsModal } from './components/AISettingsModal';
import { FULL_HERB_LIST, registerDynamicHerb } from './data/herbDatabase';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from './constants';

const PRESET_PRESCRIPTION = "";
const LS_REPORTS_KEY = "logicmaster_reports";
const LS_SETTINGS_KEY = "logicmaster_settings";
const LS_AI_SETTINGS_KEY = "logicmaster_ai_settings";
const DEFAULT_API_URL = "https://lbls888-lap.hf.space/v1";

const sortVersions = (versions: string[]) => {
  return versions.sort((a, b) => {
    const numA = parseInt(a.replace(/^V/, '')) || 0;
    const numB = parseInt(b.replace(/^V/, '')) || 0;
    return numA - numB;
  });
};

function App() {
  const [view, setView] = useState<ViewMode>(ViewMode.INPUT);
  const [input, setInput] = useState(PRESET_PRESCRIPTION);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoFillingHerb, setAutoFillingHerb] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [activeReportVersion, setActiveReportVersion] = useState<string>('V1');
  const [isReportIncomplete, setIsReportIncomplete] = useState(false);
  
  // Removed hardcoded constitution and adminMode constants as per user request
  
  const [fontSettings, setFontSettings] = useState({
    family: 'font-serif-sc', 
    scale: 1.0,
    theme: 'light' 
  });
  const [aiSettings, setAiSettings] = useState<AISettings>({
    apiKey: '',
    apiBaseUrl: DEFAULT_API_URL,
    analysisModel: 'gpt-4o',
    chatModel: 'gpt-3.5-turbo',
    availableModels: [],
    systemInstruction: DEFAULT_ANALYZE_SYSTEM_INSTRUCTION,
    temperature: 0,
    topK: 64,
    topP: 0.95,
    maxTokens: 8192,
    thinkingBudget: 0,
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseKey: DEFAULT_SUPABASE_KEY
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAISettingsModal, setShowAISettingsModal] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [initialDosageRef, setInitialDosageRef] = useState<number | null>(null);
  const [viewingHerb, setViewingHerb] = useState<BenCaoHerb | null>(null);
  
  // Abort Controller for stopping AI generation
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const savedReports = localStorage.getItem(LS_REPORTS_KEY);
    if (savedReports) {
      try {
        const parsedReports = JSON.parse(savedReports);
        if (parsedReports && typeof parsedReports === 'object' && Object.keys(parsedReports).length > 0) {
          setReports(parsedReports);
          const sortedVersions = sortVersions(Object.keys(parsedReports));
          setActiveReportVersion(sortedVersions[sortedVersions.length - 1] || 'V1');
        }
      } catch (e) {
        localStorage.removeItem(LS_REPORTS_KEY);
      }
    }

    const savedSettings = localStorage.getItem(LS_SETTINGS_KEY);
    if (savedSettings) {
      try {
        setFontSettings(JSON.parse(savedSettings));
      } catch (e) {}
    }
    
    const savedAISettings = localStorage.getItem(LS_AI_SETTINGS_KEY);
    if (savedAISettings) {
      try {
        const parsed = JSON.parse(savedAISettings);
        setAiSettings({
          apiKey: parsed.apiKey || '',
          apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_URL,
          analysisModel: parsed.analysisModel || 'gpt-4o',
          chatModel: parsed.chatModel || 'gpt-3.5-turbo',
          availableModels: parsed.availableModels || [],
          systemInstruction: DEFAULT_ANALYZE_SYSTEM_INSTRUCTION, 
          temperature: parsed.temperature ?? 0,
          topK: parsed.topK ?? 64,
          topP: parsed.topP ?? 0.95,
          maxTokens: parsed.maxTokens ?? 8192,
          thinkingBudget: parsed.thinkingBudget ?? 0,
          supabaseUrl: parsed.supabaseUrl || DEFAULT_SUPABASE_URL,
          supabaseKey: parsed.supabaseKey || DEFAULT_SUPABASE_KEY
        });
      } catch(e) {
        console.warn("Failed to parse saved AI settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (Object.keys(reports).length > 0) {
      localStorage.setItem(LS_REPORTS_KEY, JSON.stringify(reports));
    } else {
      localStorage.removeItem(LS_REPORTS_KEY);
    }
  }, [reports]);

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(fontSettings));
  }, [fontSettings]);
  
  useEffect(() => {
    localStorage.setItem(LS_AI_SETTINGS_KEY, JSON.stringify(aiSettings));
  }, [aiSettings]);
  
  useEffect(() => {
    if (view === ViewMode.REPORT && reports[activeReportVersion]) {
        const currentReport = reports[activeReportVersion];
        const isComplete = currentReport.trim().endsWith('</html>');
        setIsReportIncomplete(!isComplete);
    } else {
        setIsReportIncomplete(false);
    }
  }, [activeReportVersion, reports, view]);

  const handleStartCalculation = () => {
    try {
      const herbs = parsePrescription(input);
      // Removed adminMode and constitution arguments
      const result = calculatePrescription(herbs);
      setAnalysis(result);
      setInitialDosageRef(result.initialTotalDosage); 
      setView(ViewMode.WORKSHOP);
    } catch (e) {
      console.error(e);
      alert("计算出错，请检查输入格式");
    }
  };
  
  const handleStopAI = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setAiLoading(false);
          // Optional: Add a message indicating stopped
          setReports(prev => {
              const current = prev[activeReportVersion] || '';
              return { ...prev, [activeReportVersion]: current + "\n\n<!-- 生成已由用户手动停止 -->" };
          });
      }
  };

  const handleAskAI = async (regenerateInstructions?: string) => {
    if (!analysis) return;

    if (!aiSettings.apiKey) {
      alert("请先点击右上角设置图标，配置 API Key 和 模型参数。");
      setShowAISettingsModal(true);
      return;
    }

    setView(ViewMode.REPORT);
    setAiLoading(true);
    setAiError(null);

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const newVersionKey = `V${Object.keys(reports).length + 1}`;
    setActiveReportVersion(newVersionKey);
    setReports(prev => ({ ...prev, [newVersionKey]: '' })); // Initialize for streaming

    try {
      const stream = analyzePrescriptionWithAI(
        analysis,
        input,
        aiSettings,
        regenerateInstructions,
        undefined,
        controller.signal
      );

      let htmlContent = '';
      for await (const chunk of stream) {
        htmlContent += chunk;
        setReports(prev => ({ ...prev, [newVersionKey]: htmlContent }));
      }

      const isComplete = htmlContent.trim().endsWith('</html>');
      setIsReportIncomplete(!isComplete);

    } catch (err: any) {
      if (err.name === 'AbortError') {
          console.log('AI generation aborted by user');
          return;
      }
      console.error(err);
      setAiError(err.message || "请求 AI 时发生未知错误");
      setReports(prev => {
        const newReports = { ...prev };
        delete newReports[newVersionKey];
        const remainingKeys = Object.keys(newReports);
        if (remainingKeys.length > 0) {
          setActiveReportVersion(sortVersions(remainingKeys)[remainingKeys.length - 1]);
        }
        return newReports;
      });
    } finally {
      setAiLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleContinueAI = async () => {
    if (!analysis || !reports[activeReportVersion] || !isReportIncomplete || aiLoading) return;

    setAiLoading(true);
    setAiError(null);
    
    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const partialReport = reports[activeReportVersion];
      
      const stream = analyzePrescriptionWithAI(
        analysis,
        input,
        aiSettings,
        undefined,
        partialReport,
        controller.signal
      );

      let finalContent = partialReport;
      for await (const chunk of stream) {
        finalContent += chunk;
        setReports(prev => ({ ...prev, [activeReportVersion]: finalContent }));
      }
      
      const isNowComplete = finalContent.trim().endsWith('</html>');
      setIsReportIncomplete(!isNowComplete);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('AI continuation aborted by user');
        return;
      }
      console.error(err);
      setAiError(err.message || "续写报告时发生错误。");
    } finally {
      setAiLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleAutoFillHerb = async (herbName: string) => {
     if (!aiSettings.apiKey) {
         alert("AI补全需要配置API Key。");
         setShowAISettingsModal(true);
         return;
     }

     setAutoFillingHerb(herbName);
     try {
         const newHerbData = await generateHerbDataWithAI(herbName, aiSettings);
         if (newHerbData) {
             registerDynamicHerb(newHerbData, true);
             alert(`✨ 成功！AI 已生成【${herbName}】的数据。\n性味：${newHerbData.nature} | ${newHerbData.flavors.join(',')}\n归经：${newHerbData.meridians.join(',')}`);
             handleStartCalculation();
         } else {
             alert("AI 无法生成该药材的数据。");
         }
     } catch (e: any) {
         alert(`补全失败: ${e.message}`);
     } finally {
         setAutoFillingHerb(null);
     }
  };
  
  const handleUpdatePrescriptionFromChat = (newPrescription: string) => {
    setInput(newPrescription);
    try {
      const herbs = parsePrescription(newPrescription);
      const result = calculatePrescription(herbs); // Removed params
      setAnalysis(result);
      setInitialDosageRef(result.initialTotalDosage);
    } catch (e) {
      console.error(e);
      alert("AI提供的处方格式无法解析。请重试或手动修改。");
    }
  };

  const handleCopyHtml = () => {
    const activeReportHtml = reports[activeReportVersion];
    if (!activeReportHtml) return;
    
    navigator.clipboard.writeText(activeReportHtml).then(() => {
      alert("已复制 HTML 源代码到剪贴板！");
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleDeleteReportVersion = () => {
    if (!activeReportVersion || !reports[activeReportVersion]) return;
  
    const newReports = { ...reports };
    delete newReports[activeReportVersion];
    
    setReports(newReports);
  
    const remainingVersions = Object.keys(newReports);
    if (remainingVersions.length > 0) {
      const sorted = sortVersions(remainingVersions);
      setActiveReportVersion(sorted[sorted.length - 1]); 
    } else {
      setActiveReportVersion('');
      setIsReportIncomplete(false);
    }
  };

  const handleHerbClick = (herbName: string, mappedFrom?: string) => {
    let found = FULL_HERB_LIST.find(h => h.name === herbName);
    if (!found && mappedFrom) {
        found = FULL_HERB_LIST.find(h => h.name === mappedFrom);
    }
    if (!found) {
        found = FULL_HERB_LIST.find(h => herbName.startsWith(h.name) || h.name.startsWith(herbName));
    }

    if (found) {
        setViewingHerb(found);
    } else {
        alert(`在药典数据库中未找到【${herbName}】的详细条目。`);
    }
  };

  const getTempBadgeStyle = (temp: string) => {
    if (temp.includes('大热') || temp.includes('热')) return 'bg-red-100 text-red-800 border-red-200';
    if (temp.includes('温')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (temp.includes('寒')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (temp.includes('凉')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const renderCalculationTable = (targetAnalysis: AnalysisResult) => {
    if (!targetAnalysis) return null;

    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg bg-white mt-4">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">药名 (Herb)</th>
              <th className="px-6 py-4 text-right">剂量 (g)</th>
              <th className="px-6 py-4 text-center">HV(修正)</th>
              <th className="px-6 py-4 text-right">PTI</th>
              <th className="px-6 py-4 text-right text-slate-400">向量(Vector)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {targetAnalysis.herbs.map((h) => {
              const isLinked = !!h.staticData;
              return (
                <tr key={h.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-6 py-3 font-bold text-slate-800">
                     <div 
                        className={`flex flex-col ${isLinked ? 'cursor-pointer group' : ''}`}
                        onClick={() => isLinked && handleHerbClick(h.name, h.mappedFrom)}
                     >
                        <div className="flex items-center gap-2">
                           <span className={`${isLinked ? 'text-indigo-900 group-hover:text-indigo-600 group-hover:underline' : 'text-slate-800'}`}>
                             {h.name}
                           </span>
                           {isLinked && (
                             <span className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                               药典
                             </span>
                           )}
                        </div>
                        {h.mappedFrom && h.mappedFrom !== h.name && (
                           <span className="text-[10px] text-slate-400 mt-0.5">
                             输入: {h.mappedFrom}
                           </span>
                        )}
                        {!isLinked && (
                             <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[10px] text-red-400 flex items-center gap-1">⚠️ 未收录</span>
                                 <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAutoFillHerb(h.name);
                                    }}
                                    disabled={autoFillingHerb === h.name}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] px-2 py-0.5 rounded shadow-sm transition-all flex items-center gap-1"
                                 >
                                    {autoFillingHerb === h.name ? '⏳ 补全中...' : '✨ AI 补全'}
                                 </button>
                             </div>
                        )}
                     </div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">
                    {h.dosageGrams}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTempBadgeStyle(h.displayTemperature)}`}>
                      {h.displayTemperature} ({h.hvCorrected.toFixed(1)})
                    </span>
                  </td>
                  <td className={`px-6 py-3 text-right font-mono font-bold ${h.ptiContribution > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {h.ptiContribution > 0 ? '+' : ''}{h.ptiContribution.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-xs text-slate-500">
                     X:{h.vector.x.toFixed(1)} / Y:{h.vector.y.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div 
      className={`min-h-screen w-full flex flex-col relative bg-slate-50 text-slate-900 ${fontSettings.family}`}
      style={{ fontSize: `${fontSettings.scale}rem` }}
    >
      {viewingHerb && (
          <HerbDetailModal 
             herb={viewingHerb} 
             onClose={() => setViewingHerb(null)}
             onEdit={() => {}}
          />
      )}
      
      <AISettingsModal 
          isOpen={showAISettingsModal}
          onClose={() => setShowAISettingsModal(false)}
          settings={aiSettings}
          onSave={setAiSettings}
      />

      {view !== ViewMode.INPUT && (
        <header className="fixed top-0 z-50 w-full h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
              setView(ViewMode.INPUT);
              setInitialDosageRef(null);
            }}>
             <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md">L</div>
             <span className="font-bold text-lg font-serif-sc text-slate-800">LogicMaster</span>
          </div>
          
          <nav className="hidden lg:flex bg-slate-100 rounded-full p-1">
            {[
              { id: ViewMode.WORKSHOP, label: '计算工坊' },
              { id: ViewMode.VISUAL, label: '三焦动力学' },
              { id: ViewMode.REPORT, label: 'AI 深度推演' },
              { id: ViewMode.AI_CHAT, label: 'AI 问答' },
              { id: ViewMode.DATABASE, label: '中华药典' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  view === tab.id 
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
             <button 
                onClick={() => setShowAISettingsModal(true)}
                className="p-2 rounded-lg transition-colors bg-indigo-50 border border-transparent text-indigo-600 hover:bg-indigo-100 hover:border-indigo-200"
                title="API 及模型设置"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.077-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
             </button>

             <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-transparent text-slate-500 hover:bg-slate-100'}`}
                  title="外观设置"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
                </button>
                
                {showSettings && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
                  <div className="absolute right-0 top-full mt-3 w-72 bg-white p-5 rounded-2xl shadow-2xl border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">外观设置</span>
                        <button onClick={() => setFontSettings({family: 'font-serif-sc', scale: 1.0, theme: 'light'})} className="text-[10px] text-indigo-600 hover:underline">恢复默认</button>
                     </div>
                     
                     <div className="space-y-5">
                       <div>
                          <label className="text-sm font-bold text-slate-700 block mb-2">字体风格 (Typography)</label>
                          <div className="grid grid-cols-2 gap-2">
                             <button 
                                onClick={() => setFontSettings(s => ({...s, family: ''}))} 
                                className={`text-xs py-2 px-3 rounded-lg border transition-all ${fontSettings.family === '' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                             >
                               现代黑体 (Sans)
                             </button>
                             <button 
                                onClick={() => setFontSettings(s => ({...s, family: 'font-serif-sc'}))} 
                                className={`text-xs py-2 px-3 rounded-lg border transition-all font-serif-sc ${fontSettings.family === 'font-serif-sc' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                             >
                               典雅宋体 (Serif)
                             </button>
                          </div>
                       </div>
                       
                       <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700">显示比例 (Scale)</label>
                            <span className="text-xs font-mono text-slate-400">{Math.round(fontSettings.scale * 100)}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <button onClick={() => setFontSettings(s => ({...s, scale: Math.max(0.8, s.scale - 0.05)}))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">-</button>
                             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{width: `${(fontSettings.scale - 0.5) * 100}%`}}></div>
                             </div>
                             <button onClick={() => setFontSettings(s => ({...s, scale: Math.min(1.4, s.scale + 0.05)}))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                          </div>
                       </div>
                     </div>
                  </div>
                  </>
                )}
             </div>
          </div>
        </header>
      )}

      <main className={`flex-1 w-full z-10 ${view !== ViewMode.INPUT ? 'pt-20 pb-4 px-4 lg:px-6' : 'flex items-center justify-center p-6'}`}>
        
        {view === ViewMode.INPUT && (
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-500">
             <div className="text-center mb-12">
                <div className="w-24 h-24 mx-auto bg-white rounded-3xl shadow-2xl shadow-indigo-100 flex items-center justify-center text-5xl mb-6 ring-1 ring-slate-100 text-indigo-600 transform hover:scale-105 transition-transform duration-500">💊</div>
                <h1 className="text-5xl md:text-6xl font-black font-serif-sc text-slate-900 mb-4 tracking-tight">LogicMaster <span className="text-indigo-600">TCM</span></h1>
                <p className="text-slate-500 text-xl font-medium">通用中医计算引擎 · 经方/时方/三焦动力学仿真</p>
             </div>
             
             <div className="bg-white p-3 rounded-[2.5rem] shadow-2xl shadow-indigo-200/40 border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <textarea
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   className="w-full h-48 bg-slate-50 rounded-[2rem] p-8 text-2xl text-slate-800 placeholder-slate-300 border-transparent focus:bg-white focus:ring-0 transition-all resize-none font-serif-sc outline-none"
                   placeholder="在此输入处方..."
                />
                <div className="p-2 flex gap-3">
                   <button onClick={handleStartCalculation} className="flex-1 bg-slate-900 text-white text-xl font-bold py-5 rounded-[1.8rem] shadow-xl hover:bg-indigo-900 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                     <span>🚀</span> 开始演算
                   </button>
                </div>
             </div>
             
             <div className="mt-8 flex justify-center gap-6">
                <button onClick={() => setView(ViewMode.DATABASE)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm text-sm flex items-center gap-2">
                   <span>📚</span> 查阅本草纲目
                </button>
                <button onClick={() => setShowAISettingsModal(true)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm text-sm flex items-center gap-2">
                   <span>⚙️</span> 配置 API / 模型
                </button>
             </div>
          </div>
        )}

        {view === ViewMode.WORKSHOP && analysis && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in max-w-[1600px] mx-auto">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center justify-between relative overflow-hidden group hover:shadow-lg transition-all">
                   <div className={`absolute top-0 left-0 w-1.5 h-full ${getPTILabel(analysis.totalPTI).bg.replace('bg-', 'bg-')}`}></div>
                   <div>
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total PTI Index</div>
                      <div className={`text-5xl font-black font-mono ${getPTILabel(analysis.totalPTI).color}`}>
                        {analysis.totalPTI > 0 ? '+' : ''}{analysis.totalPTI.toFixed(3)}
                      </div>
                   </div>
                   <div className={`px-4 py-1.5 rounded-lg text-sm font-bold border ${getPTILabel(analysis.totalPTI).bg} ${getPTILabel(analysis.totalPTI).color} ${getPTILabel(analysis.totalPTI).border}`}>
                     {getPTILabel(analysis.totalPTI).label}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-all">
                   <div>
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Primary Driver</div>
                      <div className="text-3xl font-bold text-slate-800 font-serif-sc">
                        {analysis.top3[0]?.name || '-'}
                      </div>
                   </div>
                   <div className="text-right bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                      <div className={`font-mono font-black text-2xl ${analysis.top3[0]?.ptiContribution > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {analysis.top3[0]?.ptiContribution.toFixed(3)}
                      </div>
                   </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-all">
                   <div>
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">总剂量 (Total Dosage)</div>
                      <div className="text-3xl font-black font-mono text-slate-800">
                        {analysis.herbs.reduce((sum, h) => sum + h.dosageGrams, 0).toFixed(1)}g
                      </div>
                   </div>
                   <div className="text-right">
                     <div className="text-xs text-slate-400 font-bold">参考基准</div>
                     <div className="font-mono font-bold text-slate-500">{analysis.initialTotalDosage.toFixed(1)}g</div>
                   </div>
                </div>
             </div>

             <div>
               <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span> 处方明细</h2>
               {renderCalculationTable(analysis)}
             </div>
          </div>
        )}

        {view === ViewMode.VISUAL && analysis && (
          <div className="h-full animate-in fade-in duration-500 max-w-[1600px] mx-auto">
             <QiFlowVisualizer 
                data={analysis.sanJiao} 
                herbs={analysis.herbs}
                herbPairs={analysis.herbPairs}
                netVector={analysis.netVector}
                dynamics={analysis.dynamics}
             />
          </div>
        )}

        {view === ViewMode.DATABASE && (
          <div className="h-full animate-in zoom-in-95 max-w-[1600px] mx-auto">
             <BenCaoDatabase />
          </div>
        )}

        {view === ViewMode.REPORT && (
           <div className="max-w-[1600px] mx-auto animate-in zoom-in-95 flex flex-col gap-8">
              {aiLoading && (!reports[activeReportVersion] || reports[activeReportVersion] === '') ? (
                <div className="text-center py-32 bg-white rounded-3xl border border-slate-100">
                   <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                   <h2 className="text-xl font-bold text-slate-800">AI 正在进行深度战略审计...</h2>
                   <p className="text-slate-400 mt-2">正在进行处方逆向工程、风险矩阵构建与三焦动态校准</p>
                   <p className="text-slate-300 text-xs mt-4">正在调用大语言模型进行长文本推演，可能需要20-60秒，请耐心等待...</p>
                   <button onClick={handleStopAI} className="mt-8 px-6 py-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 font-bold transition-all">
                       🛑 停止生成
                   </button>
                </div>
              ) : aiError ? (
                <div className="text-center py-32 bg-white rounded-3xl border border-red-100">
                   <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">⚠️</div>
                   <h2 className="text-xl font-bold text-slate-800">生成报告时遇到错误</h2>
                   <p className="text-red-500 mt-2 font-mono text-sm max-w-lg mx-auto bg-red-50 p-4 rounded-lg border border-red-100">{aiError}</p>
                   <div className="flex justify-center gap-4 mt-8">
                      <button 
                          onClick={() => handleAskAI()} 
                          className="px-6 py-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors font-bold"
                      >
                          重试
                      </button>
                      <button 
                          onClick={() => setView(ViewMode.WORKSHOP)} 
                          className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-bold"
                      >
                          返回
                      </button>
                   </div>
                </div>
              ) : Object.keys(reports).length > 0 ? (
                 <div className="flex flex-col gap-6">
                    {Object.keys(reports).length > 1 && (
                       <div className="flex justify-center gap-2 mb-4">
                          {sortVersions(Object.keys(reports)).map(v => (
                             <button 
                                key={v}
                                onClick={() => setActiveReportVersion(v)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeReportVersion === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}
                             >
                               {v}
                             </button>
                          ))}
                       </div>
                    )}
                    
                    <div className="flex justify-end gap-3 flex-wrap">
                        {aiLoading && (
                            <button onClick={handleStopAI} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 flex items-center gap-1 animate-pulse">
                                🛑 停止
                            </button>
                        )}
                        <button 
                            onClick={() => handleAskAI("请重新生成一份更详细的报告")} 
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1"
                            disabled={aiLoading}
                        >
                           <span>✨</span> 重新生成
                        </button>
                        <button onClick={handleCopyHtml} className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                           复制代码
                        </button>
                        <button onClick={handleDeleteReportVersion} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100" disabled={aiLoading}>
                           删除此版本
                        </button>
                    </div>

                    <div 
                      className="prose prose-slate max-w-none bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-slate-200"
                      dangerouslySetInnerHTML={{ __html: reports[activeReportVersion] || '' }}
                    />

                    {isReportIncomplete && (
                        <div className="mt-4 text-center animate-in fade-in">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md mx-auto text-sm text-amber-800 font-medium">
                                报告似乎未生成完整，您可以点击下方按钮继续。
                            </div>
                            <button 
                                onClick={handleContinueAI}
                                disabled={aiLoading}
                                className="mt-6 text-base font-bold text-white bg-amber-500 px-8 py-4 rounded-xl border border-amber-600 hover:bg-amber-600 flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all mx-auto disabled:bg-amber-400 disabled:cursor-not-allowed"
                            >
                               {aiLoading ? (
                                <>
                                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                 <span>正在续写...</span>
                               </>
                               ) : (
                                <>
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" /></svg>
                                 <span>继续生成报告</span>
                                </>
                               )}
                            </button>
                        </div>
                    )}
                 </div>
              ) : (
                 <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400">
                    {analysis ? (
                        <>
                            <p>已完成处方计算，点击下方按钮生成深度分析报告。</p>
                            <button 
                                onClick={() => handleAskAI()} 
                                className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors font-bold flex items-center gap-2 mx-auto"
                            >
                                <span>✨</span> 生成 AI 深度报告
                            </button>
                            <button 
                                onClick={() => setView(ViewMode.INPUT)} 
                                className="mt-4 text-sm text-slate-400 hover:text-indigo-600 underline block mx-auto"
                            >
                                放弃当前结果，开始新演算
                            </button>
                        </>
                    ) : (
                        <>
                            <p>暂无报告。请点击“开始演算”后生成。</p>
                            <button 
                                onClick={() => setView(ViewMode.INPUT)} 
                                className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors font-bold"
                            >
                                开始新的演算
                            </button>
                        </>
                    )}
                 </div>
              )}
           </div>
        )}

        {view === ViewMode.AI_CHAT && analysis && (
          <div className="h-[80vh] max-w-[1600px] mx-auto animate-in zoom-in-95">
             <AIChatbot 
                analysis={analysis} 
                prescriptionInput={input} 
                reportContent={reports[activeReportVersion]} 
                onUpdatePrescription={handleUpdatePrescriptionFromChat}
                onRegenerateReport={(instr) => handleAskAI(instr)}
                settings={aiSettings}
             />
          </div>
        )}
        
        {view === ViewMode.AI_CHAT && !analysis && (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400 max-w-3xl mx-auto mt-20">
                <p>请先在首页输入处方并进行演算，以激活 AI 问答上下文。</p>
                <button onClick={() => setView(ViewMode.INPUT)} className="mt-4 text-indigo-600 font-bold hover:underline">返回首页</button>
            </div>
        )}

      </main>
    </div>
  );
}

export default App;
