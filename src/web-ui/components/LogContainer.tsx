import React, { useRef, useEffect, useCallback } from 'react';
import LogEntry from '@/components/LogEntry';
import { LogMessage } from '@/utils/types';

interface LogContainerProps {
  logs: LogMessage[];
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  expandedEntries: Set<string>;
  setExpandedEntries: (entries: Set<string>) => void;
}

const LogContainer: React.FC<LogContainerProps> = ({
  logs,
  autoScroll,
  setAutoScroll,
  expandedEntries,
  setExpandedEntries
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Track when the component initiated the scroll
  const scrollingProgrammatically = useRef(false);

  // --- Scroll Function ---
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      // Set flag before scrolling
      scrollingProgrammatically.current = true;
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: behavior,
      });
      // Reset flag shortly after
      setTimeout(() => {
         scrollingProgrammatically.current = false;
      }, 100);
    }
  }, []);

  // --- Auto-scroll on new logs ---
  useEffect(() => {
    // Only scroll if autoScroll is enabled
    if (autoScroll && logs.length > 0) {
        // Allow DOM to update with new log heights
        const scrollTimeout = setTimeout(() => {
           scrollToBottom('smooth');
        }, 0);

        return () => clearTimeout(scrollTimeout);
    }
  }, [logs, autoScroll, scrollToBottom]);

  // --- Scroll to bottom when autoScroll is toggled ON ---
  useEffect(() => {
    console.log('autoScroll changed to:', autoScroll);
    if (autoScroll) {
      // Force an immediate scroll to bottom when autoScroll is turned on
      scrollToBottom('auto');
    }
  }, [autoScroll, scrollToBottom]);

  // --- Detect user scroll to toggle autoScroll ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
       // Ignore events from programmatic scrolling
       if (scrollingProgrammatically.current) {
           return;
       }

      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "at bottom" if within 20px threshold
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;

      // Only update if state needs changing
      if (isAtBottom && !autoScroll) {
        console.log("User scrolled to bottom, enabling autoScroll");
        setAutoScroll(true);
      } else if (!isAtBottom && autoScroll) {
        console.log("User scrolled up, disabling autoScroll");
        setAutoScroll(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [setAutoScroll, autoScroll]);

  // --- Initial check/scroll ---
  useEffect(() => {
    if (autoScroll) {
        const initialScrollTimeout = setTimeout(() => {
           scrollToBottom('auto');
        }, 100);
         return () => clearTimeout(initialScrollTimeout);
    }
  }, [scrollToBottom]);

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-180px)] overflow-y-auto bg-white rounded shadow mt-1 focus:outline-none"
    >
      {logs.map((log, index) => {
        const logId = index + '-' + log.timestamp + '-' + log.level + '-' + (log.message?.substring(0, 20) || '');
        return (
          <LogEntry
            key={logId}
            log={log}
            logId={logId}
            nextLog={index < logs.length - 1 ? logs[index + 1] : null}
            isExpanded={expandedEntries.has(logId)}
            onToggleExpand={(id, expanded) => {
              const newExpandedEntries = new Set(expandedEntries);
              if (expanded) {
                newExpandedEntries.add(id);
              } else {
                newExpandedEntries.delete(id);
              }
              setExpandedEntries(newExpandedEntries);
            }}
          />
        );
      })}
      {logs.length === 0 && (
        <div className="p-4 text-center text-gray-500">No logs to display</div>
      )}
    </div>
  );
};

export default LogContainer;