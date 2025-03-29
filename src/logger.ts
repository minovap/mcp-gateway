import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import {LogMessage, LogMessageForWeb} from "@/utils/types";

// Configure the WebSocket server port
export const WS_PORT = process.env.WS_LOGGER_PORT || 8080;

// Event emitter for message broadcasting
const messageEmitter = new EventEmitter();

// WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server
 */
export const initWebSocketServer = (): WebSocketServer => {
  if (wss) return wss;
  
  console.error(`Starting WebSocket logger server on port ${WS_PORT}...`);
  wss = new WebSocketServer({ port: Number(WS_PORT) });
  
  wss.on('connection', (ws: WebSocket) => {
    console.error('Client connected to logger WebSocket');
    
    // Send previously logged messages to new clients
    const recentMessages = getRecentMessages();
    if (recentMessages.length > 0) {
      ws.send(JSON.stringify({
        type: 'history',
        messages: recentMessages
      }));
    }
    
    // Subscribe to new messages
    const messageHandler = (message: LogMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'message',
          message
        }));
      }
    };
    
    messageEmitter.on('message', messageHandler);
    
    ws.on('close', () => {
      console.error('Client disconnected from logger WebSocket');
      messageEmitter.off('message', messageHandler);
    });
  });

  logger = createLogger();
  
  return wss;
};

/**
 * Close the WebSocket server
 */
export const closeWebSocketServer = async (): Promise<void> => {
  if (!wss) return;
  
  return new Promise((resolve) => {
    wss!.close(() => {
      wss = null;
      console.error('WebSocket logger server closed');
      resolve();
      logger = (message: LogMessage) => {};
    });
  });
};


const recentMessages: LogMessage[] = [];
const MAX_RECENT_MESSAGES = 100;

const getRecentMessages = (): LogMessage[] => {
  return [...recentMessages];
};


// Export a default logger instance
export let logger: any = (message: LogMessage) => {};

export const logToWebsocket = (message: LogMessage) => {
  logger(message);
};

/**
 * Create a logger that sends messages via WebSocket
 */
export const createLogger = (options: { logToConsole?: boolean } = {}) => {
  // Initialize WebSocket server if not already running
  if (!wss) {
    initWebSocketServer();
  }
  
  let logToConsole = options.logToConsole ?? false;

  // Logger function for different log levels
  const sendLog = (message: LogMessage) => {
    const logMessage: LogMessageForWeb = {
      ...message,
      timestamp: new Date().toISOString(),
    };
    
    // Add to recent messages, maintain max size
    recentMessages.push(logMessage);
    if (recentMessages.length > MAX_RECENT_MESSAGES) {
      recentMessages.shift();
    }
    
    // Emit to all connected clients
    messageEmitter.emit('message', logMessage);
    
    // Log to console if enabled
    if (logToConsole) {
      const consoleMethod = message.level === 'error' ? console.error :
                           message.level === 'warn' ? console.warn :
                             message.level === 'debug' ? console.debug :
                           console.log;
      
      consoleMethod(`[${message.level.toUpperCase()}] ${message}`, message);
    }

    
    return logMessage;
  };
  
  return (message: LogMessage) => sendLog(message);
};


// Add a helper to get the WebSocket URL
export const getWebSocketUrl = () => {
  return `ws://localhost:${WS_PORT}`;
};