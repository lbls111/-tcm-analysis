
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LogEntry, LogLevel } from '../types';

interface LogContextType {
  logs: LogEntry[];
  addLog: (level: LogLevel, module: string, message: string, details?: any) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogLevel, module: string, message: string, details?: any) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      level,
      module,
      message,
      details
    };
    
    // Console mirror for development
    if (level === 'error') console.error(`[${module}] ${message}`, details);
    else if (level === 'warning') console.warn(`[${module}] ${message}`, details);
    else console.log(`[${module}] ${message}`, details);

    setLogs(prev => [newEntry, ...prev]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLog = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
};
