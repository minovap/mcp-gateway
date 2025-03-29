import React, { useEffect, useRef } from 'react';
import SyntaxHighlighterWithTheme from '../components/SyntaxHighlighterWithTheme';
import { guessLanguage } from './codeHighlighting';

// Render edit blocks with simple search/replace display
export const renderEditBlocks = (data: any) => {
  if (!data || !data.edits) {
    return null;
  }
  
  // Function to render search/replace blocks with IDs for linking
  
  // Create a copy of the data with placeholder IDs for search/replace values
  const prepareJsonDisplay = () => {
    // Create a deep copy of the original data
    const displayData = JSON.parse(JSON.stringify(data));
    
    // Replace search/replace text values with identifiable placeholders
    if (displayData.edits) {
      Object.entries(displayData.edits).forEach(([filePath, editsList]: [string, any[]]) => {
        (editsList as any[]).forEach((edit, index) => {
          if (edit.search !== undefined) {
            // Use a unique token that won't be split by the syntax highlighter
            edit.search = `__SEARCH_TEXT_${index}__`;
          }
          if (edit.replace !== undefined) {
            // Use a unique token that won't be split by the syntax highlighter
            edit.replace = `__REPLACE_TEXT_${index}__`;
          }
        });
      });
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
        if (span.dataset.editType) return;
        
        // Get the exact innerHTML
        const html = span.innerHTML;
        
        // Check for search patterns - accounting for possible quotes
        const searchMatch = html.match(/^"?__SEARCH_TEXT_(\d+)__"?$/);
        if (searchMatch) {
          const index = parseInt(searchMatch[1], 10);
          styleSpan(span, 'search', index);
          processedSpans.set(spanIndex, { type: 'search', index });
          return;
        }
        
        // Check for replace patterns - accounting for possible quotes
        const replaceMatch = html.match(/^"?__REPLACE_TEXT_(\d+)__"?$/);
        if (replaceMatch) {
          const index = parseInt(replaceMatch[1], 10);
          styleSpan(span, 'replace', index);
          processedSpans.set(spanIndex, { type: 'replace', index });
        }
        
        // Check for trailing commas (simple comma content in a span)
        if (html === ',') {
          // Check if the previous span is one of our processed spans
          const prevSpanInfo = processedSpans.get(spanIndex - 1);
          if (prevSpanInfo) {
            // This is a comma right after a search/replace block, hide it
            span.style.display = 'none';
          }
        }
      });
      
      // Function to move the existing search/replace DOM elements into the span
      function styleSpan(span, type, index) {
        // Skip if already processed
        if (span.dataset.editType) return;
        
        // Find the corresponding DOM element from renderSearchReplacePairsWithIds
        const targetId = `${type}-${index}`;
        const sourceElement = document.getElementById(targetId);
        
        if (sourceElement) {
          // Save the original span content for reference
          const originalContent = span.innerHTML;
          
          // Clear the span content
          span.innerHTML = '';
          
          // Clone the entire pre-styled container that includes both the label and syntax highlighter
          const clonedContainer = sourceElement.cloneNode(true) as HTMLElement;
          
          // Remove the ID to avoid duplicate IDs in the DOM
          clonedContainer.removeAttribute('id');
          
          // Add the cloned container to our span
          span.appendChild(clonedContainer);
          
          // Mark this span as processed
          span.dataset.editType = type;
          span.dataset.editIndex = String(index);
        }
      }
    };
    
    // Process after a short delay to ensure content is rendered
    // Use a longer delay for the initial processing to ensure all elements are rendered
    const timerId = setTimeout(processHighlightedSpans, 10);
    return () => clearTimeout(timerId);
  }, [data]); // Re-run when data changes

  // Modify the renderSearchReplacePairs function to add IDs to elements
  const renderSearchReplacePairsWithIds = () => {
    // Array to hold all search/replace pairs from all files
    const allPairs: JSX.Element[] = [];
    
    // Process each file's edits
    Object.entries(data.edits).forEach(([filePath, editsList]: [string, any[]]) => {
      // Process each edit in the file
      (editsList as any[]).forEach((edit, editIndex) => {
        // Only process if we have both search and replace values
        if (edit.search !== undefined && edit.replace !== undefined) {
          // Try to guess language from the file extension or content
          const lang = guessLanguage(edit.search, filePath);
          
          // Add the search/replace pair to our list
          allPairs.push(
            <div key={`${filePath}-${editIndex}`} className="mb-6">
              <div className="text-sm mb-1">
                <span className="font-semibold">{filePath}</span> - Edit {editIndex + 1}
              </div>
              
              <div className="mb-2">
                <div className="text-xs text-blue-600 font-semibold mb-1 flex items-center">
                  <span>Search:</span>
                  <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs border border-blue-300">__SEARCH_TEXT_{editIndex}__</span>
                </div>
                <div id={`search-${editIndex}`} className="block w-full p-0 mt-2 -mb-2 rounded-md shadow-sm border border-red-600 border-opacity-40 bg-red-600 bg-opacity-[0.03] relative">
                  <div className="absolute -top-2.5 right-2 text-xs font-bold tracking-wide text-white px-2 py-1 bg-red-600 bg-opacity-85 rounded-md z-10 shadow-sm">
                    Search
                  </div>
                  <SyntaxHighlighterWithTheme language={lang} className="p-2 m-0 w-full overflow-auto block text-[0.9rem] leading-6 rounded-md">
                    {edit.search}
                  </SyntaxHighlighterWithTheme>
                </div>
              </div>
              
              <div>
                <div className="text-xs text-green-600 font-semibold mb-1 flex items-center">
                  <span>Replace:</span>
                  <span className="ml-2 px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs border border-green-300">__REPLACE_TEXT_{editIndex}__</span>
                </div>
                <div id={`replace-${editIndex}`} className="block w-full p-0 mt-2 -mb-2 rounded-md shadow-sm border border-green-600 border-opacity-30 bg-green-600 bg-opacity-[0.03] relative">
                  <div className="absolute -top-2.5 right-2 text-xs font-bold tracking-wide text-white px-2 py-1 bg-green-600 bg-opacity-75 rounded-md z-10 shadow-sm">
                    Replace
                  </div>
                  <SyntaxHighlighterWithTheme language={lang} className="p-2 m-0 w-full overflow-auto block text-[0.9rem] leading-6 rounded-md">
                    {edit.replace}
                  </SyntaxHighlighterWithTheme>
                </div>
              </div>
            </div>
          );
        }
      });
    });
    
    return allPairs;
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Display JSON with inline search/replace values */}
      {/* Removed instructional text */}
      <div ref={highlighterRef}>
        <SyntaxHighlighterWithTheme
          language="json"
          className="p-2 rounded overflow-auto text-sm mb-4"
        >
          {prepareJsonDisplay()}
        </SyntaxHighlighterWithTheme>
      </div>
      
      {/* We don't need to display the search/replace blocks anymore since they're inline */}
      <div style={{ display: 'none' }}>
        {renderSearchReplacePairsWithIds()}
      </div>
    </div>
  );
};