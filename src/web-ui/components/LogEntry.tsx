import React from 'react';
import { guessLanguage } from '@/utils/codeHighlighting';
import SyntaxHighlighterWithTheme from './SyntaxHighlighterWithTheme';
import LogDataDisplay from './LogDataDisplay';
import {LogMessage, LogMessageForWeb} from '@/utils/types';
import {batchInputSchema} from "../../tools/batch-request";
import {z} from "zod";

interface LogEntryProps {
  log: LogMessageForWeb;
  nextLog: LogMessage | null;
  logId: string;
  isExpanded: boolean;
  onToggleExpand: (logId: string, expanded: boolean) => void;
}

const LogEntry: React.FC<LogEntryProps> = ({ log, nextLog, logId, isExpanded, onToggleExpand }) => {
  // Track the current document height before expansion
  const rememberScrollPos = () => {
    return {
      scrollHeight: document.body.scrollHeight,
      scrollTop: window.pageYOffset || document.documentElement.scrollTop,
      clientHeight: window.innerHeight
    };
  };
  
  const levelColorClass: Record<string, string> = {
    info: 'border-blue-500',
    warn: 'border-yellow-500 bg-yellow-50',
    error: 'border-red-500 bg-red-50',
    debug: 'border-gray-500 text-gray-600',
    batch: 'border-purple-500 bg-purple-50',
    tool: 'border-green-500 bg-green-50'
  };

  const levelBadgeClass: Record<string, string> = {
    info: 'bg-blue-500',
    warn: 'bg-yellow-500',
    error: 'bg-red-500',
    debug: 'bg-gray-500',
    batch: 'bg-purple-500',
    tool: 'bg-green-500'
  };


  // Check if this is a batch completion message
  const isBatchCompletion = log.tool_name === 'batch_request' && log.type === 'response';
  const isBatchStart = log.tool_name === 'batch_request' && log.type === 'request';

  let colorClass = '';
  let badgeColorClass = '';

  if (log.tool_name === 'batch_request') {
    colorClass = levelColorClass['batch'];
    badgeColorClass = levelBadgeClass['batch'];
  } else if (log.tool_name === 'tool_request') {
    colorClass = levelColorClass['tool'];
    badgeColorClass = levelBadgeClass['tool'];
  } else  {
    colorClass = levelColorClass[log.level];
    badgeColorClass = levelBadgeClass[log.level];
  }

  return (
    <div
      className={`p-3 border-l-4 ${colorClass} border-b border-gray-200 font-mono text-sm break-words relative cursor-pointer`}
      style={{
        ...(isBatchCompletion ? {
          marginBottom: '1.5rem',
          borderBottom: '1px solid #9f7aea'
        } : {}),
        ...(isBatchStart ? {
          borderTop: '1px solid #9f7aea',
          paddingTop: '0.75rem'
        } : {})
      }}
      onClick={() => {
        if (!log.data) return;

        // Before expanding, remember the scroll position
        const before = rememberScrollPos();
        const wasAtBottom = before.scrollHeight - before.scrollTop - before.clientHeight < 20;

        // Toggle the expanded state
        onToggleExpand(logId, !isExpanded);

        // After the DOM updates, restore scroll position or stick to bottom if needed
        setTimeout(() => {
          const after = rememberScrollPos();
          // If we're collapsing an entry, or we weren't at the bottom, maintain the same absolute scroll position
          if (isExpanded || !wasAtBottom) {
            window.scrollTo(0, before.scrollTop);
          }
          // If we were at the bottom and are expanding, scroll to the new bottom
          else if (wasAtBottom) {
            window.scrollTo(0, document.body.scrollHeight);
          }
        }, 0);
      }}
    >
      {/* Log header row with timestamp, level, message, and tool description */}
      <div className="w-full flex justify-between items-center">
        <div className="flex-grow overflow-hidden" style={{ maxWidth: '65%' }}>
          <span className="text-gray-500 text-xs mr-2">
            {new Date(log.timestamp).toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3})}
          </span>

          <span className={`inline-block px-1.5 py-0.5 rounded text-xs text-white mr-2 ${badgeColorClass}`}>
            {log.level.toUpperCase()}
          </span>

          <span className="mr-2">{log.description}</span>
        </div>
        
        {/* Tool description for specific tools */}
        {log.tool_name !== 'batch_request' && (log.tool_name.includes('bash') || log.tool_name.includes('view') || log.tool_name.includes('replace') || log.tool_name.includes('grep') || log.tool_name.includes('edit_blocks')) && (
          <div className="flex-shrink-0 ml-auto text-xs text-gray-700 overflow-hidden whitespace-nowrap text-right px-2" 
                style={{ width: '30%', marginRight: '20px' }}>
            <span className="inline-block w-full overflow-hidden text-ellipsis truncate" title={
              log.tool_name.includes('bash') && log.data?.command ? `Command: ${log.data.command}` :
              log.tool_name.includes('view') && log.data?.file_path ? `File: ${log.data.file_path}` :
              log.tool_name.includes('replace') && log.data?.file_path ? `File: ${log.data.file_path}` :
              log.tool_name.includes('grep') && log.data?.pattern ? `Pattern: ${log.data.pattern}` :
              log.tool_name.includes('edit_blocks') && log.data?.edits ? `Files: ${Object.keys(log.data.edits).join(', ')}` : ''
            }>
              {log.tool_name.includes('bash') && log.data?.command && `$ ${log.data.command.length > 40 ? log.data.command.substring(0, 40) + '...' : log.data.command}`}
              {log.tool_name.includes('view') && log.data?.file_path && `📄 ${log.data.file_path}`}
              {log.tool_name.includes('replace') && log.data?.file_path && `💾 ${log.data.file_path}`}
              {log.tool_name.includes('grep') && log.data?.pattern && `🔍 ${log.data.pattern}`}
              {log.tool_name.includes('edit_blocks') && log.data?.edits && Object.keys(log.data.edits).map((filename, index) =>
                index === 0 ? `💾 ${filename}` : ` 💾 ${filename}`
              ).join('')}
            </span>
          </div>
        )}
      </div>
      
      {/* Expand/collapse indicator */}
      {log.data && (
        <span
          className="absolute right-2 top-2 text-xs text-blue-600 z-10"
        >
          {isExpanded ? '▼' : '▶'}
        </span>
      )}
      
      {/* Expanded content area */}
      {log && isExpanded && (
        <LogDataDisplay log={log} />
      )}
    </div>
  );
};

export default LogEntry;