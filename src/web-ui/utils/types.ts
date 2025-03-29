// Define log level type
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Define log message interface
export interface LogMessage {
  level: LogLevel;
  tool_name: string;
  type: 'request'|'response';
  description: string;
  data?: any;
}

export interface LogMessageForWeb {
  level: LogLevel;
  tool_name: string;
  type: 'request'|'response';
  description: string;
  timestamp: string;
  data?: any;
}