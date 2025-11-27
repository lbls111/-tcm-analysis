
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateChatStream, OpenAIMessage, OpenAIToolCall } from '../services/openaiService';
import { AnalysisResult, AISettings } from '../types';
import { searchHerbsForAI, FULL_HERB_LIST } from '../data/herbDatabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { fetchCloudChatSessions, saveCloudChatSession, deleteCloudChatSession } from '../services/supabaseService';
import { MetaInfoModal } from './MetaInfoModal';

// ==========================================
// 1. Types
// ==========================================
interface Message {
  role: 'user' | 'model' | 'tool';
  text: string;
  isError?: boolean;
  // For Tool/Function logic
  toolCalls?: OpenAIToolCall[]; // When role='model', it might request tools
  toolCallId?: string; // When role='tool', this links back to the request
  functionName?: string; // Display name for the tool
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  metaInfo?: string; // Session-specific context
}

interface Props {
  analysis: AnalysisResult;
  prescriptionInput: string;
  reportContent?: string;
  onUpdatePrescription?: (newPrescription: string) => void;
  onRegenerateReport?: (instructions: string) => void;
  onHerbClick?: (herbName: string) => void;
  settings: AISettings;
}

const LS_CHAT_SESSIONS_KEY = "logicmaster_chat_sessions";

// ==========================================
// 2. Helpers (Auto Linking)
// ==========================================

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 3. Sub-Components (Message Item)
// ==========================================

interface MessageItemProps {
  message: Message;
  index: number;
  isLoading: boolean;
  isLast: boolean;
  onDelete: (index: number) => void;
  onRegenerate: (index: number) => void;
  onEdit: (index: number, newText: string, resend: boolean) => void;
  onContinue: () => void;
  onHerbClick?: (herbName: string) => void;
  onCitationClick: (type: 'report' | 'meta') => void;
  herbRegex: RegExp;
}

// Enhanced Herb Card (Pill Style)
const HerbPill: React.FC<{name: string, onClick: (name: string) => void}> = ({ name, onClick }) => (
    <span 
      onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(name);
      }}
      className="inline-flex items-center gap-1.5 mx-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-indigo-700 border border-indigo-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 hover:shadow-sm transition-all transform hover:-translate-y-0.5 align-middle select-none group"
      title={`查看【${name}】药典详情`}
      role="button"
    >
        <span className="text-[10px] opacity-70 group-hover:opacity-100">💊</span>
        <span className="border-b border-transparent group-hover:border-indigo-300">{name}</span>
    </span>
);

const CitationLink: React.FC<{type: 'report' | 'meta', onClick: () => void}> = ({ type, onClick }) => (
    <span 
      onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
      }}
      className={`inline-flex items-center gap-1.5 mx-1 px-2 py-0.5 rounded-md text-xs font-bold cursor-pointer transition-all transform hover:-translate-y-0.5 align-middle shadow-sm select-none border group ${type === 'report' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
      role="button"
    >
        <span className="opacity-70">{type === 'report' ? '📑' : '🧠'}</span>
        <span className="border-b border-transparent group-hover:border-current">{type === 'report' ? 'AI报告' : '元信息'}</span>
    </span>
);

const ChatMessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  index, 
  isLoading, 
  isLast,
  onDelete, 
  onRegenerate, 
  onEdit,
  onContinue,
  onHerbClick,
  onCitationClick,
  herbRegex
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.text);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    setEditValue(message.text);
  }, [message.text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const handleSaveEdit = () => {
    if (editValue.trim() !== message.text) {
      const shouldResend = message.role === 'user';
      onEdit(index, editValue, shouldResend);
    }
    setIsEditing(false);
  };

  const renderTextWithAutoLinks = (text: string) => {
      if (!text) return null;

      // 1. Pre-process Citations into special HTML links that we can intercept
      // Using <a> tags is more robust with rehype-raw than Markdown links when mixed with HTML
      let processingText = text;
      processingText = processingText.replace(/\[\[AI报告\]\]/g, '<a href="citation://report">[[AI报告]]</a>');
      processingText = processingText.replace(/\[\[元信息\]\]/g, '<a href="citation://meta">[[元信息]]</a>');

      // 2. Identify protected segments (HTML tags) to avoid replacing inside them
      const protectedRegex = /(<[^>]+>)/g;
      const parts = processingText.split(protectedRegex);

      // 3. Inject Herb Links as HTML <a> tags in text segments
      const finalString = parts.map(part => {
          if (part.match(protectedRegex)) return part;
          
          // Replace herbs with HTML Anchor syntax: <a href="herb://Name">Name</a>
          return part.replace(herbRegex, (match) => `<a href="herb://${match}">${match}</a>`);
      }).join('');
      
      return (
        <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
                // Intercept ALL Links
                a: ({node, href, children, ...props}) => {
                    // Safety check
                    if (!href) return <a {...props}>{children}</a>;

                    // 1. Intercept Herb Links
                    if (href.startsWith('herb://')) {
                        const name = decodeURIComponent(href.replace('herb://', ''));
                        return <HerbPill name={name} onClick={onHerbClick || (() => {})} />;
                    }
                    
                    // 2. Intercept Citation Links
                    if (href.startsWith('citation://')) {
                        const type = href.replace('citation://', '') as 'report' | 'meta';
                        return <CitationLink type={type} onClick={() => onCitationClick(type)} />;
                    }
                    
                    // 3. Standard External Links
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline decoration-blue-300 hover:text-blue-800" {...props}>{children}</a>;
                },
                // Style other elements
                table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 shadow-sm"><table className="border-collapse table-auto w-full text-sm" {...props} /></div>,
                thead: ({node, ...props}) => <thead className="bg-slate-50 border-b border-slate-200 text-slate-600" {...props} />,
                th: ({node, ...props}) => <th className="px-4 py-3 text-left font-bold whitespace-nowrap" {...props} />,
                td: ({node, ...props}) => <td className="border-t border-slate-100 px-4 py-2" {...props} />,
                img: ({node, ...props}) => <img className="max-w-full rounded-lg shadow-sm" {...props} alt="" />,
                p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                // Clean up spans if any residue remains
                span: ({node, className, children, ...props}) => <span className={className} {...props}>{children}</span>,
            }}
        >
            {finalString}
        </ReactMarkdown>
      );
  };

  if (message.role === 'tool') return null;
  if (message.role === 'model' && !message.text && message.toolCalls && message.toolCalls.length > 0) return null;

  return (
    <div className={`flex items-start gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group mb-6 animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm border border-white/50 ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-100'}`}>
        {message.role === 'user' ? '您' : 'AI'}
      </div>

      <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[95%] lg:max-w-[85%]`}>
        {isEditing ? (
          <div className="w-full min-w-[300px] bg-white border-2 border-indigo-400 rounded-2xl p-4 shadow-xl z-10">
            <textarea 
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-32 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 resize-none font-mono"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md font-bold">取消</button>
              <button onClick={handleSaveEdit} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-md font-bold">{message.role === 'user' ? '保存并重发' : '保存'}</button>
            </div>
          </div>
        ) : (
          <div className={`relative px-6 py-5 rounded-2xl text-base leading-7 shadow-sm border overflow-x-auto ${
            message.role === 'user' ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'
          }`}>
             {message.isError ? (
               <div className="flex items-center gap-2 text-red-400">
                 <span>⚠️ {message.text}</span>
               </div>
             ) : (
                renderTextWithAutoLinks(message.text || '')
             )}
             
             {message.role === 'model' && isLast && !isLoading && (
                 <button onClick={onContinue} className="mt-4 text-xs bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full border border-indigo-200 hover:bg-indigo-100 font-bold flex items-center gap-2 transition-all">
                    <span>↪</span> 继续生成
                 </button>
             )}
          </div>
        )}

        {!isEditing && !isLoading && (
          <div className={`flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${message.role === 'user' ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
             <ActionButton icon="📋" label={copyStatus === 'copied' ? '已复制' : '复制'} onClick={handleCopy} />
             <ActionButton icon="✎" label="编辑" onClick={() => setIsEditing(true)} />
             <ActionButton icon="↻" label={message.role === 'user' ? '重新发送' : '重新生成'} onClick={() => onRegenerate(index)} />
             <ActionButton icon="🗑️" label="删除" onClick={() => onDelete(index)} isDestructive />
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: string, label: string, onClick: () => void, isDestructive?: boolean }> = ({ icon, label, onClick, isDestructive }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${isDestructive ? 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100'}`}
    title={label}
  >
    <span>{icon}</span><span className="hidden sm:inline">{label}</span>
  </button>
);

export const AIChatbot: React.FC<Props> = ({ analysis, prescriptionInput, reportContent, onUpdatePrescription, onRegenerateReport, onHerbClick, settings }) => {
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isToolExecuting, setIsToolExecuting] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [viewingReference, setViewingReference] = useState<{type: 'report' | 'meta', content: string} | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(0);

  const sortedHerbNames = useMemo(() => FULL_HERB_LIST.map(h => h.name).sort((a, b) => b.length - a.length), [FULL_HERB_LIST.length]); 
  const herbRegex = useMemo(() => {
      if (sortedHerbNames.length === 0) return /(?!)/;
      const escaped = sortedHerbNames.map(escapeRegExp);
      return new RegExp(`(${escaped.join('|')})`, 'g');
  }, [sortedHerbNames]);

  useEffect(() => {
    const init = async () => {
        let loadedFromCloud = false;
        if (settings.supabaseKey) {
            const cloudSessions = await fetchCloudChatSessions(settings);
            if (cloudSessions.length > 0) {
                const sessionMap: Record<string, Session> = {};
                cloudSessions.forEach(cs => {
                    sessionMap[cs.id] = { id: cs.id, title: cs.title, messages: cs.messages, createdAt: cs.created_at, metaInfo: cs.meta_info };
                });
                setSessions(sessionMap);
                setActiveSessionId(cloudSessions[0].id);
                loadedFromCloud = true;
            }
        }
        if (!loadedFromCloud) {
            try {
                const saved = localStorage.getItem(LS_CHAT_SESSIONS_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setSessions(parsed);
                    const lastActive = localStorage.getItem('logicmaster_last_active_session');
                    if (lastActive && parsed[lastActive]) setActiveSessionId(lastActive);
                    else if (Object.keys(parsed).length > 0) setActiveSessionId(Object.keys(parsed)[0]);
                }
            } catch (e) {}
        }
        setSessions(current => {
            if (Object.keys(current).length === 0) {
                 const newId = `session_${Date.now()}`;
                 const newSession = { id: newId, title: "新的研讨", createdAt: Date.now(), messages: [{ role: 'model' as const, text: '我是您的 AI 中医助手。' }], metaInfo: "" };
                 setActiveSessionId(newId);
                 if (settings.supabaseKey) saveCloudChatSession({ ...newSession, created_at: newSession.createdAt, meta_info: newSession.metaInfo }, settings);
                 return { [newId]: newSession };
            }
            return current;
        });
    };
    init();
  }, [settings.supabaseKey]);

  useEffect(() => {
    if (Object.keys(sessions).length > 0) localStorage.setItem(LS_CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    if (activeSessionId) localStorage.setItem('logicmaster_last_active_session', activeSessionId);
    
    if (activeSessionId && sessions[activeSessionId] && settings.supabaseKey) {
        const sess = sessions[activeSessionId];
        if (sess.messages.length > 1 || sess.metaInfo) {
             saveCloudChatSession({ id: sess.id, title: sess.title, messages: sess.messages, created_at: sess.createdAt, meta_info: sess.metaInfo }, settings);
        }
    }
  }, [sessions, activeSessionId, settings]);

  useEffect(() => {
    const currentMsgs = activeSessionId ? sessions[activeSessionId]?.messages || [] : [];
    if (messageCountRef.current !== currentMsgs.length) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        messageCountRef.current = currentMsgs.length;
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const createNewSession = () => {
    const newId = `session_${Date.now()}`;
    const newSession = { id: newId, title: "新的研讨", createdAt: Date.now(), messages: [{ role: 'model' as const, text: '我是您的 AI 中医助手。' }], metaInfo: "" };
    setSessions(prev => ({ ...prev, [newId]: newSession }));
    setActiveSessionId(newId);
    if (settings.supabaseKey) saveCloudChatSession({ ...newSession, created_at: newSession.createdAt, meta_info: newSession.metaInfo }, settings);
    return newId;
  };
  
  const handleManualSave = async () => {
      if (!activeSessionId || !sessions[activeSessionId]) return;
      if (!settings.supabaseKey) return alert("保存失败：未配置 Supabase 连接。");
      setIsSavingCloud(true);
      const sess = sessions[activeSessionId];
      const success = await saveCloudChatSession({ id: sess.id, title: sess.title, messages: sess.messages, created_at: sess.createdAt, meta_info: sess.metaInfo }, settings);
      setIsSavingCloud(false);
      alert(success ? "☁️ 会话已同步到云端数据库。" : "❌ 同步失败。");
  };

  const deleteSession = (id: string, e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!window.confirm("确认删除此会话记录吗？")) return;
    if (settings.supabaseKey) deleteCloudChatSession(id, settings);
    setSessions(prev => {
      const next = { ...prev };
      delete next[id];
      if (activeSessionId === id) {
          const ids = Object.keys(next).sort((a, b) => next[b].createdAt - next[a].createdAt);
          setActiveSessionId(ids.length > 0 ? ids[0] : null);
          if (ids.length === 0) createNewSession();
      }
      return next;
    });
  };

  const activeMessages = activeSessionId ? sessions[activeSessionId]?.messages || [] : [];
  const activeMetaInfo = activeSessionId ? sessions[activeSessionId]?.metaInfo || "" : "";

  const handleUpdateMetaInfo = (newInfo: string) => {
      if (!activeSessionId) return;
      setSessions(prev => ({ ...prev, [activeSessionId]: { ...prev[activeSessionId], metaInfo: newInfo } }));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsToolExecuting(false);
    }
  };

  const handleDeleteMessage = (index: number) => {
    if (!activeSessionId) return;
    setSessions(prev => {
      const sess = { ...prev[activeSessionId] };
      sess.messages = sess.messages.filter((_, i) => i !== index);
      return { ...prev, [activeSessionId]: sess };
    });
  };

  const handleEditMessage = (index: number, newText: string, shouldResend: boolean) => {
    if (!activeSessionId) return;
    setSessions(prev => {
       const sess = { ...prev[activeSessionId] };
       sess.messages[index] = { ...sess.messages[index], text: newText };
       return { ...prev, [activeSessionId]: sess };
    });
    if (shouldResend) handleRegenerate(index);
  };

  const handleRegenerate = async (index: number) => {
     if (!activeSessionId || isLoading) return;
     const currentMessages = sessions[activeSessionId].messages;
     const newHistory = currentMessages[index].role === 'user' ? currentMessages.slice(0, index + 1) : currentMessages.slice(0, index);
     setSessions(prev => ({ ...prev, [activeSessionId]: { ...prev[activeSessionId], messages: newHistory } }));
     await runGeneration(activeSessionId, newHistory);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    let targetSessionId = activeSessionId || createNewSession();
    const userMsg = { role: 'user' as const, text: input };
    const currentInput = input;
    setInput('');
    setSessions(prev => {
        const sess = { ...prev[targetSessionId] };
        sess.messages = [...sess.messages, userMsg];
        if (sess.messages.length <= 2) sess.title = currentInput.slice(0, 20) + (currentInput.length > 20 ? '...' : '');
        return { ...prev, [targetSessionId]: sess };
    });
    await runGeneration(targetSessionId, [...sessions[targetSessionId].messages, userMsg]);
  };

  const handleContinue = async () => {
     if (!activeSessionId || isLoading) return;
     const userMsg = { role: 'user' as const, text: "请继续 (Please continue output)" };
     setSessions(prev => {
        const sess = { ...prev[activeSessionId] };
        sess.messages = [...sess.messages, userMsg];
        return { ...prev, [activeSessionId]: sess };
     });
     await runGeneration(activeSessionId, [...sessions[activeSessionId].messages, userMsg]);
  };
  
  const handleCitationClick = (type: 'report' | 'meta') => {
      const content = type === 'report' ? (reportContent || '暂无报告') : (activeMetaInfo || '暂无元信息');
      setViewingReference({ type, content });
  };

  const runGeneration = async (sessionId: string, history: Message[]) => {
      setIsLoading(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentMetaInfo = sessions[sessionId]?.metaInfo || "";
      
      const apiHistory: OpenAIMessage[] = history.map(m => 
          m.role === 'tool' ? { role: 'tool', tool_call_id: m.toolCallId, content: m.text } :
          m.role === 'model' ? { role: 'assistant', content: m.text || null, tool_calls: m.toolCalls } :
          { role: m.role, content: m.text }
      );

      setSessions(prev => {
          const sess = { ...prev[sessionId] };
          sess.messages = [...sess.messages, { role: 'model', text: '' }];
          return { ...prev, [sessionId]: sess };
      });

      try {
          const stream = generateChatStream(apiHistory, analysis, prescriptionInput, reportContent, settings, controller.signal, currentMetaInfo);
          let fullText = '';
          let toolCallsResult: {id: string, name: string, args: any}[] = [];
          
          for await (const chunk of stream) {
              if (chunk.text) {
                  fullText += chunk.text;
                  setSessions(prev => {
                      const sess = { ...prev[sessionId] };
                      const lastIdx = sess.messages.length - 1;
                      if (lastIdx >= 0) sess.messages[lastIdx] = { ...sess.messages[lastIdx], text: fullText };
                      return { ...prev, [sessionId]: sess };
                  });
              }
              if (chunk.functionCalls) toolCallsResult = chunk.functionCalls;
          }

          if (toolCallsResult.length > 0) {
              setIsToolExecuting(true);
              const assistantMsg: Message = { role: 'model', text: fullText, toolCalls: toolCallsResult.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) };
              setSessions(prev => {
                  const sess = { ...prev[sessionId] };
                  sess.messages[sess.messages.length - 1] = assistantMsg;
                  return { ...prev, [sessionId]: sess };
              });
              
              const nextHistory = [...history, assistantMsg];
              for (const tool of toolCallsResult) {
                  let result = "";
                  if (tool.name === 'lookup_herb') result = searchHerbsForAI(tool.args.query);
                  else if (tool.name === 'update_prescription') { onUpdatePrescription?.(tool.args.prescription); result = "Prescription updated."; }
                  else if (tool.name === 'regenerate_report') { onRegenerateReport?.(tool.args.instructions); result = "Report regeneration triggered."; }
                  else result = "Unknown tool.";
                  
                  const toolMsg: Message = { role: 'tool', toolCallId: tool.id, functionName: tool.name, text: result };
                  nextHistory.push(toolMsg);
                  setSessions(prev => {
                      const sess = { ...prev[sessionId] };
                      sess.messages.push(toolMsg);
                      return { ...prev, [sessionId]: sess };
                  });
              }
              await runGeneration(sessionId, nextHistory);
          } else {
              setIsToolExecuting(false);
          }
      } catch (e: any) {
          setIsToolExecuting(false);
          if (e.name !== 'AbortError') {
              setSessions(prev => {
                  const sess = { ...prev[sessionId] };
                  const lastIdx = sess.messages.length - 1;
                  sess.messages[lastIdx] = { ...sess.messages[lastIdx], text: sess.messages[lastIdx].text + `\n[系统错误]`, isError: true };
                  return { ...prev, [sessionId]: sess };
              });
          }
      } finally {
          setIsLoading(false);
          abortControllerRef.current = null;
      }
  };

  return (
    <div className="flex h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      <MetaInfoModal isOpen={showMetaModal} onClose={() => setShowMetaModal(false)} metaInfo={activeMetaInfo} onSave={handleUpdateMetaInfo} />
      
      {viewingReference && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingReference(null)}></div>
              <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          {viewingReference.type === 'report' ? '📊 AI 分析报告摘要' : '🧠 研讨元信息'}
                      </h3>
                      <button onClick={() => setViewingReference(null)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                     {viewingReference.type === 'report' ? (
                         <div className="space-y-8">
                             {/* Summary Card */}
                             <div className="bg-gradient-to-br from-indigo-50 to-slate-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
                                 <h4 className="font-black text-indigo-900 mb-4 flex items-center gap-2">
                                     <span className="text-xl">⚡</span> 核心计算结论 (Calculated Insight)
                                 </h4>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                     <div className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                                         <div className="text-xs text-slate-400 uppercase font-bold mb-1">总能量指数 (Total PTI)</div>
                                         <div className="text-2xl font-mono font-black text-slate-800">{analysis.totalPTI.toFixed(2)}</div>
                                     </div>
                                     <div className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                                         <div className="text-xs text-slate-400 uppercase font-bold mb-1">核心驱动 (Primary)</div>
                                         <div className="text-xl font-serif-sc font-bold text-slate-800">{analysis.top3.slice(0,2).map(h=>h.name).join(' + ')}</div>
                                     </div>
                                      <div className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                                         <div className="text-xs text-slate-400 uppercase font-bold mb-1">三焦分布 (San Jiao)</div>
                                         <div className="flex gap-2 mt-1">
                                             <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">上 {analysis.sanJiao.upper.percentage.toFixed(0)}%</span>
                                             <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">中 {analysis.sanJiao.middle.percentage.toFixed(0)}%</span>
                                             <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">下 {analysis.sanJiao.lower.percentage.toFixed(0)}%</span>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                             
                             {/* Full Content Accordion */}
                             <details className="group border border-slate-200 rounded-2xl overflow-hidden">
                                 <summary className="cursor-pointer bg-slate-50 p-4 font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 select-none flex items-center justify-between transition-colors">
                                     <span>📄 查看完整 AI 深度推演原文</span>
                                     <span className="group-open:rotate-180 transition-transform">▼</span>
                                 </summary>
                                 <div className="prose prose-slate max-w-none p-8 text-sm leading-relaxed" dangerouslySetInnerHTML={{__html: viewingReference.content}}></div>
                             </details>
                         </div>
                     ) : (
                         <div className="whitespace-pre-wrap text-slate-700 leading-loose text-lg font-serif-sc">{viewingReference.content}</div>
                     )}
                  </div>
              </div>
          </div>
      )}

      <div className="w-64 bg-slate-50 border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-4 border-b border-slate-200">
           <button onClick={() => createNewSession()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"><span className="text-xl">+</span> 新的研讨</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
           {(Object.values(sessions) as Session[]).sort((a, b) => b.createdAt - a.createdAt).map((session) => (
               <div key={session.id} onClick={() => setActiveSessionId(session.id)} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${activeSessionId === session.id ? 'bg-white border-indigo-200 shadow-sm' : 'hover:bg-slate-200/50 border-transparent'}`}>
                 <div className="flex flex-col gap-1 overflow-hidden flex-1 min-w-0">
                     <div className="flex items-center gap-3">
                        <span className={`text-lg ${activeSessionId === session.id ? 'text-indigo-600' : 'text-slate-400'}`}>{activeSessionId === session.id ? '💬' : '🗨️'}</span>
                        <span className={`text-sm font-medium truncate flex-1 ${activeSessionId === session.id ? 'text-slate-800' : 'text-slate-600'}`}>{session.title}</span>
                     </div>
                     {session.metaInfo && <div className="flex items-center gap-1 pl-8"><span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100 truncate">🧠 有元信息</span></div>}
                 </div>
                 <button onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all z-10 relative">✕</button>
               </div>
           ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[#fcfcfc]">
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur z-10">
           <div>
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
               智能研讨助手
               <span className={`text-[10px] px-2 py-0.5 rounded-full border ${settings.supabaseKey ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{settings.supabaseKey ? '☁️ 云同步开启' : '📁 本地模式'}</span>
             </h3>
           </div>
           <div className="flex items-center gap-3">
               <button onClick={() => setShowMetaModal(true)} className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${activeMetaInfo ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-600'}`}><span>🧠</span> {activeMetaInfo ? '元信息已设定' : '设置元信息'}</button>
               <button onClick={handleManualSave} disabled={isSavingCloud || !settings.supabaseKey} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50">{isSavingCloud ? <span className="animate-spin">⏳</span> : <span>☁️</span>}{isSavingCloud ? '同步中' : '保存会话'}</button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
           {activeMessages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4"><div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl">🤖</div><p>暂无消息，请开始提问。</p></div>
           ) : (
             activeMessages.map((msg, i) => <ChatMessageItem key={i} index={i} message={msg} isLoading={isLoading} isLast={i === activeMessages.length - 1} onDelete={handleDeleteMessage} onRegenerate={handleRegenerate} onEdit={handleEditMessage} onContinue={handleContinue} onHerbClick={onHerbClick} onCitationClick={handleCitationClick} herbRegex={herbRegex} />)
           )}
           <div ref={messagesEndRef} className="h-4" />
        </div>
        
        {isToolExecuting && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-indigo-100 shadow-lg px-4 py-2 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 z-30"><div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><span className="text-xs font-bold text-indigo-700">正在查阅药典数据库...</span></div>}

        <div className="p-6 bg-white border-t border-slate-100 relative z-20">
           <div className="flex gap-4 items-end max-w-5xl mx-auto">
              <div className="flex-1 relative">
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={isLoading ? "AI 正在思考中..." : "输入问题，Shift+Enter 换行..."} disabled={isLoading} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none shadow-inner transition-all disabled:bg-slate-100 disabled:text-slate-400 font-sans" rows={1} />
              </div>
              <button onClick={isLoading ? handleStop : handleSend} disabled={!isLoading && !input.trim()} className={`h-[52px] w-[52px] rounded-2xl flex items-center justify-center shadow-lg transition-all ${isLoading ? 'bg-red-50 text-red-500 border border-red-100 hover:bg-red-100' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 disabled:bg-slate-300 disabled:shadow-none'}`}>
                 {isLoading ? <span className="w-3 h-3 bg-red-500 rounded-sm"></span> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
