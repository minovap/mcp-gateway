import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { THEME_KEYS } from '@/utils/themes';

// Import all available themes
import * as prismStyles from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SyntaxHighlighterWithThemeProps {
  language: string;
  children: string;
  className?: string;
}

const SyntaxHighlighterWithTheme: React.FC<SyntaxHighlighterWithThemeProps> = ({ 
  language, 
  children,
  className = ''
}) => {
  const [currentTheme, setCurrentTheme] = useState<any>(prismStyles.vscDarkPlus);
  
  // Listen for theme changes from localStorage
  useEffect(() => {
    // Get initial theme
    updateTheme();
    
    // Set up event listener for theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'syntax-theme') {
        updateTheme();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Update theme from localStorage
  const updateTheme = () => {
    const savedTheme = localStorage.getItem('syntax-theme') || 'vscDarkPlus';
    const themeKey = THEME_KEYS[savedTheme] || 'vscDarkPlus';
    // @ts-ignore - TypeScript doesn't know about the dynamic import
    setCurrentTheme(prismStyles[themeKey] || prismStyles.vscDarkPlus);
  };
  
  return (
    <SyntaxHighlighter
      language={language}
      style={currentTheme}
      className={className}
      wrapLines={true}
      wrapLongLines={true}
      customStyle={{
        paddingTop: '2em',
        paddingBottom: '1.5em',
      }}
    >
      {children}
    </SyntaxHighlighter>
  );
};

export default SyntaxHighlighterWithTheme;