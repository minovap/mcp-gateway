import React from 'react';
import { guessLanguage } from '@/utils/codeHighlighting';
import SyntaxHighlighterWithTheme from './SyntaxHighlighterWithTheme';
import {LogMessage} from "../utils/types";
import {z} from "zod";
import {batchInputRequests} from "../../tools/batch-request";
import {renderEditBlocks} from "../utils/editBlocksHandler";

interface LogDataDisplayProps {
  log: LogMessage;
}
type BatchRequest = z.infer<typeof batchInputRequests>;

const LogDataDisplay: React.FC<LogDataDisplayProps> = ({ log }) => {
  if (log.tool_name.includes('edit_blocks') && log.data?.edits) {
    return (
      <div className="w-full mt-2 block" onClick={(e) => e.stopPropagation()}>
        {/* Special handling for edit_blocks */}
        { renderEditBlocks(log.data) }
      </div>
    );
  }

  if (log.tool_name === 'batch_request') {
    const mcpRequests: BatchRequest = log.data;
    
    return (
      <div className="w-full mt-2 space-y-4" onClick={(e) => e.stopPropagation()}>
        {mcpRequests.map((request, index) => {
          const args = request.arguments ? JSON.stringify(request.arguments, null, 2) : '{}';
          
          return (
            <div key={index} className="border border-gray-200 rounded-md overflow-hidden shadow-sm bg-white">
              {/* Tool name and purpose header */}
              <div className="border-b border-gray-200">
                <div className="px-4 py-2">
                  <div className="flex items-center">
                    <span className="font-medium text-purple-600 mr-2">Tool:</span>
                    <span className="font-mono text-gray-800">{request.tool_name}</span>
                  </div>
                  <div className="flex items-start mt-1">
                    <span className="font-medium text-purple-600 mr-2">Purpose:</span>
                    <span className="text-gray-700">{request.purpose}</span>
                  </div>
                </div>
              </div>
              
              {/* Tool arguments code block */}
              <SyntaxHighlighterWithTheme
                language="json"
                className="rounded-b overflow-x-auto"
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