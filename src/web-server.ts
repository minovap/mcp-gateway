import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Server } from 'http';
import net from 'net';
import { getWebSocketUrl, initWebSocketServer, WS_PORT } from './logger.js';
import { logToFile } from './mcp-proxy.js';


// Configure the HTTP server port
export const HTTP_PORT = process.env.HTTP_LOGGER_PORT || 8000;

// Express server instance
let server: express.Express | null = null;
let httpServer: Server | null = null;
let serversInitialized: boolean = false;

/**
 * Initialize the HTTP server
 */
export const initHttpServer = (): express.Express => {
  if (server) return server;
  
  // Get directory paths for serving static files
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicPath = path.join(__dirname, 'public');
  
  // Create Express server
  server = express();
  
  // Enable CORS
  server.use(cors());
  
  // Serve static files
  server.use(express.static(publicPath));
  
  // Handle root route
  server.get('/', (req, res) => {
    res.redirect('/index.html');
  });
  
  // API endpoint to get WebSocket URL
  server.get('/api/ws-url', (req, res) => {
    res.json({ url: getWebSocketUrl() });
  });
  
  // Start server
  httpServer = server.listen(Number(HTTP_PORT), () => {
    console.error(`HTTP server running at http://localhost:${HTTP_PORT}`);
    console.error(`WebSocket logger URL: ${getWebSocketUrl()}`);
  });
  
  return server;
};

/**
 * Initialize both WebSocket and HTTP servers with port availability check
 * @param maxWaitTimeMs Maximum time to wait before returning to caller (default: 500ms)
 * @returns Promise that resolves to a boolean indicating if initialization was successful within the time limit
 */
export const initializeServers = async (maxWaitTimeMs: number = 500): Promise<boolean> => {
  if (serversInitialized) {
    return true; // Servers already initialized
  }
  
  // Mark servers as initialized immediately to prevent multiple initialization attempts
  serversInitialized = true;
  
  // Function to check if port is in use
  const isPortInUse = (port: number) => {
    return new Promise<boolean>((resolve) => {
      const tester = net.createServer()
        .once('error', () => {
          // Error indicates port is in use
          resolve(true);
        })
        .once('listening', () => {
          // If we can listen, the port is free
          tester.close(() => resolve(false));
        })
        .listen(port);
    });
  };
  
  // Generic retry function for both immediate and background initialization
  const tryInitializeServers = async (
    phase: 'immediate' | 'background',
    timeoutMs: number,
    intervalMs: number
  ): Promise<boolean> => {
    const startTime = Date.now();
    let attemptCount = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      attemptCount++;
      try {
        const portInUse = await isPortInUse(Number(WS_PORT));
        if (!portInUse) {
          // Port is free, initialize servers
          initWebSocketServer();
          initHttpServer();
          logToFile('info', `WebSocket and HTTP servers initialized (${phase} attempt ${attemptCount})`);
          return true;
        } else {
          // Port is in use, log and wait for next attempt
          logToFile('info', `Port ${WS_PORT} in use, waiting ${intervalMs}ms before retry (${phase} attempt ${attemptCount})`);
          // Wait for the specified interval
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        logToFile('error', `Error checking port availability during ${phase} phase: ${error}`);
        return false;
      }
    }
    
    // If we get here, we've timed out waiting for the port
    logToFile('warn', `${phase} phase: Timed out waiting for port ${WS_PORT} to become available after ${timeoutMs}ms (${attemptCount} attempts)`);
    return false;
  };
  
  // Try immediate initialization first (with shorter timeout and interval)
  const immediateSuccess = await tryInitializeServers('immediate', maxWaitTimeMs, 50);
  
  if (immediateSuccess) {
    return true;
  }
  
  // If immediate initialization fails, start background initialization
  logToFile('info', `Initial ${maxWaitTimeMs}ms elapsed, continuing initialization in background`);
  
  // Start background initialization without awaiting
  tryInitializeServers('background', 60000, 250).catch(error => {
    logToFile('error', `Error in background initialization: ${error}`);
  });
  
  return false;
};

/**
 * Close the HTTP server
 */
export const closeHttpServer = async (): Promise<void> => {
  if (!httpServer) return;
  
  return new Promise((resolve, reject) => {
    httpServer!.close((err: Error | undefined) => {
      if (err) {
        reject(err);
        return;
      }
      httpServer = null;
      server = null;
      console.error('HTTP server closed');
      resolve();
    });
  });
};