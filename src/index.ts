#!/usr/bin/env node

/**
 * MCP gateway server with robust process management
 * - Uses single-instance mechanism to prevent duplicate gateways
 * - Properly handles orphaned processes
 * - Aggressively terminates all related processes on exit
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp-proxy.js";
import { ConnectedClient } from './client.js';

/**
 * Forcefully disconnect clients and terminate their transport processes
 */
async function disconnectClients(clients: ConnectedClient[]): Promise<void> {
  if (!clients || clients.length === 0) return;
  
  // First try to gracefully disconnect each client
  await Promise.all(clients.map(async (client) => {
    try {
      // Run cleanup function (closes transport)
      await client.cleanup();
      
      // Explicitly close client connection
      if (client.client) {
        await client.client.close();
      }
    } catch {}
  }));
}

/**
 * Setup orphan detection
 */
function setupOrphanDetection(): NodeJS.Timeout | null {
  // Check if we're already an orphan
  if (process.ppid === 1) {
    process.exit(0);
    return null;
  }
  
  // Get initial parent PID for comparison
  const initialParentPID = process.ppid;
  
  // Set up polling at a frequent interval
  const interval = setInterval(() => {
    // Check if parent died (we became an orphan)
    if (process.ppid === 1 || process.ppid !== initialParentPID) {
      clearInterval(interval);
      process.exit(0);
    }
  }, 500); // Check every 500ms
  
  // Don't let the interval keep the process alive
  interval.unref();
  
  return interval;
}

async function main() {
  // Set up orphan detection
  const orphanInterval = setupOrphanDetection();

  // Initialize the server
  const transport = new StdioServerTransport();
  const { server, cleanup, connectedClients } = await createServer();
  await server.connect(transport);

  // Handle exit gracefully
  const handleExit = async () => {
    // Clear orphan check interval
    if (orphanInterval) clearInterval(orphanInterval);

    // First disconnect clients (closes transports properly)
    if (connectedClients) {
      await disconnectClients(connectedClients);
    }

    // Clean up server resources
    await cleanup();
    await server.close();

    // Give a small delay for processes to be cleaned up
    await new Promise(resolve => setTimeout(resolve, 300));

    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    await handleExit();
  });
  process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled rejection:", reason);
    await handleExit();
  });

  process.on("exit", () => {});
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});