import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Controls from '@/components/Controls';
import LogContainer from '@/components/LogContainer';
import { processBatchMessages } from '@/utils/logProcessing';

import { LogLevel, LogMessage } from '@/utils/types';

const App: React.FC = () => {
  // Theme management is now handled by the SyntaxHighlighter component

  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [allLogs, setAllLogs] = useState<LogMessage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastBatchStart = useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<LogLevel, boolean>>({
    info: true,
    warn: true,
    error: true,
    debug: true,
    batch: true,
    tool: true
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Theme changes are now managed through localStorage only
  const changeTheme = (themeName: string) => {
    localStorage.setItem('syntax-theme', themeName);
    // Force a window storage event so components listening for theme changes will update
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'syntax-theme',
      newValue: themeName
    }));
  };

  // WebSocket connection setup
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname || 'localhost';
    const wsPort = new URLSearchParams(window.location.search).get('port') || '8080';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Try to reconnect after 5 seconds
        setTimeout(connect, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'history') {
          // Process any batch messages in history
          const processedMessages = processBatchMessages(data.messages);
          setAllLogs(processedMessages);
        } else if (data.type === 'message') {
          const message = data.message;

          // Handle batch messages
          if (message.level === 'batch') {
            // Simple check for [done] messages
            const isDoneMessage = message.message && message.message.trim() === '[done]';

            if (isDoneMessage) {
              // Get the timestamp of the most recent batch start (if any)
              const lastBatchTimestamp = lastBatchStart.current;

              if (lastBatchTimestamp) {
                const endTime = new Date(message.timestamp).getTime();
                const durationSec = ((endTime - lastBatchTimestamp) / 1000).toFixed(3);

                // Create modified message
                const modifiedMessage = {
                  ...message,
                  message: `✅ ${durationSec}s`
                };

                // Reset the last batch start timestamp
                lastBatchStart.current = null;

                setAllLogs(prev => [...prev, modifiedMessage]);
                return;
              }
            } else {
              // Any non-[done] batch message is considered a start
              if (message.message && message.message.trim() !== '[done]') {
                // Store the timestamp of this batch start
                lastBatchStart.current = new Date(message.timestamp).getTime();
              }
            }
          }

          // Default handling for non-special messages
          setAllLogs(prev => [...prev, message]);
        }
      };
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Filter logs whenever filters, search term or all logs change
  useEffect(() => {
    if (isPaused) return;

    const filteredLogs = allLogs.filter(log => {
      // Apply level filter
      if (!filters[log.level]) return false;

      // Apply search filter if search term exists
      if (searchTerm) {
        const messageText = log.message.toLowerCase();
        const dataText = log.data ? JSON.stringify(log.data).toLowerCase() : '';
        return messageText.includes(searchTerm.toLowerCase()) ||
               dataText.includes(searchTerm.toLowerCase());
      }

      return true;
    });

    setLogs(filteredLogs);
  }, [allLogs, filters, searchTerm, isPaused]);

  const toggleFilter = (level: LogLevel) => {
    setFilters(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const clearLogs = () => {
    setAllLogs([]);
    setLogs([]);
  };

  return (
    <div className="min-h-screen">
      <Header isConnected={isConnected} changeTheme={changeTheme} />

      <div className="container mx-auto pt-1">
        <Controls
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filters={filters}
          toggleFilter={toggleFilter}
          isPaused={isPaused}
          togglePause={togglePause}
          clearLogs={clearLogs}
          autoScroll={autoScroll}
          toggleAutoScroll={() => {
            const newValue = !autoScroll;
            console.log('Setting autoScroll to:', newValue);
            setAutoScroll(newValue);
          }}
        />

        <LogContainer
          logs={logs}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          expandedEntries={expandedEntries}
          setExpandedEntries={setExpandedEntries}
        />
      </div>
    </div>
  );
};

export default App;