import React from 'react';
import { guessLanguage } from '@/utils/codeHighlighting';
import SyntaxHighlighterWithTheme from './SyntaxHighlighterWithTheme';
import {LogMessage} from "../utils/types";
import {z} from "zod";
import {batchInputRequests} from "../../tools/batch-request";
import EditBlocksDisplay from './EditBlocksDisplay';
import ReplaceDisplay from './ReplaceDisplay';

interface LogDataDisplayProps {
  log: LogMessage;
}
type BatchRequest = z.infer<typeof batchInputRequests>;

const LogDataDisplay: React.FC<LogDataDisplayProps> = ({ log }) => {
  if (log.tool_name === 'edit_blocks' && log.data?.edits) {
    return (
      <div className="w-full mt-2 block" onClick={(e) => e.stopPropagation()}>
        {/* Special handling for edit_blocks */}
        <EditBlocksDisplay data={log.data}/>
      </div>
    );
  }

  if (log.tool_name === 'replace' && log.data?.file_path && log.data?.content) {
    return (
      <div className="w-full mt-2 block" onClick={(e) => e.stopPropagation()}>
        <ReplaceDisplay data={log.data}/>
      </div>
    );
  }

  if (log.tool_name === 'batch_request' && log.type === 'request') {
    const mcpRequests: BatchRequest = log.data;
    
    return (
      <div className="w-full mt-2 space-y-4" onClick={(e) => e.stopPropagation()}>
        {mcpRequests.map((request, index) => {
          const args = request.arguments ? JSON.stringify(request.arguments, null, 2) : '{}';
          
          return (
            <div key={index} className="overflow-hidden relative">
              {/* Tool name and purpose header */}
              <div>
                <div className="px-4 py-3 relative">
                  <div className="absolute shadow-lg drop-shadow left-0 bottom-0 ml-3 transform translate-y-[60%] z-10 px-3 py-1 bg-white text-xs rounded border border-gray-200">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs text-white mr-2 bg-purple-600`}>
                      {request.tool_name.toUpperCase()}
                    </span>
                    {request.purpose}
                  </div>
                </div>
              </div>
              
              {/* Tool arguments code block */}
              <SyntaxHighlighterWithTheme
                language="json"
                className="rounded overflow-x-auto pt-4"
              >
                {args}
              </SyntaxHighlighterWithTheme>
            </div>
          );
        })}
      </div>
    );
  }

  const data = log.data;

  return (
    <div className="w-full mt-2 block" onClick={(e) => e.stopPropagation()}>
      <SyntaxHighlighterWithTheme
        language={guessLanguage(data)}
        className="p-2 rounded overflow-x-auto"
      >
        {typeof data === 'object'
          ? JSON.stringify(data, null, 2)
          : String(data)
        }
      </SyntaxHighlighterWithTheme>
    </div>
  );
};

export default LogDataDisplay;