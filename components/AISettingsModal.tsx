



import React, { useState } from 'react';
import { AISettings } from '../types';
import { fetchAvailableModels, testModelConnection, DEFAULT_ANALYZE_SYSTEM_INSTRUCTION } from '../services/openaiService';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (newSettings: AISettings) => void;
}

export const AISettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'cloud'>('api');
  
  // Health Check State Removed

  // Sync when opening
  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setFetchError(null);
      setTestResult(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleReset = () => {
    if (window.confirm("确定要恢复默认参数吗？(API Key 不会被清除)")) {
      setLocalSettings(prev => ({
        ...prev,
        temperature: 0, // Medical default
        topK: 64,
        topP: 0.95,
        maxTokens: 8192,
        thinkingBudget: 0,
        // Keep credentials
      }));
    }
  };
  
  const handleTestConnection = async () => {
      if (!localSettings.apiBaseUrl || !localSettings.apiKey) {
          setTestResult("请先填写 API Base URL 和 API Key");
          return;
      }
      setIsTesting(true);
      setTestResult(null);
      try {
          const msg = await testModelConnection(localSettings.apiBaseUrl, localSettings.apiKey);
          setTestResult(msg);
      } catch (e: any) {
          setTestResult(`连接失败: ${e.message}`);
      } finally {
          setIsTesting(false);
      }
  };

  const handleFetchModels = async () => {
    if (!localSettings.apiBaseUrl || !localSettings.apiKey) {
        setFetchError("请先填写 API Base URL 和 API Key");
        return;
    }
    
    setIsFetchingModels(true);
    setFetchError(null);
    try {
        const models = await fetchAvailableModels(localSettings.apiBaseUrl, localSettings.apiKey);
        if (models.length > 0) {
            setLocalSettings(prev => ({
                ...prev,
                availableModels: models,
                // If current selection is empty or not in list, maybe auto-select first one?
                analysisModel: prev.analysisModel || models[0].id,
                chatModel: prev.chatModel || models[0].id
            }));
            alert(`成功获取 ${models.length} 个模型！`);
        } else {
            setFetchError("未获取到模型列表，请检查地址或 Key 权限。");
        }
    } catch (e: any) {
        setFetchError(e.message);
    } finally {
        setIsFetchingModels(false);
    }
  };
  
  const handleSave = () => {
    // Ensure system instruction is passed through (even though invisible)
    onSave({
        ...localSettings,
        systemInstruction: DEFAULT_ANALYZE_SYSTEM_INSTRUCTION
    });
    onClose();
    // Prompt for reload if Cloud settings changed to ensure sync starts
    if (settings.supabaseUrl !== localSettings.supabaseUrl) {
       if(window.confirm("云数据库设置已更改，是否刷新页面以加载云端数据？")) {
           window.location.reload();
       }
    }
  };
  
  const isUsingDefaultCloud = localSettings.supabaseUrl === DEFAULT_SUPABASE_URL;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div 
        className="relative bg-white w-full max-w-4xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-2xl shadow-lg">☁️</div>
             <div>
               <h2 className="text-2xl font-black text-white font-serif-sc tracking-wide">云端服务配置</h2>
               <p className="text-indigo-200 text-sm font-medium">Universal AI & Database Cloud Settings</p>
             </div>
          </div>
          <button 
             onClick={onClose}
             className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
            <button 
                onClick={() => setActiveTab('api')}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'api' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                API & 模型
            </button>
            <button 
                onClick={() => setActiveTab('cloud')}
                className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'cloud' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                云数据库 (Supabase)
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {isUsingDefaultCloud ? '内置(已连接)' : '同步'}
                </span>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50">
          
          {activeTab === 'api' && (
              <>
                {/* 1. API Credentials Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-full"></span> 接口连接 (API Connection)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">API Base URL (通用地址)</label>
                            <input 
                            type="text"
                            value={localSettings.apiBaseUrl}
                            onChange={e => setLocalSettings({...localSettings, apiBaseUrl: e.target.value})}
                            placeholder="例如: https://lbls888-lap.hf.space/v1"
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            />
                            <p className="text-xs text-slate-400">支持 OpenAI 官方或任意 One-API/New-API 中转地址</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">API Key (密钥)</label>
                            <input 
                            type="password"
                            value={localSettings.apiKey}
                            onChange={e => setLocalSettings({...localSettings, apiKey: e.target.value})}
                            placeholder="sk-..."
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                        <button 
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition flex items-center gap-2 border border-slate-300"
                        >
                        {isTesting ? <span className="animate-spin">⏳</span> : '⚡'} 测试连接
                        </button>
                        
                        <button 
                        onClick={handleFetchModels}
                        disabled={isFetchingModels}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 transition flex items-center gap-2"
                        >
                        {isFetchingModels ? <span className="animate-spin">⏳</span> : '🔄'} 自动获取模型列表
                        </button>
                        
                        {testResult && (
                            <span className={`text-sm font-bold ${testResult.includes('失败') ? 'text-red-500' : 'text-emerald-600'}`}>
                                {testResult}
                            </span>
                        )}
                        {fetchError && <p className="text-red-500 text-xs mt-2 font-bold">{fetchError}</p>}
                    </div>
                </div>

                {/* 2. Model Selection */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-indigo-500 rounded-full"></span> 模型指派 (Model Assignment)
                    </h3>
                    
                    {localSettings.availableModels.length === 0 && (
                        <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-100 mb-4">
                            尚未获取模型列表。您可以手动输入模型 ID，或点击上方按钮自动获取。
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Analysis Model */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex justify-between">
                                <span>AI 深度推演模型</span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">建议 GPT-4 / Claude-3.5-Sonnet</span>
                            </label>
                            {localSettings.availableModels.length > 0 ? (
                                <select 
                                value={localSettings.analysisModel}
                                onChange={e => setLocalSettings({...localSettings, analysisModel: e.target.value})}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                                >
                                    {localSettings.availableModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                type="text" 
                                value={localSettings.analysisModel}
                                onChange={e => setLocalSettings({...localSettings, analysisModel: e.target.value})}
                                placeholder="手动输入 ID (如 gpt-4)"
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                                />
                            )}
                        </div>

                        {/* Chat Model */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex justify-between">
                                <span>AI 问答助手模型</span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">建议 GPT-3.5 / 4o-mini</span>
                            </label>
                            {localSettings.availableModels.length > 0 ? (
                                <select 
                                value={localSettings.chatModel}
                                onChange={e => setLocalSettings({...localSettings, chatModel: e.target.value})}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                                >
                                    {localSettings.availableModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                type="text" 
                                value={localSettings.chatModel}
                                onChange={e => setLocalSettings({...localSettings, chatModel: e.target.value})}
                                placeholder="手动输入 ID (如 gpt-3.5-turbo)"
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Advanced Params */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <span className="w-2 h-6 bg-pink-500 rounded-full"></span> 高级参数 (Advanced)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Temperature */}
                        <div>
                        <div className="flex justify-between mb-2">
                            <label className="font-bold text-slate-700 text-sm">创意度 (Temperature)</label>
                            <span className="font-mono text-indigo-600 font-bold">{localSettings.temperature}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1"
                            value={localSettings.temperature}
                            onChange={e => setLocalSettings({...localSettings, temperature: parseFloat(e.target.value)})}
                            className="w-full accent-indigo-600"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            医疗/严谨任务建议为 0。数值越高，回复越随机。
                        </p>
                        </div>

                        {/* Top P */}
                        <div>
                        <div className="flex justify-between mb-2">
                            <label className="font-bold text-slate-700 text-sm">核采样 (Top P)</label>
                            <span className="font-mono text-indigo-600 font-bold">{localSettings.topP ?? 0.95}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.05"
                            value={localSettings.topP ?? 0.95}
                            onChange={e => setLocalSettings({...localSettings, topP: parseFloat(e.target.value)})}
                            className="w-full accent-indigo-600"
                        />
                        </div>
                        
                        {/* Max Tokens */}
                        <div>
                        <div className="flex justify-between mb-2">
                            <label className="font-bold text-slate-700 text-sm">最大长度 (Max Tokens)</label>
                        </div>
                        <input 
                            type="number"
                            value={localSettings.maxTokens ?? 8192}
                            onChange={e => setLocalSettings({...localSettings, maxTokens: parseInt(e.target.value)})}
                            className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                            placeholder="8192"
                        />
                        </div>
                    </div>
                </div>
              </>
          )}

          {activeTab === 'cloud' && (
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-full"></span> Supabase 配置
                    </h3>
                    
                    {isUsingDefaultCloud && (
                        <div className="bg-indigo-50 text-indigo-700 text-sm p-4 rounded-xl border border-indigo-100 flex items-center gap-2">
                            <span>✅</span>
                            <strong>当前正在使用内置的公共数据库连接。您无需任何操作，即可享受云同步服务。</strong>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Project URL (项目地址)</label>
                            <input 
                            type="text"
                            value={localSettings.supabaseUrl || ''}
                            onChange={e => setLocalSettings({...localSettings, supabaseUrl: e.target.value})}
                            placeholder={isUsingDefaultCloud ? "(内置默认)" : "https://xyz.supabase.co"}
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Anon Public Key (公开密钥)</label>
                            <input 
                            type="password"
                            value={localSettings.supabaseKey || ''}
                            onChange={e => setLocalSettings({...localSettings, supabaseKey: e.target.value})}
                            placeholder={isUsingDefaultCloud ? "(内置默认)" : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                            <p className="text-xs text-slate-400">请使用 `anon` (public) key，不要使用 `service_role` key。</p>
                        </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                     <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-cyan-500 rounded-full"></span> 数据库状态
                    </h3>
                    <p className="text-sm text-slate-500">
                        数据管理（删除、清空）功能已移至您的 Supabase 后台，以确保操作的安全性和可追溯性。
                        您可以通过“批量导入”工具中的“数据库初始化”来创建或检查您的数据表结构。
                    </p>
                  </div>
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white p-6 border-t border-slate-100 flex justify-between gap-4 shrink-0">
           <button 
             onClick={handleReset}
             className="px-4 py-3 rounded-xl font-bold text-xs text-slate-400 hover:text-red-500 transition"
           >
             重置参数
           </button>
           <div className="flex gap-4">
               <button 
                 onClick={onClose}
                 className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
               >
                 取消
               </button>
               <button 
                 onClick={handleSave}
                 className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1 transition-all"
               >
                 保存并应用
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};