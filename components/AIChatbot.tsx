
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateChatStream, OpenAIMessage } from '../services/openaiService';
import { AnalysisResult, AISettings } from '../types';
import ReactMarkdown from 'react-markdown';
import { FULL_HERB_LIST } from '../data/herbDatabase';

// ==========================================
// 1. Types
// ==========================================
interface Message {
  role: 'user' | 'model' | 'function';
  text: string;
  isFunctionCall?: boolean;
  functionCalls?: any[]; 
  isError?: boolean;
  originalHistory?: Message[];
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
  settings: AISettings;
}

const LS_CHAT_SESSIONS_KEY = "logicmaster_chat_sessions";

// ==========================================
// 2. Main Component
// ==========================================
export const AIChatbot: React.FC<Props> = ({ 
  analysis, 
  prescriptionInput, 
  reportContent, 
  onUpdatePrescription,
  onRegenerateReport,
  settings
}) => {
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Derived State ---
  const activeMessages = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId]?.messages || [] : [];
  }, [sessions, activeSessionId]);

  const sortedSessions = useMemo(() => {
    return Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions]);
  
  // --- Effects for Data Persistence & UI ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_CHAT_SESSIONS_KEY);
      if (saved) {
        const parsed: any = JSON.parse(saved);

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const sessionsData = parsed as Record<string, Session>;
          if (Object.keys(sessionsData).length > 0) {
            setSessions(sessionsData);
            const lastActiveId = localStorage.getItem('logicmaster_last_active_session');
            if (lastActiveId && sessionsData[lastActiveId]) {
              setActiveSessionId(lastActiveId);
            } else {
              const sortedIds = Object.keys(sessionsData).sort((a, b) => sessionsData[b].createdAt - sessionsData[a].createdAt);
              setActiveSessionId(sortedIds[0]);
            }
            return;
          }
        }
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
    createNewSession();
  }, []);

  useEffect(() => {
    if (Object.keys(sessions).length > 0) {
      localStorage.setItem(LS_CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
    if (activeSessionId) {
      localStorage.setItem('logicmaster_last_active_session', activeSessionId);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);
  
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`;
    }
  }, [input]);

  // --- Session Management ---
  const createNewSession = () => {
    const newId = `session_${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: "新的研讨",
      createdAt: Date.now(),
      messages: [{ role: 'model', text: '我是 AI 问答助手。您可以向我提问，或要求修改处方、重构报告。' }],
    };
    setSessions(prev => ({ ...prev, [newId]: newSession }));
    setActiveSessionId(newId);
    return newId;
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这个会话吗？")) return;

    setSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[sessionId];

      if (activeSessionId === sessionId) {
        const remainingSessions = Object.values(newSessions).sort((a, b) => b.createdAt - a.createdAt);
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0].id);
        } else {
          const newId = `session_${Date.now()}`;
          const newSession: Session = {
            id: newId,
            title: "新的研讨",
            createdAt: Date.now(),
            messages: [{ role: 'model', text: '我是 AI 问答助手。您可以向我提问，或要求修改处方、重构报告。' }],
          };
          newSessions[newId] = newSession;
          setActiveSessionId(newId);
        }
      }
      return newSessions;
    });
  };
  
  // --- Message Actions ---
  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setIsLoading(false);
      }
  };

  const handleDeleteMessage = (index: number) => {
    if (!activeSessionId) return;
    setSessions(prev => {
        const newSessions = { ...prev };
        const session = { ...newSessions[activeSessionId] };
        session.messages = session.messages.filter((_, i) => i !== index);
        newSessions[activeSessionId] = session;
        return newSessions;
    });
  };

  const handleStartEdit = (index: number, text: string) => {
      setEditingMessageIndex(index);
      setEditInput(text);
  };

  const handleSaveEdit = async (index: number) => {
      if (!activeSessionId || !editInput.trim()) return;
      
      // Update the user message, remove all subsequent messages, and regenerate
      const session = sessions[activeSessionId];
      const newHistory = session.messages.slice(0, index + 1); // Keep up to the edited message
      newHistory[index].text = editInput; // Update text

      setSessions(prev => ({
          ...prev,
          [activeSessionId]: {
              ...prev[activeSessionId],
              messages: newHistory
          }
      }));
      setEditingMessageIndex(null);
      
      setIsLoading(true);
      try {
          // Regenerate based on the new history (excluding the now last message which is the user input to be sent)
          await runGeneration(activeSessionId, newHistory); 
      } catch (error) {
          console.error("Regeneration failed", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegenerate = async (index: number) => {
      if (!activeSessionId) return;
      const session = sessions[activeSessionId];
      // Keep messages UP TO the one *before* this AI message
      // Assuming 'index' is the AI message we want to regenerate.
      const newHistory = session.messages.slice(0, index);
      
      setSessions(prev => ({
          ...prev,
          [activeSessionId]: {
              ...prev[activeSessionId],
              messages: newHistory
          }
      }));

      setIsLoading(true);
      try {
          await runGeneration(activeSessionId, newHistory);
      } catch (error) {
          console.error("Regeneration failed", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleContinue = async () => {
      if (!activeSessionId) return;
      const userMsg: Message = { role: 'user', text: "请继续 (Please continue)" };
      
      setSessions(prev => {
        const newSessions = { ...prev };
        const session = { ...newSessions[activeSessionId] };
        session.messages = [...session.messages, userMsg];
        newSessions[activeSessionId] = session;
        return newSessions;
      });
      
      setIsLoading(true);
      try {
        await runGeneration(activeSessionId, [...sessions[activeSessionId].messages, userMsg]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  // --- Core Logic ---
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', text: input };
    const currentInput = input;
    setInput('');
    
    let targetSessionId = activeSessionId;
    const isNewConversation = activeSessionId ? sessions[activeSessionId]?.messages.length <= 1 : true;
    
    if (!targetSessionId) {
      targetSessionId = createNewSession();
    }
    
    setSessions(prev => {
      const newSessions = { ...prev };
      const session = { ...newSessions[targetSessionId!] };
      session.messages = [...session.messages, userMsg];
      if (isNewConversation) {
        session.title = currentInput.substring(0, 40) + (currentInput.length > 40 ? '...' : '');
      }
      newSessions[targetSessionId!] = session;
      return newSessions;
    });
    
    setIsLoading(true);

    try {
      await runGeneration(targetSessionId, [...sessions[targetSessionId!].messages, userMsg]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
          console.log('Chat aborted');
          return;
      }
      console.error("Chat generation failed:", error);
      const errorMsg: Message = {
        role: 'model',
        text: `❌ 请求失败: ${error.message}`,
        isError: true,
        originalHistory: sessions[targetSessionId!].messages
      };
      setSessions(prev => {
        const newSessions = { ...prev };
        const session = { ...newSessions[targetSessionId!] };
        session.messages = [...session.messages, errorMsg];
        newSessions[targetSessionId!] = session;
        return newSessions;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runGeneration = async (sessionId: string, history: Message[]) => {
    const apiHistory: OpenAIMessage[] = history
      .filter(m => !m.isError)
      .map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.text,
      } as OpenAIMessage));

    // Abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const stream = generateChatStream(apiHistory, analysis, prescriptionInput, reportContent, settings, controller.signal);
    
    let modelResponseText = '';
    
    // Optimistic update: Add empty AI message
    setSessions(prev => {
        const newSessions = { ...prev };
        const session = { ...newSessions[sessionId] };
        session.messages = [...session.messages, { role: 'model', text: '' }];
        newSessions[sessionId] = session;
        return newSessions;
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        modelResponseText += chunk.text;
        setSessions(prev => {
          const newSessions = { ...prev };
          const session = { ...newSessions[sessionId] };
          const lastMessage = session.messages[session.messages.length - 1];
          if (lastMessage) {
            lastMessage.text = modelResponseText;
          }
          newSessions[sessionId] = session;
          return newSessions;
        });
      }
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        console.log('Function call received:', chunk.functionCalls);
        // Handle function calls logic here
      }
    }
    abortControllerRef.current = null;
  };
  
  // --- Render ---
  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 max-w-[300px] bg-slate-50 border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-200">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            新的研讨
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedSessions.map(session => (
            <button 
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`w-full text-left p-3 rounded-lg group transition-colors flex justify-between items-center ${activeSessionId === session.id ? 'bg-indigo-100' : 'hover:bg-slate-100'}`}
            >
              <span className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-indigo-800' : 'text-slate-700'}`}>
                {session.title}
              </span>
              <span 
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">智能研讨助手</h3>
            <p className="text-xs text-slate-500">当前模型: {settings.chatModel || 'Default'}</p>
          </div>
          {/* Mobile New Session Button */}
          <button onClick={createNewSession} className="md:hidden text-indigo-600 font-bold text-sm">新会话</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {activeMessages.map((msg, idx) => (
             <div key={idx} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group`}>
                <Avatar role={msg.role} />
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full max-w-[85%] lg:max-w-[75%]`}>
                    
                    {/* Message Bubble or Edit Input */}
                    {editingMessageIndex === idx ? (
                        <div className="w-full bg-white border border-indigo-200 rounded-2xl p-4 shadow-md">
                            <textarea 
                                value={editInput}
                                onChange={e => setEditInput(e.target.value)}
                                className="w-full h-24 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingMessageIndex(null)} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">取消</button>
                                <button onClick={() => handleSaveEdit(idx)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">保存并提交</button>
                            </div>
                        </div>
                    ) : (
                        <div className={`p-5 rounded-2xl text-lg leading-relaxed shadow-sm w-full ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none prose prose-slate prose-p:my-2 prose-headings:text-slate-900 prose-headings:font-bold prose-pre:bg-slate-100 prose-pre:text-slate-800 prose-code:text-indigo-600'}`}>
                            {msg.isError ? (
                                <div className='text-red-700 bg-red-50 p-2 rounded-lg border border-red-100'>
                                <p className="font-bold">⚠️ 错误</p>
                                <p className="text-sm mt-1">{msg.text}</p>
                                </div>
                            ) : (
                                <ReactMarkdown components={{ p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} /> }}>
                                {msg.text || '...'}
                                </ReactMarkdown>
                            )}
                        </div>
                    )}

                    {/* Action Bar */}
                    {!editingMessageIndex && !isLoading && (
                        <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <button onClick={() => handleStartEdit(idx, msg.text)} className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                                    <span>✎</span> 编辑
                                </button>
                            ) : (
                                <button onClick={() => handleRegenerate(idx)} className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                                    <span>↻</span> 重新生成
                                </button>
                            )}
                             <button onClick={() => handleDeleteMessage(idx)} className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-1 ml-2">
                                    <span>✕</span> 删除
                             </button>
                        </div>
                    )}
                    
                    {/* Continue Button (Last message AI only) */}
                    {!isLoading && msg.role === 'model' && idx === activeMessages.length - 1 && (
                         <div className="mt-2">
                             <button onClick={handleContinue} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1">
                                 <span>➜</span> 继续生成
                             </button>
                         </div>
                    )}
                </div>
             </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex gap-4 relative items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="输入问题，或要求修改处方... (Shift + Enter 换行)"
              className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner resize-none max-h-48"
              rows={1}
              disabled={isLoading}
            />
            {isLoading ? (
                <button 
                  onClick={handleStop}
                  className="w-14 h-14 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200 flex items-center justify-center shrink-0 animate-pulse"
                  title="停止生成"
                >
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                </button>
            ) : (
                <button 
                onClick={handleSend} 
                disabled={!input.trim()} 
                className="w-14 h-14 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center shrink-0"
                >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 3. Sub-Components
// ==========================================
const Avatar = ({ role }: { role: 'user' | 'model' | 'function' }) => (
  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-inner ${role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
    {role === 'user' ? '您' : 'AI'}
  </div>
);
