import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Server } from 'http';
import { getWebSocketUrl } from './logger.js';

// Configure the HTTP server port
export const HTTP_PORT = process.env.HTTP_LOGGER_PORT || 8000;

// Express server instance
let server: express.Express | null = null;
let httpServer: Server | null = null;

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