import React, { useState } from 'react';
import { HIGHLIGHT_THEMES } from '@/utils/themes';

interface HeaderProps {
  isConnected: boolean;
  changeTheme?: (themeName: string) => void;
}

// Connection Status Component
const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <div className="flex items-center">
    <div className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
  </div>
);

const Header: React.FC<HeaderProps> = ({ isConnected, changeTheme }) => {
  const [currentTheme, setCurrentTheme] = useState<string>(
    localStorage.getItem('syntax-theme') || 'vscDarkPlus'
  );

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setCurrentTheme(newTheme);
    if (changeTheme) {
      changeTheme(newTheme);
    }
    localStorage.setItem('syntax-theme', newTheme);
  };

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-20">
      <h1 className="text-xl font-semibold">MCP Logger</h1>
      <div className="flex items-center space-x-4">
        <div>
          <label htmlFor="theme-select" className="mr-2 text-sm">Theme:</label>
          <select
            id="theme-select"
            className="bg-gray-700 text-white text-sm p-1 rounded"
            value={currentTheme}
            onChange={handleThemeChange}
          >
            {Object.entries(HIGHLIGHT_THEMES).map(([value, name]) => (
              <option key={value} value={value}>{name}</option>
            ))}
          </select>
        </div>
        <ConnectionStatus isConnected={isConnected} />
      </div>
    </header>
  );
};

export default Header;