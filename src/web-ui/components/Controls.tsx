import React from 'react';
import { LogLevel } from '@/utils/types';

interface ControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: Record<LogLevel, boolean>;
  toggleFilter: (level: LogLevel) => void;
  isPaused: boolean;
  togglePause: () => void;
  clearLogs: () => void;
  autoScroll: boolean;
  toggleAutoScroll: () => void;
}

// Search Component
const SearchBox: React.FC<{ searchTerm: string; setSearchTerm: (term: string) => void }> = ({ searchTerm, setSearchTerm }) => (
  <div className="relative flex-grow">
    <input
      type="text"
      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Search logs..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
  </div>
);

// Filter Component
const LevelFilters: React.FC<{ filters: Record<LogLevel, boolean>; toggleFilter: (level: LogLevel) => void }> = ({ filters, toggleFilter }) => (
  <div className="flex items-center space-x-3">
    {Object.keys(filters).map(level => (
      <div key={level} className="flex items-center">
        <input
          type="checkbox"
          id={`filter-${level}`}
          checked={filters[level]}
          onChange={() => toggleFilter(level as LogLevel)}
          className="mr-1"
        />
        <label htmlFor={`filter-${level}`} className="text-sm">
          {level.charAt(0).toUpperCase() + level.slice(1)}
        </label>
      </div>
    ))}
  </div>
);

const Controls: React.FC<ControlsProps> = ({
  searchTerm,
  setSearchTerm,
  filters,
  toggleFilter,
  isPaused,
  togglePause,
  clearLogs,
  autoScroll,
  toggleAutoScroll
}) => (
  <div className="flex items-center space-x-4 mb-4 sticky top-16 z-10 bg-white py-3 px-3 rounded shadow-md">
    <SearchBox searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

    <LevelFilters filters={filters} toggleFilter={toggleFilter} />

    <button
      onClick={togglePause}
      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
    >
      {isPaused ? 'Resume' : 'Pause'}
    </button>

    <button
      onClick={clearLogs}
      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-200"
    >
      Clear
    </button>

    <button
      onClick={toggleAutoScroll}
      className={`px-3 py-2 text-white rounded transition duration-200 ${autoScroll ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'}`}
    >
      {autoScroll ? 'Auto-Scroll: On' : 'Auto-Scroll: Off'}
    </button>
  </div>
);

export default Controls;