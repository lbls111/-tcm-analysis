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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        // FIX: In strict TypeScript configurations, JSON.parse returns `unknown`.
        // We must perform a type check before we can safely use the parsed data.
        // Fix: Changed unknown to any to help compiler with type inference in this context.
        const parsed: any = JSON.parse(saved);

        // Type guard to ensure parsed is a non-array object.
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

    // FIX: Refactor state updates to be within a single functional update call.
    // This prevents stale state issues and ensures type safety.
    setSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[sessionId];

      if (activeSessionId === sessionId) {
        const remainingSessions = Object.values(newSessions).sort((a, b) => b.createdAt - a.createdAt);
        if (remainingSessions.length > 0) {
          // We must update the active session ID here, based on the *new* sessions list.
          setActiveSessionId(remainingSessions[0].id);
        } else {
          // If no sessions remain, create a new one.
          // Replicating createNewSession logic here to avoid nested state updates.
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

    const stream = generateChatStream(apiHistory, analysis, prescriptionInput, reportContent, settings);
    
    let modelResponseText = '';
    
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
  };
  
  // --- Render ---
  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 max-w-[300px] bg-slate-50 border-r border-slate-200 flex flex-col">
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
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {activeMessages.map((msg, idx) => (
            <MessageBubble key={idx} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex gap-4 relative">
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
            <button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()} 
              className="w-14 h-14 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center shrink-0"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 3. Sub-Components
// ==========================================
const Avatar = ({ role }: { role: 'user' | 'model' }) => (
  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-inner ${role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
    {role === 'user' ? '您' : 'AI'}
  </div>
);

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  return (
    <div className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar role={msg.role} />
      <div className={`flex flex-col group ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
        <div className={`max-w-[85%] lg:max-w-[75%] p-5 rounded-2xl text-lg leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
          {msg.isError ? (
            <div className='text-red-700 bg-red-50 p-2 rounded-lg border border-red-100'>
              <p className="font-bold">⚠️ 错误</p>
              <p className="text-sm mt-1">{msg.text}</p>
            </div>
          ) : (
            <ReactMarkdown components={{ p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} /> }}>
              {msg.text || '...'}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};