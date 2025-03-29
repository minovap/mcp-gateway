// Define log level type
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'batch' | 'tool';

// Define log message interface
export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}