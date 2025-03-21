import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

interface ServerConfigInternal {
  name: string;
  transport: { command: string; args?: string[]; env?: Record<string, string> | string[] } | { url: string };
  toolOverrides?: Record<string, { enabled?: boolean; description?: string }>;
  disabled?: boolean;
}

const sleep = (time: number) => new Promise<void>(resolve => setTimeout(() => resolve(), time))
export interface ConnectedClient {
  client: Client;
  cleanup: () => Promise<void>;
  name: string;
}

const createClient = (server: ServerConfigInternal): { client: Client | undefined, transport: Transport | undefined } => {

  let transport: Transport | null = null
  try {
    if ('url' in server.transport) {
      // SSE transport
      transport = new SSEClientTransport(new URL(server.transport.url));
    } else if ('command' in server.transport) {
      // Stdio transport
      const envVars: Record<string, string> = {};
      
      // Set up environment variables from config
      if (server.transport.env) {
        // If it's the new object format, use it directly
        if (!Array.isArray(server.transport.env)) {
          Object.assign(envVars, server.transport.env);
        } 
        // If it's the legacy array format, convert to object
        else {
          server.transport.env.forEach(key => {
            envVars[key] = process.env[key] || '';
          });
        }
      }
      
      transport = new StdioClientTransport({
        command: server.transport.command,
        args: server.transport.args,
        env: Object.keys(envVars).length > 0 ? envVars : undefined
      });
    }
  } catch (error) {
    console.error(`Failed to create transport for ${server.name}:`, error);
  }

  if (!transport) {
    console.warn(`Transport ${server.name} not available.`)
    return { transport: undefined, client: undefined }
  }

  const client = new Client({
    name: 'mcp-proxy-client',
    version: '1.0.0',
  }, {
    capabilities: {
      prompts: {},
      resources: { subscribe: true },
      tools: {}
    }
  });

  return { client, transport }
}

export const createClients = async (servers: ServerConfigInternal[]): Promise<ConnectedClient[]> => {
  const clients: ConnectedClient[] = [];

  for (const server of servers) {
    //console.log(`Connecting to server: ${server.name}`);

    const waitFor = 2500
    const retries = 3
    let count = 0
    let retry = true

    while (retry) {

      const { client, transport } = createClient(server)
      if (!client || !transport) {
        break
      }

      try {
        await client.connect(transport);
        //console.log(`Connected to server: ${server.name}`);

        clients.push({
          client,
          name: server.name,
          cleanup: async () => {
            await transport.close();
          }
        });

        break

      } catch (error) {
        console.error(`Failed to connect to ${server.name}:`, error);
        count++
        retry = (count < retries)
        if (retry) {
          try {
            await client.close()
          } catch { }
          console.log(`Retry connection to ${server.name} in ${waitFor}ms (${count}/${retries})`);
          await sleep(waitFor)
        }
      }

    }

  }

  return clients;
};