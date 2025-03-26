import { readFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir, platform } from 'os';
import { logToFile } from './mcp-proxy.js';

// Define server-specific configuration
export interface ServerConfig {
  disabled?: boolean;
  command?: string;  // Command for stdio transport
  args?: string[];   // Args for stdio transport
  url?: string;      // URL for SSE transport
  env?: Record<string, string>; // Environment variables as key-value pairs
  toolOverrides?: Record<string, ToolOverrideConfig>;
}

export interface ToolOverrideConfig {
  enabled?: boolean;
  description?: string;
}

export interface Config {
  proxyBatchMcpServers: Record<string, ServerConfig>;
}

/**
 * Convert the server configuration map to an array with name included in each server config
 * This is for internal use to maintain compatibility with the rest of the codebase
 */
export function serversMapToArray(serversMap: Record<string, ServerConfig>): Array<{
  name: string;
  transport: { command: string; args?: string[]; env?: Record<string, string> } | { url: string };
  toolOverrides?: Record<string, ToolOverrideConfig>;
  disabled?: boolean;
}> {
  return Object.entries(serversMap)
    .filter(([_, config]) => !config.disabled) // Skip disabled servers
    .map(([name, config]) => {
      // Determine the transport type
      let transport: any;
      
      if (config.url) {
        transport = { url: config.url };
      } else if (config.command) {
        transport = {
          command: config.command,
          args: config.args
        };
        
        // Transform environment variables object to array if present
        if (config.env) {
          // We'll handle env variables specially in the client.ts
          transport.env = config.env;
        }
      } else {
        logToFile('warn', `Server ${name} has invalid configuration: missing command or url`);
        transport = { command: 'echo', args: ['Server has invalid configuration'] };
      }
      
      // Create a properly formatted tool overrides object
      const formattedToolOverrides: Record<string, ToolOverrideConfig> = {};
      if (config.toolOverrides) {
        Object.entries(config.toolOverrides).forEach(([tool_name, override]) => {
          formattedToolOverrides[tool_name] = {
            enabled: override.enabled !== false, // Default to true if not explicitly false
            description: override.description
          };
        });
      }
      
      return {
        name,
        transport,
        toolOverrides: Object.keys(formattedToolOverrides).length ? formattedToolOverrides : undefined,
        disabled: config.disabled
      };
    });
}

/**
 * Check if a file exists at the given path
 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get platform-specific config paths
 */
export const getConfigPaths = (): string[] => {
  const paths: string[] = [];
  
  // Platform-specific Claude desktop config paths
  switch (platform()) {
    case 'darwin':
      // macOS
      paths.push(join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
      break;
    case 'win32':
      // Windows
      paths.push(join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json'));
      break;
    case 'linux':
      // Linux
      paths.push(join(homedir(), '.config', 'Claude', 'claude_desktop_config.json'));
      break;
  }
  
  // Default config path in current directory
  paths.push(resolve(process.cwd(), 'config.json'));
  
  return paths;
};

/**
 * Load configuration from various locations in order of priority:
 * 1. Environment variable MCP_CONFIG_PATH
 * 2. Claude desktop config file
 * 3. Default config.json in current directory
 */
export const loadConfig = async (): Promise<Config> => {
  try {
    // Try environment variable first
    if (process.env.MCP_CONFIG_PATH) {
      const configPath = process.env.MCP_CONFIG_PATH;
      if (await fileExists(configPath)) {
        const fileContents = await readFile(configPath, 'utf-8');
        const rawConfig = JSON.parse(fileContents);
        
        // Check if the config has the proxyBatchMcpServers key
        if (rawConfig.proxyBatchMcpServers) {
          return {
            proxyBatchMcpServers: rawConfig.proxyBatchMcpServers
          };
        }
        
        // Move on to the next config source if key is not present
      }
    }
    
    // Try platform-specific paths
    const configPaths = getConfigPaths();
    for (const configPath of configPaths) {
      if (await fileExists(configPath)) {
        const fileContents = await readFile(configPath, 'utf-8');
        const rawConfig = JSON.parse(fileContents);
        
        // Check if the config has the proxyBatchMcpServers key
        if (rawConfig.proxyBatchMcpServers) {
          return {
            proxyBatchMcpServers: rawConfig.proxyBatchMcpServers
          };
        }
        
        // Continue to the next config file if the key is not present
      }
    }
    
    // If no config file found, return empty config
    logToFile('warn', 'No config file found. Using empty configuration.');
    return { proxyBatchMcpServers: {} };
  } catch (error) {
    logToFile('error', `Error loading configuration: ${error}`);
    // Return empty config if an error occurs
    return { proxyBatchMcpServers: {} };
  }
};