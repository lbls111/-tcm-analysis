
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { analyzePrescriptionWithAI, generateHerbDataWithAI, DEFAULT_ANALYZE_SYSTEM_INSTRUCTION, QUICK_ANALYZE_SYSTEM_INSTRUCTION } from './services/openaiService';
import { calculatePrescription, getPTILabel } from './utils/tcmMath';
import { parsePrescription } from './utils/prescriptionParser';
import { AnalysisResult, ViewMode, Constitution, AdministrationMode, BenCaoHerb, AISettings, CloudReport } from './types';
import { QiFlowVisualizer } from './components/QiFlowVisualizer';
import BenCaoDatabase from './components/BenCaoDatabase';
import { HerbDetailModal } from './components/HerbDetailModal';
import { EditHerbModal } from './components/EditHerbModal';
import { AIChatbot } from './components/AIChatbot';
import { AISettingsModal } from './components/AISettingsModal';
import { FULL_HERB_LIST, registerDynamicHerb, loadCustomHerbs } from './data/herbDatabase';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from './constants';
import { saveCloudReport, fetchCloudReports, deleteCloudReport, updateCloudHerb } from './services/supabaseService';

// Logging Imports
import { LogProvider, useLog } from './contexts/LogContext';
import { LogViewer } from './components/LogViewer';

const PRESET_PRESCRIPTION = "";
const LS_REPORTS_KEY = "logicmaster_reports";
const LS_REPORTS_META_KEY = "logicmaster_reports_meta";
const LS_SETTINGS_KEY = "logicmaster_settings";
const LS_AI_SETTINGS_KEY = "logicmaster_ai_settings";
const LS_META_INFO_KEY = "logicmaster_meta_info"; 
const DEFAULT_API_URL = "https://lbls888-lap.hf.space/v1";

type ReportMode = 'quick' | 'deep';

interface ReportMeta {
  mode: ReportMode;
  timestamp: number;
}

const sortVersions = (versions: string[]) => {
  return versions.sort((a, b) => {
    const numA = parseInt(a.replace(/^V/, '')) || 0;
    const numB = parseInt(b.replace(/^V/, '')) || 0;
    return numA - numB;
  });
};

const NAV_ITEMS = [
  { id: ViewMode.WORKSHOP, label: '计算工坊', icon: '🧮' },
  { id: ViewMode.VISUAL, label: '三焦动力', icon: '☯️' },
  { id: ViewMode.REPORT, label: 'AI 推演', icon: '📝' },
  { id: ViewMode.AI_CHAT, label: 'AI 问答', icon: '🤖' },
  { id: ViewMode.DATABASE, label: '药典库', icon: '📚' }
];

// --- Main App Component ---
function LogicMasterApp() {
  const { addLog } = useLog(); // Use the log hook
  const [showLogViewer, setShowLogViewer] = useState(false);

  const [view, setView] = useState<ViewMode>(ViewMode.INPUT);
  const [input, setInput] = useState(PRESET_PRESCRIPTION);
  const [metaInfo, setMetaInfo] = useState(''); 
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [autoFillingHerb, setAutoFillingHerb] = useState<string | null>(null);
  
  const [reports, setReports] = useState<Record<string, string>>({});
  const [reportMeta, setReportMeta] = useState<Record<string, ReportMeta>>({});
  const [activeReportVersion, setActiveReportVersion] = useState<string>('V1');
  const [isReportIncomplete, setIsReportIncomplete] = useState(false);
  
  const [cloudReports, setCloudReports] = useState<CloudReport[]>([]);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  
  const [fontSettings, setFontSettings] = useState({
    family: 'font-serif-sc', 
    scale: 1.0,
    theme: 'light' 
  });
  const [aiSettings, setAiSettings] = useState<AISettings>({
    apiKey: '',
    apiBaseUrl: DEFAULT_API_URL,
    model: '', 
    analysisModel: '', 
    chatModel: '', 
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
  const [editingHerb, setEditingHerb] = useState<BenCaoHerb | null>(null);
  const [isSavingHerb, setIsSavingHerb] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    addLog('info', 'System', 'Application initialized');
    const savedReports = localStorage.getItem(LS_REPORTS_KEY);
    const savedMeta = localStorage.getItem(LS_REPORTS_META_KEY);
    
    if (savedReports) {
      try {
        const parsedReports = JSON.parse(savedReports);
        const parsedMeta = savedMeta ? JSON.parse(savedMeta) : {};
        
        if (parsedReports && typeof parsedReports === 'object' && Object.keys(parsedReports).length > 0) {
          setReports(parsedReports);
          setReportMeta(parsedMeta);
          const sortedVersions = sortVersions(Object.keys(parsedReports));
          setActiveReportVersion(sortedVersions[sortedVersions.length - 1] || 'V1');
        }
      } catch (e) {
        localStorage.removeItem(LS_REPORTS_KEY);
        localStorage.removeItem(LS_REPORTS_META_KEY);
      }
    }

    const savedSettings = localStorage.getItem(LS_SETTINGS_KEY);
    if (savedSettings) {
      try {
        setFontSettings(JSON.parse(savedSettings));
      } catch (e) {}
    }
    
    const savedMetaInfo = localStorage.getItem(LS_META_INFO_KEY);
    if (savedMetaInfo) {
        setMetaInfo(savedMetaInfo);
    }
    
    const savedAISettings = localStorage.getItem(LS_AI_SETTINGS_KEY);
    if (savedAISettings) {
      try {
        const parsed = JSON.parse(savedAISettings);
        setAiSettings({
          apiKey: parsed.apiKey || '',
          apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_URL,
          model: parsed.model || parsed.analysisModel || '',
          analysisModel: parsed.analysisModel || '',
          chatModel: parsed.chatModel || '',
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
      localStorage.setItem(LS_REPORTS_META_KEY, JSON.stringify(reportMeta));
    } else {
      localStorage.removeItem(LS_REPORTS_KEY);
      localStorage.removeItem(LS_REPORTS_META_KEY);
    }
  }, [reports, reportMeta]);

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(fontSettings));
  }, [fontSettings]);
  
  useEffect(() => {
    localStorage.setItem(LS_AI_SETTINGS_KEY, JSON.stringify(aiSettings));
  }, [aiSettings]);
  
  useEffect(() => {
      localStorage.setItem(LS_META_INFO_KEY, metaInfo);
  }, [metaInfo]);
  
  useEffect(() => {
    if (view === ViewMode.REPORT && reports[activeReportVersion]) {
        const currentReport = reports[activeReportVersion];
        // Use includes instead of endsWith for robustness against markdown/whitespace
        const isComplete = currentReport.includes('</html>');
        setIsReportIncomplete(!isComplete);
    } else {
        setIsReportIncomplete(false);
    }
  }, [activeReportVersion, reports, view]);

  // Load Cloud Reports
  useEffect(() => {
      const loadHistory = async () => {
          if (aiSettings.supabaseKey) {
             addLog('info', 'Cloud', 'Fetching report history');
             const history = await fetchCloudReports(aiSettings);
             setCloudReports(history);
          }
      };
      if (view === ViewMode.REPORT) {
          loadHistory();
      }
  }, [view, aiSettings.supabaseKey]);

  // =========================================================
  // Herb Recognition Logic for Report (Memoized)
  // =========================================================
  const herbRegex = useMemo(() => {
      const names = FULL_HERB_LIST.map(h => h.name).sort((a, b) => b.length - a.length);
      if (names.length === 0) return null;
      const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return new RegExp(`(${escaped.join('|')})`, 'g');
  }, [FULL_HERB_LIST.length]);

  const processReportContent = (html: string) => {
      if (!herbRegex || !html) return html;
      const parts = html.split(/(<[^>]+>)/g);
      return parts.map(part => {
          if (part.startsWith('<')) return part;
          return part.replace(herbRegex, (match) => 
              `<span class="herb-link cursor-pointer text-indigo-700 font-bold border-b border-indigo-200 hover:bg-indigo-50 hover:border-indigo-500 transition-colors px-0.5 rounded-sm" data-herb-name="${match}">${match}</span>`
          );
      }).join('');
  };

  const handleReportClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const herbSpan = target.closest('[data-herb-name]');
      if (herbSpan) {
          const herbName = herbSpan.getAttribute('data-herb-name');
          if (herbName) {
              handleHerbClick(herbName);
          }
      }
  };

  const handleStartCalculation = () => {
    try {
      addLog('info', 'Calc', 'Starting prescription calculation', { input: input.substring(0, 50) });
      const herbs = parsePrescription(input);
      const result = calculatePrescription(herbs);
      setAnalysis(result);
      setInitialDosageRef(result.initialTotalDosage); 
      setView(ViewMode.WORKSHOP);
      addLog('success', 'Calc', 'Calculation successful', { totalPTI: result.totalPTI, herbsCount: herbs.length });
    } catch (e: any) {
      addLog('error', 'Calc', 'Calculation failed', { error: e.message });
      console.error(e);
      alert("计算出错，请检查输入格式");
    }
  };
  
  const handleStopAI = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setAiLoading(false);
          addLog('warning', 'AI', 'Generation aborted by user');
          setReports(prev => {
              const current = prev[activeReportVersion] || '';
              return { ...prev, [activeReportVersion]: current + "\n\n<!-- 生成已由用户手动停止 -->" };
          });
      }
  };

  const handleResetCurrentVersion = () => {
      if (!activeReportVersion) return;
      if (!window.confirm("确定要重置当前版本吗？\n当前内容将被清空，您可以重新选择【深度推演】或【快速审核】模式。")) return;
      
      addLog('info', 'Report', `Reset version ${activeReportVersion}`);
      setReports(prev => ({
          ...prev,
          [activeReportVersion]: '' 
      }));
      setIsReportIncomplete(false);
      setAiError(null);
  };
  
  const saveCurrentReportToCloud = async (version: string, htmlContent: string, mode: string, isManual: boolean = false) => {
      if (!aiSettings.supabaseKey || !analysis) {
          if (isManual) alert("保存失败：未配置云数据库或缺少分析数据。");
          return;
      }
      
      if (isManual) setIsSavingCloud(true);
      
      addLog('info', 'Cloud', `Uploading report version ${version}`, { mode, isManual });
      const success = await saveCloudReport({
          prescription: input,
          content: htmlContent,
          meta: { version, mode, model: aiSettings.model || aiSettings.analysisModel },
          analysis_result: { top3: analysis.top3, totalPTI: analysis.totalPTI }
      }, aiSettings);
      
      if (isManual) {
          setIsSavingCloud(false);
          if (success) {
              addLog('success', 'Cloud', 'Report saved successfully');
              alert("☁️ 报告已成功保存至云端！\n您可以在“历史存档”中随时查看。");
          } else {
              addLog('error', 'Cloud', 'Report save failed');
              alert("❌ 保存失败。\n请检查 Supabase 连接，或确认是否已运行数据库初始化 SQL (需包含 'reports' 表)。");
          }
      }
      
      if (success) {
          fetchCloudReports(aiSettings).then(setCloudReports);
      }
  };

  const handleManualCloudSave = () => {
      const content = reports[activeReportVersion];
      const meta = reportMeta[activeReportVersion];
      if (!content || !meta) return;
      saveCurrentReportToCloud(activeReportVersion, content, meta.mode, true);
  };

  const handleDeleteCloudReport = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("确定要删除此云端存档吗？此操作无法撤销。")) return;
      
      addLog('action', 'Cloud', 'Deleting cloud report', { id });
      const success = await deleteCloudReport(id, aiSettings);
      if (success) {
          addLog('success', 'Cloud', 'Cloud report deleted');
          setCloudReports(prev => prev.filter(r => r.id !== id));
      } else {
          addLog('error', 'Cloud', 'Failed to delete cloud report');
          alert("删除失败，请检查网络或权限。");
      }
  };

  const handleAskAI = async (mode: 'deep' | 'quick' | 'regenerate', regenerateInstructions?: string) => {
    if (!analysis) return;

    if (!aiSettings.apiKey) {
      alert("请先点击右上角设置图标，配置 API Key 和 模型参数。");
      setShowAISettingsModal(true);
      return;
    }

    setView(ViewMode.REPORT);
    setAiLoading(true);
    setAiError(null);
    addLog('info', 'AI', `Starting AI generation mode: ${mode}`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let versionToUse = activeReportVersion;
    let targetMode: ReportMode = 'deep';
    let sysPrompt = DEFAULT_ANALYZE_SYSTEM_INSTRUCTION;

    const isCurrentVersionEmpty = activeReportVersion && (!reports[activeReportVersion] || reports[activeReportVersion].trim() === '');

    if (mode === 'regenerate') {
        versionToUse = activeReportVersion;
        targetMode = reportMeta[versionToUse]?.mode || 'deep';
        
        if (targetMode === 'quick') {
            sysPrompt = QUICK_ANALYZE_SYSTEM_INSTRUCTION;
        }
        setReports(prev => ({ ...prev, [versionToUse]: '' }));

    } else {
        if (isCurrentVersionEmpty) {
            versionToUse = activeReportVersion;
        } else {
            // Version Management: Calculate next version if not empty
            const existingVersions = Object.keys(reports);
            const maxVer = existingVersions.reduce((max, key) => {
               const num = parseInt(key.replace(/^V/, '')) || 0;
               return Math.max(max, num);
            }, 0);
            versionToUse = `V${maxVer + 1}`;
        }
        
        targetMode = mode;
        if (targetMode === 'quick') {
            sysPrompt = QUICK_ANALYZE_SYSTEM_INSTRUCTION;
        }

        setActiveReportVersion(versionToUse);
        setReports(prev => ({ ...prev, [versionToUse]: '' }));
    }

    setReportMeta(prev => ({
        ...prev,
        [versionToUse]: { mode: targetMode, timestamp: Date.now() }
    }));

    try {
      const stream = analyzePrescriptionWithAI(
        analysis,
        input,
        aiSettings,
        regenerateInstructions,
        undefined,
        controller.signal,
        sysPrompt, 
        metaInfo 
      );

      let htmlContent = '';
      for await (const chunk of stream) {
        htmlContent += chunk;
        setReports(prev => ({ ...prev, [versionToUse]: htmlContent }));
      }

      // Check inclusion for robustness
      const isComplete = htmlContent.includes('</html>');
      setIsReportIncomplete(!isComplete);
      addLog('success', 'AI', 'Generation completed', { incomplete: !isComplete });
      
      if (isComplete) {
          saveCurrentReportToCloud(versionToUse, htmlContent, targetMode, false);
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
          console.log('AI generation aborted by user');
          return;
      }
      console.error(err);
      addLog('error', 'AI', 'Generation failed', { error: err.message });
      setAiError(err.message || "请求 AI 时发生未知错误");
    } finally {
      setAiLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleContinueAI = async () => {
    if (!analysis || !reports[activeReportVersion] || !isReportIncomplete || aiLoading) return;

    setAiLoading(true);
    setAiError(null);
    addLog('info', 'AI', 'Continuing generation...');
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const currentMode = reportMeta[activeReportVersion]?.mode || 'deep';
    const sysPrompt = currentMode === 'quick' ? QUICK_ANALYZE_SYSTEM_INSTRUCTION : DEFAULT_ANALYZE_SYSTEM_INSTRUCTION;

    try {
      const partialReport = reports[activeReportVersion];
      
      const stream = analyzePrescriptionWithAI(
        analysis,
        input,
        aiSettings,
        undefined,
        partialReport,
        controller.signal,
        sysPrompt,
        metaInfo
      );

      let finalContent = partialReport;
      for await (const chunk of stream) {
        finalContent += chunk;
        setReports(prev => ({ ...prev, [activeReportVersion]: finalContent }));
      }
      
      const isNowComplete = finalContent.includes('</html>');
      setIsReportIncomplete(!isNowComplete);
      addLog('success', 'AI', 'Continuation successful');

      if (isNowComplete) {
        saveCurrentReportToCloud(activeReportVersion, finalContent, currentMode, false);
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      addLog('error', 'AI', 'Continuation failed', { error: err.message });
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
     addLog('info', 'HerbDB', `Auto-filling data for ${herbName}`);
     try {
         const newHerbData = await generateHerbDataWithAI(herbName, aiSettings);
         if (newHerbData) {
             registerDynamicHerb(newHerbData, true);
             addLog('success', 'HerbDB', `Generated data for ${herbName}`);
             alert(`✨ 成功！AI 已生成【${herbName}】的数据。\n性味：${newHerbData.nature} | ${newHerbData.flavors.join(',')}\n归经：${newHerbData.meridians.join(',')}`);
             handleStartCalculation();
         } else {
             addLog('warning', 'HerbDB', `Could not generate data for ${herbName}`);
             alert("AI 无法生成该药材的数据。");
         }
     } catch (e: any) {
         addLog('error', 'HerbDB', `Auto-fill failed`, { error: e.message });
         alert(`补全失败: ${e.message}`);
     } finally {
         setAutoFillingHerb(null);
     }
  };
  
  const handleUpdatePrescriptionFromChat = (newPrescription: string) => {
    setInput(newPrescription);
    addLog('info', 'Chat', 'Prescription updated from Chat');
    try {
      const herbs = parsePrescription(newPrescription);
      const result = calculatePrescription(herbs);
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

  const handleDeleteReportVersion = (versionToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!versionToDelete || !(versionToDelete in reports)) return;
    
    if (!window.confirm(`确定要删除版本 ${versionToDelete} 吗？`)) return;
    
    const newReports = { ...reports };
    delete newReports[versionToDelete];
    setReports(newReports);

    const newMeta = { ...reportMeta };
    delete newMeta[versionToDelete];
    setReportMeta(newMeta);

    // If deleting current active, switch to last available
    if (activeReportVersion === versionToDelete) {
        const remainingVersions = Object.keys(newReports);
        if (remainingVersions.length > 0) {
            const sorted = sortVersions(remainingVersions);
            setActiveReportVersion(sorted[sorted.length - 1]); 
        } else {
            setActiveReportVersion('V1');
            setIsReportIncomplete(false);
        }
    }
    addLog('info', 'Report', `Deleted version ${versionToDelete}`);
  };
  
  const loadCloudReportToLocal = (cloudReport: CloudReport) => {
      addLog('info', 'Cloud', `Importing cloud report: ${cloudReport.id}`);
      setInput(cloudReport.prescription);
      const herbs = parsePrescription(cloudReport.prescription);
      const result = calculatePrescription(herbs);
      setAnalysis(result);
      setInitialDosageRef(result.initialTotalDosage);
      
      const importVer = `Cloud-${new Date(cloudReport.created_at).toLocaleDateString().replace(/\//g,'')}`;
      setReports({[importVer]: cloudReport.content});
      setReportMeta({[importVer]: { mode: cloudReport.meta?.mode || 'deep', timestamp: Date.now() }});
      setActiveReportVersion(importVer);
      
      setView(ViewMode.REPORT);
      setShowReportHistory(false);
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
  
  const handleSaveHerbChanges = async (updatedHerb: BenCaoHerb) => {
      setIsSavingHerb(true);
      try {
        const success = await updateCloudHerb(updatedHerb.id, updatedHerb, aiSettings);
        if (success) {
            setEditingHerb(null);
            await loadCustomHerbs(); // Refresh global list
            alert("药材数据已更新！若该药材在当前处方中，请重新点击【开始演算】以应用新数据。");
        } else {
            alert("保存失败，请检查网络连接或 Supabase 权限。");
        }
      } catch (e: any) {
          alert(`保存时发生错误: ${e.message}`);
      } finally {
          setIsSavingHerb(false);
      }
  };

  const getTempBadgeStyle = (temp: string) => {
    if (temp.includes('大热') || temp.includes('热')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (temp.includes('温')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (temp.includes('寒')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (temp.includes('凉')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  const renderCalculationTable = (targetAnalysis: AnalysisResult) => {
    if (!targetAnalysis) return null;

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl bg-white/80 backdrop-blur-xl">
        <div className="p-6 bg-white/50 border-b border-slate-100">
           <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span> 处方物理明细
           </h3>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">药名 (Herb)</th>
                <th className="px-6 py-4 text-right">剂量 (g)</th>
                <th className="px-6 py-4 text-center">药性/能值</th>
                <th className="px-6 py-4 text-right">PTI 贡献</th>
                <th className="px-6 py-4 text-right text-slate-400">矢量 (Vector)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {targetAnalysis.herbs.map((h, i) => {
                const isLinked = !!h.staticData;
                return (
                  <tr key={h.id} className={`hover:bg-indigo-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      <div 
                          className={`flex flex-col ${isLinked ? 'cursor-pointer group' : ''}`}
                          onClick={() => isLinked && handleHerbClick(h.name, h.mappedFrom)}
                      >
                          <div className="flex items-center gap-2">
                            <span className={`text-base ${isLinked ? 'text-slate-800 group-hover:text-indigo-600' : 'text-slate-600'}`}>
                              {h.name}
                            </span>
                            {isLinked && (
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400">
                                ↗
                              </span>
                            )}
                            {!isLinked && (
                                  <button 
                                  onClick={(e) => { e.stopPropagation(); handleAutoFillHerb(h.name); }}
                                  disabled={autoFillingHerb === h.name}
                                  className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-200 transition"
                                  >
                                  {autoFillingHerb === h.name ? '...' : 'AI补全'}
                                  </button>
                            )}
                          </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                      {h.dosageGrams}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getTempBadgeStyle(h.displayTemperature)}`}>
                        {h.displayTemperature} <span className="opacity-50 mx-1">|</span> {h.hvCorrected.toFixed(1)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-bold ${h.ptiContribution > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                      {h.ptiContribution > 0 ? '+' : ''}{h.ptiContribution.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      <span className="inline-block min-w-[30px]">{h.vector.x > 0 ? '散' : h.vector.x < 0 ? '收' : '平'}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="inline-block min-w-[30px]">{h.vector.y > 0 ? '升' : h.vector.y < 0 ? '降' : '平'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="md:hidden space-y-3 p-4 bg-slate-50/50">
           {targetAnalysis.herbs.map((h) => {
             const isLinked = !!h.staticData;
             return (
               <div key={h.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800 font-serif-sc" onClick={() => isLinked && handleHerbClick(h.name, h.mappedFrom)}>
                          {h.name}
                        </span>
                        {!isLinked && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAutoFillHerb(h.name); }}
                              disabled={autoFillingHerb === h.name}
                              className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100"
                            >
                              AI补全
                            </button>
                        )}
                     </div>
                     <span className="font-mono text-lg text-slate-600 font-bold">{h.dosageGrams}<small className="text-xs text-slate-400 ml-0.5">g</small></span>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTempBadgeStyle(h.displayTemperature)}`}>
                        {h.displayTemperature} ({h.hvCorrected.toFixed(1)})
                      </span>
                      {h.staticData?.flavors.map(f => (
                         <span key={f} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f}</span>
                      ))}
                  </div>

                  <div className="flex justify-between items-end border-t border-slate-50 pt-2 mt-1">
                     <div className="text-xs text-slate-400 flex gap-2">
                        <span>{h.vector.x > 0 ? '散' : h.vector.x < 0 ? '收' : '•'}</span>
                        <span>{h.vector.y > 0 ? '升' : h.vector.y < 0 ? '降' : '•'}</span>
                     </div>
                     <div className={`font-mono font-black text-lg ${h.ptiContribution > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {h.ptiContribution > 0 ? '+' : ''}{h.ptiContribution.toFixed(2)}
                        <span className="text-[10px] text-slate-300 ml-1 font-normal uppercase">PTI</span>
                     </div>
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  // Fixed Bottom Navigation Component
  const MobileBottomNav = ({ currentView, setView }: { currentView: ViewMode, setView: (v: ViewMode) => void }) => (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 lg:hidden safe-area-pb">
        <div className="flex justify-around items-center h-16 px-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === item.id ? 'text-indigo-600' : 'text-slate-400'}`}
            >
              <span className={`text-2xl transition-transform ${currentView === item.id ? '-translate-y-1 scale-110' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-bold scale-90">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
  );

  return (
    <div 
      className={`min-h-screen w-full flex flex-col relative bg-[#f8fafc] text-slate-900 ${fontSettings.family} selection:bg-indigo-100 selection:text-indigo-900`}
      style={{ fontSize: `${fontSettings.scale}rem` }}
    >
      {viewingHerb && (
          <HerbDetailModal 
             herb={viewingHerb} 
             onClose={() => setViewingHerb(null)}
             onEdit={(h) => {
                 setViewingHerb(null);
                 setEditingHerb(h);
             }}
             onSwitch={handleHerbClick} // Pass the switcher
          />
      )}
      
      {editingHerb && (
        <EditHerbModal 
            herb={editingHerb} 
            onClose={() => setEditingHerb(null)} 
            onSave={handleSaveHerbChanges}
            isSaving={isSavingHerb}
        />
      )}
      
      {/* ... rest of App ... */}
      <AISettingsModal 
          isOpen={showAISettingsModal}
          onClose={() => setShowAISettingsModal(false)}
          settings={aiSettings}
          onSave={setAiSettings}
      />

      <LogViewer 
          isOpen={showLogViewer} 
          onClose={() => setShowLogViewer(false)} 
      />
      
      {/* Cloud Report History Sidebar */}
      {showReportHistory && (
         <div className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm flex justify-end" onClick={() => setShowReportHistory(false)}>
             <div 
                 className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300"
                 onClick={e => e.stopPropagation()}
             >
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold font-serif-sc text-slate-800 flex items-center gap-2">
                        <span>☁️</span> 云端报告存档
                     </h3>
                     <button onClick={() => setShowReportHistory(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                     {cloudReports.length === 0 ? (
                         <div className="text-center py-20 text-slate-400 text-sm">暂无云端存档。</div>
                     ) : (
                         cloudReports.map(r => (
                             <div 
                                 key={r.id}
                                 className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer transition-all group relative"
                                 onClick={() => loadCloudReportToLocal(r)}
                             >
                                 <div className="flex justify-between items-start mb-2">
                                     <span className="text-xs font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                         {new Date(r.created_at).toLocaleDateString()}
                                     </span>
                                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${r.meta?.mode === 'quick' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                                         {r.meta?.mode === 'quick' ? '快速' : '深度'}
                                     </span>
                                 </div>
                                 <div className="text-sm font-bold text-slate-700 line-clamp-2 mb-2 font-serif-sc pr-6">
                                     {r.prescription}
                                 </div>
                                 <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                     <span>{r.analysis_result?.top3?.[0]?.name ? `核心: ${r.analysis_result.top3[0].name}` : ''}</span>
                                     <span className="ml-auto opacity-0 group-hover:opacity-100 text-indigo-600 font-bold transition-opacity">加载 →</span>
                                 </div>

                                 {/* Delete Button */}
                                 <button 
                                    onClick={(e) => handleDeleteCloudReport(r.id, e)}
                                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-slate-300 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-100 flex items-center justify-center transition-colors shadow-sm"
                                    title="删除此存档"
                                 >
                                    ✕
                                 </button>
                             </div>
                         ))
                     )}
                 </div>
             </div>
         </div>
      )}

      {view !== ViewMode.INPUT && (
        <header className="fixed top-0 z-50 w-full h-16 bg-white/80 backdrop-blur-xl border-b border-white shadow-sm flex items-center justify-between px-4 lg:px-6 transition-all">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                  setView(ViewMode.INPUT);
                  setInitialDosageRef(null);
                }}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-200">L</div>
                <span className="font-bold text-lg font-serif-sc text-slate-800 tracking-tight hidden md:inline">LogicMaster</span>
             </div>
          </div>
          
          <nav className="hidden lg:flex bg-slate-100/50 p-1 rounded-full border border-slate-200/50">
            {NAV_ITEMS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  view === tab.id 
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-800 hover:text-indigo-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
             {/* Log Viewer Trigger */}
             <button 
                onClick={() => setShowLogViewer(true)}
                className="p-2 rounded-lg transition-colors bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm"
                title="系统日志"
             >
                <span className="text-sm">📟</span>
             </button>

             <button 
                onClick={() => setShowAISettingsModal(true)}
                className="p-2 rounded-lg transition-colors bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.077-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
             </button>

             <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors border shadow-sm ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600'}`}
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

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav currentView={view} setView={setView} />

      <main className={`flex-1 w-full z-10 ${view !== ViewMode.INPUT ? 'pt-24 pb-24 lg:pb-8 px-4 lg:px-8' : 'flex items-center justify-center p-6 pb-24'}`}>
        
        {view === ViewMode.INPUT && (
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-500">
             <div className="text-center mb-8 md:mb-12">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl shadow-indigo-100/50 flex items-center justify-center text-4xl md:text-5xl mb-6 ring-1 ring-slate-100 text-indigo-600 transform hover:scale-105 transition-transform duration-500">💊</div>
                <h1 className="text-3xl md:text-6xl font-black font-serif-sc text-slate-900 mb-4 tracking-tight">LogicMaster <span className="text-indigo-600">TCM</span></h1>
                <p className="text-slate-500 text-base md:text-xl font-medium">通用中医计算引擎 · 经方/时方/三焦动力学仿真</p>
             </div>
             
             <div className="bg-white p-3 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-indigo-200/40 border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <textarea
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   className="w-full h-40 md:h-48 bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 text-lg md:text-2xl text-slate-800 placeholder-slate-300 border-transparent focus:bg-white focus:ring-0 transition-all resize-none font-serif-sc outline-none"
                   placeholder="在此输入处方..."
                />
                <div className="p-2 flex gap-3">
                   <button onClick={handleStartCalculation} className="flex-1 bg-slate-900 text-white text-lg md:text-xl font-bold py-4 md:py-5 rounded-[1.5rem] md:rounded-[1.8rem] shadow-xl hover:bg-indigo-900 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                     <span>🚀</span> 开始演算
                   </button>
                </div>
             </div>
             
             <div className="mt-8 flex justify-center gap-6">
                <button onClick={() => setShowAISettingsModal(true)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm text-sm flex items-center gap-2">
                   <span>⚙️</span> 配置 API / 模型
                </button>
             </div>
          </div>
        )}

        {/* ... (Existing workshop, visual, database views) ... */}
        {view === ViewMode.WORKSHOP && analysis && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 fade-in max-w-[1600px] mx-auto">
             <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-6">
                
                {/* Card 1: Total PTI */}
                <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] shadow-xl shadow-slate-100/50 border border-white flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden min-h-[160px]">
                   <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 ${getPTILabel(analysis.totalPTI).bg.replace('bg-', 'bg-')}`}></div>
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                         <span className={`w-2 h-2 rounded-full ${getPTILabel(analysis.totalPTI).bg.replace('bg-', 'bg-').replace('50', '500')}`}></span>
                         <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total PTI Index</span>
                      </div>
                      <div className={`text-5xl md:text-6xl font-black font-mono tracking-tighter ${getPTILabel(analysis.totalPTI).color}`}>
                        {analysis.totalPTI > 0 ? '+' : ''}{analysis.totalPTI.toFixed(3)}
                      </div>
                   </div>
                   <div className="mt-4">
                     <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${getPTILabel(analysis.totalPTI).bg} ${getPTILabel(analysis.totalPTI).color} ${getPTILabel(analysis.totalPTI).border}`}>
                       {getPTILabel(analysis.totalPTI).label}
                     </span>
                   </div>
                </div>

                {/* Card 2: Primary Driver */}
                <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] shadow-xl shadow-slate-100/50 border border-white flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 min-h-[160px]">
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                         <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                         <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Primary Driver</span>
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-slate-800 font-serif-sc mb-1 truncate">
                        {analysis.top3[0]?.name || '-'}
                      </div>
                      <div className="text-sm text-slate-400">
                         Contribution Factor
                      </div>
                   </div>
                   <div className="self-end mt-2">
                      <div className={`font-mono font-black text-3xl md:text-4xl ${analysis.top3[0]?.ptiContribution > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {analysis.top3[0]?.ptiContribution > 0 ? '+' : ''}{analysis.top3[0]?.ptiContribution.toFixed(2)}
                      </div>
                   </div>
                </div>
                
                {/* Card 3: Dosage */}
                <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] shadow-xl shadow-slate-100/50 border border-white flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 min-h-[160px]">
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                         <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                         <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Dosage</span>
                      </div>
                      <div className="text-4xl md:text-5xl font-black font-mono text-slate-800 tracking-tight">
                        {analysis.herbs.reduce((sum, h) => sum + h.dosageGrams, 0).toFixed(1)}<span className="text-xl md:text-2xl ml-1 text-slate-400 font-bold">g</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-end border-t border-slate-100 pt-4 mt-4">
                     <div className="text-xs text-slate-400 font-bold">参考基准</div>
                     <div className="font-mono font-bold text-slate-500">{analysis.initialTotalDosage.toFixed(1)}g</div>
                   </div>
                </div>
             </div>

             {renderCalculationTable(analysis)}
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
              {/* Report Header & Controls */}
              {Object.keys(reports).length > 0 && (
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800 text-lg">分析报告</span>
                          {reportMeta[activeReportVersion] && (
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border flex items-center gap-1 ${
                                reportMeta[activeReportVersion].mode === 'quick' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                                {reportMeta[activeReportVersion].mode === 'quick' ? '⚡ 快速审核' : '🧠 深度推演'}
                            </span>
                          )}
                      </div>

                      <div className="flex gap-2 items-center flex-wrap justify-end w-full md:w-auto">
                          {/* Version Tabs */}
                          <div className="flex bg-slate-100 rounded-lg p-1 mr-0 md:mr-4 overflow-x-auto max-w-[200px] md:max-w-none no-scrollbar">
                              {sortVersions(Object.keys(reports)).map(v => (
                                  <div key={v} className="relative group shrink-0">
                                    <button 
                                        onClick={() => setActiveReportVersion(v)}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeReportVersion === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        {v}
                                    </button>
                                    {/* Mini Delete Button for Version (Always Visible on mobile/active, visible on hover for others) */}
                                    <button
                                        onClick={(e) => handleDeleteReportVersion(v, e)}
                                        className={`absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] items-center justify-center shadow-sm z-10 transition-opacity ${activeReportVersion === v ? 'flex' : 'hidden group-hover:flex'}`}
                                        title="删除此版本"
                                    >✕</button>
                                  </div>
                              ))}
                              {/* Create New Version Button */}
                              <button
                                  onClick={() => handleAskAI(reportMeta[activeReportVersion]?.mode || 'deep')}
                                  className="px-2 py-1 ml-1 rounded-md text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1 shrink-0"
                                  title="生成新版本"
                              >
                                  + 新版
                              </button>
                          </div>

                          {aiLoading ? (
                                <button onClick={handleStopAI} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 hover:bg-red-100 flex items-center gap-1 animate-pulse">
                                    🛑 停止
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleManualCloudSave} 
                                        disabled={isSavingCloud}
                                        className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 hover:bg-emerald-100 flex items-center gap-1 transition-all"
                                    >
                                        {isSavingCloud ? <span className="animate-spin">⏳</span> : <span>☁️</span>}
                                        {isSavingCloud ? '保存中...' : '保存到云端'}
                                    </button>

                                    <button 
                                        onClick={handleResetCurrentVersion} 
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1"
                                    >
                                        <span>↺</span> 重写当前版
                                    </button>
                                    <button 
                                        onClick={() => setShowReportHistory(true)} 
                                        className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <span>📂</span> 历史存档
                                    </button>
                                    <button 
                                        onClick={handleCopyHtml} 
                                        className="text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                                    >
                                        复制代码
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteReportVersion(activeReportVersion)}
                                        className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 hover:bg-red-100 flex items-center gap-1"
                                    >
                                        删除
                                    </button>
                                </>
                            )}
                      </div>
                  </div>
              )}

              {/* Main Content Area */}
              {aiLoading && (!reports[activeReportVersion] || reports[activeReportVersion] === '') ? (
                <div className="text-center py-32 bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-xl">
                   <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                   <h2 className="text-xl font-bold text-slate-800">AI 正在生成策略...</h2>
                   <p className="text-slate-400 mt-2">正在进行数据推演，请耐心等待</p>
                </div>
              ) : aiError ? (
                <div className="text-center py-32 bg-white rounded-3xl border border-red-100">
                   <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">⚠️</div>
                   <h2 className="text-xl font-bold text-slate-800">生成报告时遇到错误</h2>
                   <p className="text-red-500 mt-2 font-mono text-sm max-w-lg mx-auto bg-red-50 p-4 rounded-lg border border-red-100">{aiError}</p>
                   <div className="flex justify-center gap-4 mt-8">
                      <button 
                          onClick={() => handleAskAI('deep')} 
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
              ) : reports[activeReportVersion] ? (
                 <div className="flex flex-col gap-6">
                    <div 
                      className="prose prose-slate max-w-none bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100"
                      dangerouslySetInnerHTML={{ __html: processReportContent(reports[activeReportVersion]) }}
                      onClick={handleReportClick}
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
                 <div className="text-center py-24 bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-xl text-slate-400">
                    {analysis ? (
                        <div className="max-w-md mx-auto">
                            <h3 className="text-2xl font-black text-slate-800 font-serif-sc mb-4">选择报告类型</h3>
                            <p className="mb-8 text-slate-500">已完成处方计算，请选择一种模式生成 AI 深度分析。</p>
                            
                            <div className="flex flex-col gap-4">
                                <button 
                                    onClick={() => handleAskAI('deep')} 
                                    className="w-full p-4 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">🧠</span>
                                        <div className="text-left">
                                            <div className="font-bold">生成深度推演报告</div>
                                            <div className="text-xs text-indigo-200 font-normal opacity-80">完整 6 步推演 / 局势博弈论 / 耗时较长</div>
                                        </div>
                                    </div>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                </button>

                                <button 
                                    onClick={() => handleAskAI('quick')} 
                                    className="w-full p-4 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl hover:border-amber-200 hover:text-amber-800 hover:bg-amber-50 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">⚡</span>
                                        <div className="text-left">
                                            <div className="font-bold">生成快速审核报告</div>
                                            <div className="text-xs text-slate-400 font-normal group-hover:text-amber-700/70">找漏洞 / 提建议 / 拓思路 / 临床辅助</div>
                                        </div>
                                    </div>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                </button>
                            </div>
                            
                            <div className="flex justify-center mt-8">
                                <button 
                                    onClick={() => setShowReportHistory(true)} 
                                    className="text-xs font-bold text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <span>☁️</span> 查看云端历史报告
                                </button>
                            </div>

                            <button 
                                onClick={() => setView(ViewMode.INPUT)} 
                                className="mt-8 text-sm text-slate-400 hover:text-slate-600 underline block mx-auto"
                            >
                                放弃当前结果，开始新演算
                            </button>
                        </div>
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

        <div className={`h-[calc(100vh-8rem)] max-w-[1600px] mx-auto animate-in zoom-in-95 flex flex-col ${view === ViewMode.AI_CHAT && analysis ? '' : 'hidden'}`}>
             {analysis && (
                 <AIChatbot 
                    analysis={analysis} 
                    prescriptionInput={input} 
                    reportContent={reports[activeReportVersion]} 
                    onUpdatePrescription={handleUpdatePrescriptionFromChat}
                    onRegenerateReport={(instr) => handleAskAI('regenerate', instr)}
                    onHerbClick={handleHerbClick}
                    settings={aiSettings}
                    metaInfo={metaInfo}
                    onUpdateMetaInfo={setMetaInfo}
                 />
             )}
        </div>
        
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

// Wrap App with Providers
export default function App() {
  return (
    <LogProvider>
      <LogicMasterApp />
    </LogProvider>
  );
}
