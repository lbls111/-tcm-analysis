
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateChatStream, OpenAIMessage, OpenAIToolCall } from '../services/openaiService';
import { AnalysisResult, AISettings } from '../types';
import { searchHerbsForAI, FULL_HERB_LIST } from '../data/herbDatabase';
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
}

interface Props {
  analysis: AnalysisResult;
  prescriptionInput: string;
  reportContent?: string;
  onUpdatePrescription?: (newPrescription: string) => void;
  onRegenerateReport?: (instructions: string) => void;
  onHerbClick?: (herbName: string) => void;
  settings: AISettings;
  metaInfo: string;
  onUpdateMetaInfo: (info: string) => void;
}

const LS_CHAT_SESSIONS_KEY = "logicmaster_chat_sessions";

// ==========================================
// 2. Sub-Components (Message Item)
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
  herbRegex: RegExp | null;
}

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

  // Reset edit state when message changes externally
  useEffect(() => {
    setEditValue(message.text);
  }, [message.text]);

  const handleCopy = () => {
    // Strip HTML tags for copying text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message.text;
    const plainText = tempDiv.textContent || tempDiv.innerText || message.text;
    
    navigator.clipboard.writeText(plainText).then(() => {
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
  
  // Event Delegation for clicking Herbs/Citations inside Dangerous HTML
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      
      // 1. Check for Herb Link
      const herbSpan = target.closest('[data-herb]');
      if (herbSpan) {
          const herbName = herbSpan.getAttribute('data-herb');
          if (herbName && onHerbClick) {
              onHerbClick(herbName);
              return;
          }
      }
      
      // 2. Check for Citation Link
      const citationSpan = target.closest('[data-citation]');
      if (citationSpan) {
          const type = citationSpan.getAttribute('data-citation') as 'report' | 'meta';
          if (type) {
              onCitationClick(type);
              return;
          }
      }
  };

  // Advanced HTML Processing:
  // 1. Replace [[Citation]] markers
  // 2. Auto-highlight herbs using regex (outside of existing tags)
  // 3. Add styling classes to basic HTML tags
  const processHtml = (html: string) => {
      if (!html) return '';
      
      let processed = html;

      // --- Step 0: Remove potential Markdown Code Blocks ---
      processed = processed.replace(/```html/g, '').replace(/```/g, '');

      // --- Step 1: Citations ---
      processed = processed
          .replace(/\[\[AI报告\]\]/g, '<span class="citation-link cursor-pointer inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all select-none" data-citation="report">📑 AI报告</span>')
          .replace(/\[\[元信息\]\]/g, '<span class="citation-link cursor-pointer inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all select-none" data-citation="meta">🧠 元信息</span>');

      // --- Step 2: Herb Highlighting (Robust Regex) ---
      // Only highlight if regex exists and we have plain text herbs
      if (herbRegex) {
          const parts = processed.split(/(<[^>]+>)/g);
          processed = parts.map(part => {
              // If it's an HTML tag, leave it alone
              if (part.startsWith('<')) return part;
              // Otherwise, replace herb names
              return part.replace(herbRegex, (match) => 
                  `<span class="herb-link cursor-pointer inline-flex items-center gap-0.5 mx-0.5 px-1 py-0 rounded-sm text-indigo-700 font-bold border-b border-indigo-200 hover:bg-indigo-50 hover:border-indigo-500 transition-colors" data-herb="${match}">${match}</span>`
              );
          }).join('');
      }
      
      // --- Step 3: Inject Styles for Standard Tags ---
      processed = processed.replace(/<table>/g, '<div class="overflow-x-auto my-3 border border-slate-200 rounded-lg"><table class="w-full text-sm border-collapse">');
      processed = processed.replace(/<\/table>/g, '</table></div>');
      processed = processed.replace(/<th>/g, '<th class="bg-slate-50 text-slate-600 font-bold px-4 py-2 text-left border-b border-slate-200 whitespace-nowrap">');
      processed = processed.replace(/<td>/g, '<td class="px-4 py-2 border-b border-slate-50 text-slate-700 align-top">');
      processed = processed.replace(/<ul>/g, '<ul class="list-disc pl-5 space-y-1 my-2">');
      processed = processed.replace(/<ol>/g, '<ol class="list-decimal pl-5 space-y-1 my-2">');
      
      return processed;
  };

  // Hide Tool Messages entirely from the main flow
  if (message.role === 'tool') {
      return null;
  }
  
  // Hide AI messages that ONLY contain tool calls
  if (message.role === 'model' && !message.text && message.toolCalls && message.toolCalls.length > 0) {
      return null;
  }

  return (
    <div className={`flex items-start gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group mb-6 animate-in fade-in slide-in-from-bottom-2`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm border border-white/50 ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-100'}`}>
        {message.role === 'user' ? '您' : 'AI'}
      </div>

      {/* Content Bubble */}
      <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[95%] lg:max-w-[85%]`}>
        
        {isEditing ? (
          <div className="w-full min-w-[300px] bg-white border-2 border-indigo-400 rounded-2xl p-4 shadow-xl z-10">
            <textarea 
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-32 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 resize-none font-mono"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button 
                onClick={() => setIsEditing(false)} 
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md font-bold transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSaveEdit} 
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-md transition-colors font-bold"
              >
                {message.role === 'user' ? '保存并重新发送' : '保存修改'}
              </button>
            </div>
          </div>
        ) : (
          <div className={`relative px-6 py-5 rounded-2xl text-base leading-7 shadow-sm border overflow-x-auto ${
            message.role === 'user' 
              ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
              : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'
          }`}>
             {message.isError ? (
               <div className="flex items-center gap-2 text-red-400">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                 <span>{message.text}</span>
               </div>
             ) : (
                <div 
                    className="prose prose-sm max-w-none prose-slate"
                    onClick={handleContentClick}
                    dangerouslySetInnerHTML={{ __html: processHtml(message.text) }}
                />
             )}
             
             {/* Continue Button for truncated AI responses */}
             {message.role === 'model' && isLast && !isLoading && (
                 <button 
                    onClick={onContinue}
                    className="mt-4 text-xs bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full border border-indigo-200 hover:bg-indigo-100 font-bold flex items-center gap-2 transition-all"
                    title="如果回答未显示完整，点击继续"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    继续生成
                 </button>
             )}
          </div>
        )}

        {/* Action Toolbar */}
        {!isEditing && !isLoading && (
          <div className={`flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${message.role === 'user' ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
             <ActionButton icon="📋" label={copyStatus === 'copied' ? '已复制' : '复制文本'} onClick={handleCopy} />
             <ActionButton icon="✎" label="编辑" onClick={() => setIsEditing(true)} />
             <ActionButton icon="↻" label={message.role === 'user' ? '重新发送' : '删除并重新生成'} onClick={() => onRegenerate(index)} />
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
    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
      isDestructive 
        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-100' 
        : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100'
    }`}
    title={label}
  >
    <span>{icon}</span>
    <span className="hidden sm:inline">{label}</span>
  </button>
);


// ==========================================
// 3. Main Component
// ==========================================
export const AIChatbot: React.FC<Props> = ({ 
  analysis, 
  prescriptionInput, 
  reportContent, 
  onUpdatePrescription,
  onRegenerateReport,
  onHerbClick,
  settings,
  metaInfo,
  onUpdateMetaInfo
}) => {
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

  // Memoized Herb Regex (Same as App.tsx)
  const herbRegex = useMemo(() => {
      const names = FULL_HERB_LIST.map(h => h.name).sort((a, b) => b.length - a.length);
      if (names.length === 0) return null;
      // Filter short common words that might cause false positives if not careful, though sorting by length helps
      const validNames = names.filter(n => n.length >= 1); 
      const escaped = validNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return new RegExp(`(${escaped.join('|')})`, 'g');
  }, [FULL_HERB_LIST.length]);

  // --- Data Loading & Persistence ---
  useEffect(() => {
    // 1. Try Load from Cloud first (if key exists)
    const init = async () => {
        let loadedFromCloud = false;
        if (settings.supabaseKey) {
            const cloudSessions = await fetchCloudChatSessions(settings);
            if (cloudSessions.length > 0) {
                const sessionMap: Record<string, Session> = {};
                cloudSessions.forEach(cs => {
                    sessionMap[cs.id] = {
                        id: cs.id,
                        title: cs.title,
                        messages: cs.messages,
                        createdAt: cs.created_at
                    };
                });
                setSessions(sessionMap);
                setActiveSessionId(cloudSessions[0].id);
                loadedFromCloud = true;
            }
        }

        if (!loadedFromCloud) {
             // 2. Fallback to LocalStorage
            try {
                const saved = localStorage.getItem(LS_CHAT_SESSIONS_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && typeof parsed === 'object') {
                        setSessions(parsed);
                        const lastActive = localStorage.getItem('logicmaster_last_active_session');
                        if (lastActive && parsed[lastActive]) {
                            setActiveSessionId(lastActive);
                        } else {
                            const ids = Object.keys(parsed).sort((a, b) => parsed[b].createdAt - parsed[a].createdAt);
                            if (ids.length > 0) setActiveSessionId(ids[0]);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load sessions", e);
            }
        }
        
        // 3. Ensure at least one session exists
        setSessions(current => {
            if (Object.keys(current).length === 0) {
                 const newId = `session_${Date.now()}`;
                 const newSession: Session = {
                    id: newId,
                    title: "新的研讨",
                    createdAt: Date.now(),
                    messages: [{ role: 'model', text: '我是您的 AI 中医助手。我可以帮您分析处方，或查阅药典数据。请问您想了解什么？' }],
                 };
                 setActiveSessionId(newId);
                 // Sync new session to cloud immediately if connected
                 if (settings.supabaseKey) {
                     saveCloudChatSession({
                         id: newSession.id,
                         title: newSession.title,
                         messages: newSession.messages,
                         created_at: newSession.createdAt
                     }, settings);
                 }
                 return { [newId]: newSession };
            }
            return current;
        });
    };
    init();
  }, [settings.supabaseKey]); // Re-run when key changes

  // Save to LocalStorage & Cloud on change
  useEffect(() => {
    if (Object.keys(sessions).length > 0) {
      localStorage.setItem(LS_CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
    if (activeSessionId) {
      localStorage.setItem('logicmaster_last_active_session', activeSessionId);
    }
    
    // Cloud Sync Logic (Debounce needed in real world, but for now we sync active session)
    if (activeSessionId && sessions[activeSessionId] && settings.supabaseKey) {
        const sess = sessions[activeSessionId];
        // Only sync if messages > 1 (not just welcome msg)
        if (sess.messages.length > 1) {
             saveCloudChatSession({
                 id: sess.id,
                 title: sess.title,
                 messages: sess.messages,
                 created_at: sess.createdAt
             }, settings).catch(e => console.error("Cloud sync failed", e));
        }
    }

  }, [sessions, activeSessionId, settings]);

  // === Scroll Logic Optimized (Disable Follow Output) ===
  useEffect(() => {
    const currentMsgs = activeSessionId ? sessions[activeSessionId]?.messages || [] : [];
    
    // Only scroll if:
    // 1. Session ID changed (switched chat)
    // 2. Message COUNT increased (new user msg or new AI start msg)
    // We intentionally ignore content updates (streaming) to avoid following output
    
    if (messageCountRef.current !== currentMsgs.length) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        messageCountRef.current = currentMsgs.length;
    }
  }, [sessions, activeSessionId]); // Note: dependency on sessions still needed to detect count change

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // --- Session Logic ---
  const createNewSession = () => {
    const newId = `session_${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: "新的研讨",
      createdAt: Date.now(),
      messages: [{ role: 'model', text: '我是您的 AI 中医助手。我可以帮您分析处方，或查阅药典数据。请问您想了解什么？' }],
    };
    setSessions(prev => ({ ...prev, [newId]: newSession }));
    setActiveSessionId(newId);
    
    if (settings.supabaseKey) {
         saveCloudChatSession({
             id: newSession.id,
             title: newSession.title,
             messages: newSession.messages,
             created_at: newSession.createdAt
         }, settings);
    }
    return newId;
  };
  
  const handleManualSave = async () => {
      if (!activeSessionId || !sessions[activeSessionId]) return;
      if (!settings.supabaseKey) {
          alert("保存失败：未配置 Supabase 连接。");
          return;
      }
      
      setIsSavingCloud(true);
      const sess = sessions[activeSessionId];
      const success = await saveCloudChatSession({
          id: sess.id,
          title: sess.title,
          messages: sess.messages,
          created_at: sess.createdAt
      }, settings);
      
      setIsSavingCloud(false);
      
      if (success) {
          alert("☁️ 会话已同步到云端数据库。");
      } else {
          alert("❌ 同步失败。\n请确认您是否已运行数据库初始化 SQL (需包含 'chat_sessions' 表)。");
      }
  };

  const deleteSession = (id: string, e?: React.MouseEvent) => {
    // Critical: Stop propagation to prevent selecting the session we are deleting
    if (e) {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        e.preventDefault();
    }
    
    if (!window.confirm("确认删除此会话记录吗？")) return;
    
    // Cloud delete
    if (settings.supabaseKey) {
        deleteCloudChatSession(id, settings);
    }
    
    setSessions(prev => {
      const next = { ...prev };
      delete next[id];
      
      // If we are deleting the currently active session
      if (activeSessionId === id) {
          const remainingIds = Object.keys(next).sort((a, b) => next[b].createdAt - next[a].createdAt);
          if (remainingIds.length > 0) {
              setActiveSessionId(remainingIds[0]); // Switch to next available
          } else {
              // If no sessions left, create a fresh one immediately
              const newId = `session_${Date.now()}`;
              next[newId] = {
                  id: newId,
                  title: "新的研讨",
                  createdAt: Date.now(),
                  messages: [{ role: 'model', text: '我是您的 AI 中医助手。我可以帮您分析处方，或查阅药典数据。请问您想了解什么？' }],
              };
              setActiveSessionId(newId);
          }
      }
      return next;
    });
  };

  const activeMessages = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId]?.messages || [] : [];
  }, [sessions, activeSessionId]);

  // --- Message Action Handlers ---

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
       const newMsgs = [...sess.messages];
       newMsgs[index] = { ...newMsgs[index], text: newText };
       sess.messages = newMsgs;
       return { ...prev, [activeSessionId]: sess };
    });

    if (shouldResend) {
       handleRegenerate(index);
    }
  };

  const handleRegenerate = async (index: number) => {
     if (!activeSessionId || isLoading) return;
     const currentMessages = sessions[activeSessionId].messages;
     const targetMsg = currentMessages[index];
     
     let newHistory: Message[] = [];
     if (targetMsg.role === 'user') {
         newHistory = currentMessages.slice(0, index + 1);
     } else {
         newHistory = currentMessages.slice(0, index);
     }

     setSessions(prev => ({
         ...prev,
         [activeSessionId]: { ...prev[activeSessionId], messages: newHistory }
     }));

     await runGeneration(activeSessionId, newHistory);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    let targetSessionId = activeSessionId;
    if (!targetSessionId) targetSessionId = createNewSession();

    const userMsg: Message = { role: 'user', text: input };
    const currentInput = input;
    setInput('');

    setSessions(prev => {
        const sess = { ...prev[targetSessionId!] };
        sess.messages = [...sess.messages, userMsg];
        if (sess.messages.length <= 2) {
            sess.title = currentInput.slice(0, 20) + (currentInput.length > 20 ? '...' : '');
        }
        return { ...prev, [targetSessionId!]: sess };
    });

    const currentHistory = [...sessions[targetSessionId!].messages, userMsg];
    await runGeneration(targetSessionId!, currentHistory);
  };

  const handleContinue = async () => {
     if (!activeSessionId || isLoading) return;
     const userMsg: Message = { role: 'user', text: "请继续 (Please continue output)" };
     setSessions(prev => {
        const sess = { ...prev[activeSessionId] };
        sess.messages = [...sess.messages, userMsg];
        return { ...prev, [activeSessionId]: sess };
     });
     const currentHistory = [...sessions[activeSessionId].messages, userMsg];
     await runGeneration(activeSessionId, currentHistory);
  };
  
  const handleCitationClick = (type: 'report' | 'meta') => {
      const content = type === 'report' ? (reportContent || '暂无报告') : (metaInfo || '暂无元信息');
      setViewingReference({ type, content });
  };

  // --- Core Generation Logic (Recursive for Tools) ---
  const runGeneration = async (sessionId: string, history: Message[]) => {
      setIsLoading(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Map local messages to OpenAI API format
      const apiHistory: OpenAIMessage[] = history.map(m => {
          if (m.role === 'model') {
              return {
                  role: 'assistant',
                  content: m.text || null,
                  tool_calls: m.toolCalls
              };
          } else if (m.role === 'tool') {
              return {
                  role: 'tool',
                  tool_call_id: m.toolCallId,
                  content: m.text
              };
          } else {
              return {
                  role: m.role,
                  content: m.text
              };
          }
      });

      // Append placeholder
      setSessions(prev => {
          const sess = { ...prev[sessionId] };
          sess.messages = [...sess.messages, { role: 'model', text: '' }];
          return { ...prev, [sessionId]: sess };
      });

      try {
          const stream = generateChatStream(
              apiHistory, 
              analysis, 
              prescriptionInput, 
              reportContent, 
              settings, 
              controller.signal,
              metaInfo
          );

          let fullText = '';
          let toolCallsResult: {id: string, name: string, args: any}[] = [];
          
          for await (const chunk of stream) {
              if (chunk.text) {
                  fullText += chunk.text;
                  setSessions(prev => {
                      const sess = { ...prev[sessionId] };
                      const lastIdx = sess.messages.length - 1;
                      if (lastIdx >= 0) {
                          sess.messages[lastIdx] = { ...sess.messages[lastIdx], text: fullText };
                      }
                      return { ...prev, [sessionId]: sess };
                  });
              }
              if (chunk.functionCalls) {
                  toolCallsResult = chunk.functionCalls;
              }
          }

          // === Handle Tool Calls ===
          if (toolCallsResult.length > 0) {
              setIsToolExecuting(true);
              
              const assistantToolCalls: OpenAIToolCall[] = toolCallsResult.map(tc => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.args)
                  }
              }));

              const assistantMsg: Message = {
                  role: 'model',
                  text: fullText,
                  toolCalls: assistantToolCalls
              };

              setSessions(prev => {
                  const sess = { ...prev[sessionId] };
                  sess.messages[sess.messages.length - 1] = assistantMsg;
                  return { ...prev, [sessionId]: sess };
              });
              
              const nextHistory = [...history, assistantMsg];

              for (const tool of toolCallsResult) {
                  console.log(`[Tool] Executing ${tool.name}`, tool.args);
                  let result = "";
                  
                  if (tool.name === 'lookup_herb') {
                      result = searchHerbsForAI(tool.args.query);
                  } else if (tool.name === 'update_prescription') {
                      onUpdatePrescription?.(tool.args.prescription);
                      result = "Prescription updated successfully in frontend.";
                  } else if (tool.name === 'regenerate_report') {
                      onRegenerateReport?.(tool.args.instructions);
                      result = "Report regeneration triggered.";
                  } else {
                      result = "Unknown tool.";
                  }

                  const toolMsg: Message = {
                      role: 'tool',
                      toolCallId: tool.id,
                      functionName: tool.name,
                      text: result
                  };

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
          if (e.name === 'AbortError') {
              console.log('Generation aborted.');
          } else {
              console.error('Generation failed:', e);
              setSessions(prev => {
                  const sess = { ...prev[sessionId] };
                  const lastIdx = sess.messages.length - 1;
                  const currentText = sess.messages[lastIdx].text;
                  const errorText = `\n\n[系统错误: ${JSON.stringify(e)}]`;
                  sess.messages[lastIdx] = { 
                      ...sess.messages[lastIdx], 
                      text: currentText + errorText,
                      isError: !currentText 
                  };
                  return { ...prev, [sessionId]: sess };
              });
          }
      } finally {
          setIsLoading(false);
          abortControllerRef.current = null;
      }
  };

  // --- Render ---
  return (
    <div className="flex h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
      
      <MetaInfoModal 
         isOpen={showMetaModal}
         onClose={() => setShowMetaModal(false)}
         metaInfo={metaInfo}
         onSave={onUpdateMetaInfo}
      />
      
      {/* Reference Modal (Report/Meta Viewer) */}
      {viewingReference && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingReference(null)}></div>
              <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          {viewingReference.type === 'report' ? '📑 AI分析报告原文' : '🧠 研讨元信息上下文'}
                      </h3>
                      <button onClick={() => setViewingReference(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                     {viewingReference.type === 'report' ? (
                         <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{__html: viewingReference.content}}></div>
                     ) : (
                         <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{viewingReference.content}</div>
                     )}
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar (Session List) */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-4 border-b border-slate-200">
           <button 
             onClick={() => createNewSession()}
             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
           >
             <span className="text-xl">+</span> 新的研讨
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
           {(Object.values(sessions) as Session[])
             .sort((a, b) => b.createdAt - a.createdAt)
             .map((session) => (
               <div 
                 key={session.id}
                 onClick={() => setActiveSessionId(session.id)}
                 className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                   activeSessionId === session.id 
                     ? 'bg-white border-indigo-200 shadow-sm' 
                     : 'hover:bg-slate-200/50 border-transparent'
                 }`}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`text-lg ${activeSessionId === session.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {activeSessionId === session.id ? '💬' : '🗨️'}
                    </span>
                    <span className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-slate-800' : 'text-slate-600'}`}>
                      {session.title}
                    </span>
                 </div>
                 <button 
                   onClick={(e) => deleteSession(session.id, e)}
                   className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all z-10 relative"
                   title="删除会话"
                 >
                   ✕
                 </button>
               </div>
             ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#fcfcfc]">
        {/* Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur z-10">
           <div>
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
               智能研讨助手
               <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                 {settings.chatModel || 'Default Model'}
               </span>
               <span className={`text-[10px] px-2 py-0.5 rounded-full border ${settings.supabaseKey ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                 {settings.supabaseKey ? '☁️ 云同步开启' : '📁 本地模式'}
               </span>
             </h3>
           </div>
           
           <div className="flex items-center gap-3">
               <button 
                 onClick={() => setShowMetaModal(true)}
                 className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${metaInfo ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-600'}`}
                 title="设置研讨上下文"
               >
                   <span>🧠</span> {metaInfo ? '元信息已设定' : '设置元信息'}
               </button>

               <button 
                   onClick={handleManualSave}
                   disabled={isSavingCloud || !settings.supabaseKey}
                   className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                   title="手动保存当前会话到云端"
               >
                   {isSavingCloud ? <span className="animate-spin">⏳</span> : <span>☁️</span>}
                   {isSavingCloud ? '同步中' : '保存会话'}
               </button>
               <div className="md:hidden">
                  <button onClick={() => createNewSession()} className="text-indigo-600 text-sm font-bold">新会话</button>
               </div>
           </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
           {activeMessages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl">🤖</div>
                <p>暂无消息，请开始提问。</p>
             </div>
           ) : (
             activeMessages.map((msg, i) => (
               <ChatMessageItem 
                 key={i} 
                 index={i} 
                 message={msg} 
                 isLoading={isLoading}
                 isLast={i === activeMessages.length - 1}
                 onDelete={handleDeleteMessage}
                 onRegenerate={handleRegenerate}
                 onEdit={handleEditMessage}
                 onContinue={handleContinue}
                 onHerbClick={onHerbClick}
                 onCitationClick={handleCitationClick}
                 herbRegex={herbRegex}
               />
             ))
           )}
           {/* Only used for initial scroll position, not active following */}
           <div ref={messagesEndRef} className="h-4" />
        </div>
        
        {/* Tool Execution Indicator (Floating) */}
        {isToolExecuting && (
             <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-indigo-100 shadow-lg px-4 py-2 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 z-30">
                 <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-xs font-bold text-indigo-700">正在查阅药典数据库...</span>
             </div>
        )}

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-100 relative z-20">
           <div className="flex gap-4 items-end max-w-5xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={isLoading ? "AI 正在思考中 (可调用工具)..." : "输入问题，Shift+Enter 换行..."}
                  disabled={isLoading}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none shadow-inner transition-all disabled:bg-slate-100 disabled:text-slate-400 font-sans"
                  rows={1}
                />
                <div className="absolute right-3 bottom-3 text-[10px] text-slate-400 font-medium bg-white/50 px-2 rounded pointer-events-none">
                   支持 HTML
                </div>
              </div>
              
              {isLoading ? (
                <button 
                  onClick={handleStop}
                  className="h-[52px] w-[52px] rounded-2xl bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 hover:border-red-200 flex items-center justify-center shadow-sm transition-all group"
                  title="停止生成"
                >
                  <span className="w-3 h-3 bg-red-500 rounded-sm group-hover:scale-110 transition-transform"></span>
                </button>
              ) : (
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-[52px] w-[52px] rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
              )}
           </div>
           <div className="text-center mt-2 text-xs text-slate-400">
              AI生成内容仅供参考，已接入2025药典数据库。
           </div>
        </div>
      </div>
    </div>
  );
};
