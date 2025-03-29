import React, { useEffect, useRef } from 'react';
import SyntaxHighlighterWithTheme from './SyntaxHighlighterWithTheme';
import { guessLanguage } from '../utils/codeHighlighting';

// Render replace tool with content display
const ReplaceDisplay = ({ data }: { data: any }) => {
  if (!data || !data.file_path || !data.content) {
    return null;
  }
  
  // Function to prepare JSON display with placeholders
  const prepareJsonDisplay = () => {
    // Create a deep copy of the original data
    const displayData = JSON.parse(JSON.stringify(data));
    
    // Replace content with a placeholder
    if (displayData.content !== undefined) {
      // Use a unique token that won't be split by the syntax highlighter
      displayData.content = '__FILE_CONTENT__';
    }
    
    return JSON.stringify(displayData, null, 2);
  };
  
  // Use a ref to access the highlighter's rendered content
  const highlighterRef = useRef<HTMLDivElement>(null);

  // Function to handle highlighting after render
  useEffect(() => {
    if (!highlighterRef.current) return;

    // Function to find and highlight special strings
    const processHighlightedSpans = () => {
      const container = highlighterRef.current;
      if (!container) return;
      
      // Simply find all spans in the container
      const spans = container.querySelectorAll('span');
      
      // Track processed spans with their positions to help find trailing commas
      const processedSpans = new Map();
      
      // Check each span for our special strings
      spans.forEach((span, spanIndex) => {
        // Skip if already processed
        if (span.dataset.contentType) return;
        
        // Get the exact innerHTML
        const html = span.innerHTML;
        
        // Check for content placeholder - accounting for possible quotes
        const contentMatch = html.match(/^"?__FILE_CONTENT__"?$/);
        if (contentMatch) {
          styleSpan(span);
          processedSpans.set(spanIndex, { type: 'content' });
          return;
        }
        
        // Check for trailing commas (simple comma content in a span)
        if (html === ',') {
          // Check if the previous span is one of our processed spans
          const prevSpanInfo = processedSpans.get(spanIndex - 1);
          if (prevSpanInfo) {
            // This is a comma right after a content block, hide it
            span.style.display = 'none';
          }
        }
      });
      
      // Function to move the existing content DOM element into the span
      function styleSpan(span: HTMLSpanElement) {
        // Skip if already processed
        if (span.dataset.contentType) return;
        
        // Find the corresponding DOM element
        const targetId = 'file-content';
        const sourceElement = document.getElementById(targetId);
        
        if (sourceElement) {
          // Save the original span content for reference
          const originalContent = span.innerHTML;
          
          // Clear the span content
          span.innerHTML = '';
          
          // Clone the entire pre-styled container
          const clonedContainer = sourceElement.cloneNode(true) as HTMLElement;
          
          // Remove the ID to avoid duplicate IDs in the DOM
          clonedContainer.removeAttribute('id');
          
          // Add the cloned container to our span
          span.appendChild(clonedContainer);
          
          // Mark this span as processed
          span.dataset.contentType = 'content';
        }
      }
    };
    
    // Process after a short delay to ensure content is rendered
    const timerId = setTimeout(processHighlightedSpans, 10);
    return () => clearTimeout(timerId);
  }, [data]); // Re-run when data changes

  // Render content with ID
  const renderContentWithId = () => {
    // Try to guess language from the file path or content
    const lang = guessLanguage(data.content, data.file_path);
    
    return (
      <div className="mb-6">
        <div className="text-sm mb-1">
          <span className="font-semibold">{data.file_path}</span>
        </div>
        
        <div id="file-content" className="block w-full p-0 mt-2 -mb-2 rounded-md shadow-sm border border-blue-600 border-opacity-30 bg-blue-600 bg-opacity-[0.03] relative">
          <div className="absolute -top-2.5 right-2 text-xs font-bold tracking-wide text-white px-2 py-1 bg-blue-600 bg-opacity-75 rounded-md z-10 shadow-sm">
            Content
          </div>
          <SyntaxHighlighterWithTheme language={lang} className="p-2 m-0 w-full overflow-auto block text-[0.9rem] leading-6 rounded-md">
            {data.content}
          </SyntaxHighlighterWithTheme>
        </div>
      </div>
    );
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Display JSON with inline file content placeholder */}
      <div ref={highlighterRef}>
        <SyntaxHighlighterWithTheme
          language="json"
          className="p-2 rounded overflow-auto text-sm mb-4"
        >
          {prepareJsonDisplay()}
        </SyntaxHighlighterWithTheme>
      </div>
      
      {/* Hidden content that will be moved into the JSON display */}
      <div style={{ display: 'none' }}>
        {renderContentWithId()}
      </div>
    </div>
  );
};

export default ReplaceDisplay;