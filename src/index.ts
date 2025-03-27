#!/usr/bin/env node

/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing notes as resources
 * - Reading individual notes
 * - Creating new notes via a tool
 * - Summarizing all notes via a prompt
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-proxy.js";
import {initWebSocketServer, WS_PORT} from './logger.js';
import { initHttpServer } from './web-server.js';
import treeKill from 'tree-kill'
import net from 'net'

async function main() {
  const transport = new StdioServerTransport();

// Generate a random timeout between 5 and 15 seconds (5000-15000ms)
  const randomTimeout = Math.floor(Math.random() * 10000) + 5000;

// Function to check if port is in use
  const isPortInUse = (port: any) => {
    return new Promise((resolve) => {
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

  // Set timeout with the random delay
  setTimeout(async () => {
    try {
      // Check if WS_PORT is in use
      const portInUse = await isPortInUse(WS_PORT);

      if (!portInUse) {
        // Only initialize if port is free
        initWebSocketServer();
        initHttpServer();
      } else {
        //console.log(`Port ${WS_PORT} is already in use. Servers not started.`);
      }
    } catch (error) {
      //console.error('Error during server initialization:', error);
    }
  }, randomTimeout);

  const { server, cleanup } = await createServer();
  await server.connect(transport);

  /*
   * Process exit handling
   */
  const handleExit = async () => {
    await cleanup();
    await server.close();

    const parentPid = process.pid;
    treeKill(parentPid, 'SIGTERM', () => process.exit(0));

    setTimeout(() => {
      console.error("Cleanup using tree-kill timed out. Exiting forcefully.");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  setInterval(() => {
    if (process.ppid === 1) {
      handleExit();
    }
  }, 500);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
