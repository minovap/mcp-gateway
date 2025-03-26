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
import { initWebSocketServer } from './logger.js';
import { initHttpServer } from './web-server.js';
import treeKill from 'tree-kill'

async function main() {
  const transport = new StdioServerTransport();

  initWebSocketServer();
  initHttpServer();

  const { server, cleanup } = await createServer();
  await server.connect(transport);

  /*
   * Process exit handling
   */
  const handleExit = async () => {
    await cleanup();
    await server.close();

    const parentPid = process.pid;
    treeKill(parentPid, 'SIGTERM');

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
