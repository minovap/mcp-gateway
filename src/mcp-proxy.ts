import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { batchRequestTool, BatchRequestSchema, BatchResponseSchema } from "./tools/batch-request.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  ListToolsResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResultSchema,
  ResourceTemplate,
  CompatibilityCallToolResultSchema,
  GetPromptResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import { createClients, ConnectedClient } from './client.js';
import { Config, loadConfig, serversMapToArray } from './config.js';
import { z } from 'zod';
import * as eventsource from 'eventsource';
import * as fs from 'fs';
import * as path from 'path';

global.EventSource = eventsource.EventSource

// Import the logger
import { logger } from './logger.js';

// Use environment variable for logging to file (optional)
export const MCP_LOG_FILE = process.env.MCP_GATEWAY_LOG_FILE;

export const logToFile = (method: 'error'|'warn'|'info', ...params: any) => {
  if (MCP_LOG_FILE) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${method} ${JSON.stringify(params, null, 2)}\n\n`;
      fs.appendFileSync(MCP_LOG_FILE, logEntry);
    } catch (error) {
      // Silently fail if file can't be written
    }
  }
};

export const logToWebsocket = (method: 'error'|'warn'|'info'|'log'|'debug'|'batch'|'tool', message: string, data: any) => {
  logger[method](message, data);
};

export const createServer = async () => {
  // Load configuration and connect to servers
  const config = await loadConfig();
  // Convert the server map to array format expected by createClients
  const serversArray = serversMapToArray(config.proxyBatchMcpServers);
  const connectedClients = await createClients(serversArray);
  logToFile('info', `Connected to ${connectedClients.length} servers`);

  // Maps to track which client owns which resource
  const toolToClientMap = new Map<string, ConnectedClient>();
  const resourceToClientMap = new Map<string, ConnectedClient>();
  const promptToClientMap = new Map<string, ConnectedClient>();
  
  // Track servers that have failed to fetch prompts or resources so we don't retry them
  const failedPromptServers = new Map<string, boolean>();
  const failedResourceServers = new Map<string, boolean>();

  const server = new Server(
    {
      name: "mcp-proxy-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
      },
    },
  );

  // List Tools Handler
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const allTools: Tool[] = [];
    toolToClientMap.clear();
    
    // Add our custom batch request tool
    allTools.push(batchRequestTool);

    // No global tool overrides - only server-specific overrides are used

    for (const connectedClient of connectedClients) {
      try {
        const result = await connectedClient.client.request(
          {
            method: 'tools/list',
            params: {
              _meta: request.params?._meta
            }
          },
          ListToolsResultSchema
        );

        if (result.tools) {
          // Get server-specific tool overrides if available
          // Look up the server config using the server name as key
          const serverName = connectedClient.name;
          const serverConfig = serversArray.find(s => s.name === serverName);
          const serverToolOverrides = serverConfig?.toolOverrides || {};

          const toolsWithSource = result.tools
            .filter(tool => {
              // Get the override for this tool if it exists
              const override = serverToolOverrides[tool.name];
              
              // If there's an override with enabled explicitly set to false, filter it out
              if (override && override.enabled === false) {
                return false;
              }
              
              return true;
            })
            .map(tool => {
              toolToClientMap.set(tool.name, connectedClient);
              
              // Apply description overrides if available
              const serverOverride = serverToolOverrides[tool.name];
              
              let description = tool.description || '';
              
              // Use server override for description if available
              if (serverOverride?.description) {
                description = serverOverride.description;
              }
              
              return {
                ...tool,
                description: `[${connectedClient.name}] ${description} (This tool's description is only for documentation - all tool uses should be sent through the batch_request tool)`
              };
            });
            
          allTools.push(...toolsWithSource);
        }
      } catch (error) {
        logToFile('error', `Error fetching tools from ${connectedClient.name}: ${error}`);
      }
    }

    return { tools: allTools };
  });

  // Call Tool Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Log the request
    logToFile('info', 'tools/call', request.params);

    const { name, arguments: args } = request.params;
    
    // Check if this is our batch request tool
    if (name === 'batch_request') {
      logToFile('info', 'Processing batch request');
      try {
        let batchArgs;
        try {
          // Handle incomplete data by ensuring args is an object with a requests property
          const safeArgs = args || {};
          if (!safeArgs.requests) {
            safeArgs.requests = [];
          }
          batchArgs = BatchRequestSchema.parse(safeArgs);
          logToWebsocket('batch', `➡️ ${batchArgs.purpose}`, batchArgs.requests);
        } catch (parseError) {
          return {
            content: [
              {
                type: "text",
                // @ts-ignore
                text: JSON.stringify({ results: [], isError: true, error: parseError.message })
              }
            ]
          };
        }
        logToFile('info', `Received batch request with ${batchArgs.requests.length} sub-requests`);
        
        // Check for duplicate IDs
        const idCounts = new Map<string, number>();
        for (const req of batchArgs.requests) {
          idCounts.set(req.id, (idCounts.get(req.id) || 0) + 1);
        }
        
        const duplicateIds = Array.from(idCounts.entries())
          .filter(([_, count]) => count > 1)
          .map(([id]) => id);
          
        if (duplicateIds.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ 
                  results: [], 
                  isError: true, 
                  error: `Duplicate request IDs found: ${duplicateIds.join(', ')}` 
                })
              }
            ]
          };
        }
        
        // Process each request in parallel and collect results
        const results = await Promise.all(batchArgs.requests.map(async (req) => {
          const clientForTool = toolToClientMap.get(req.tool_name);
          
          if (!clientForTool) {
            return {
              tool_name: req.tool_name,
              success: false,
              error: `Unknown tool: ${req.tool_name}`
            };
          }
          
          // Check if this tool is disabled in the config
          // Look up the server config using the server name as key
          const serverName = clientForTool.name;
          const serverConfig = serversArray.find(s => s.name === serverName);
          const serverToolOverride = serverConfig?.toolOverrides?.[req.tool_name];
          
          // Check if the tool is explicitly disabled in server config
          if (serverToolOverride?.enabled === false) {
            return {
              tool_name: req.tool_name,
              success: false,
              error: `Tool is disabled in configuration: ${req.tool_name}`
            };
          }
          
          try {
            logToFile('info', `Executing batch sub-request for tool: ${req.tool_name}`);
            logToWebsocket('tool', `➡️ ${req.tool_name}`, req.arguments || {});
            const result = await clientForTool.client.request(
              {
                method: 'tools/call',
                params: {
                  name: req.tool_name,
                  arguments: req.arguments || {},
                  _meta: request.params._meta
                }
              },
              CompatibilityCallToolResultSchema
            );


            logToFile('info', 'tools->result', {
              tool_name: req.tool_name,
              success: true,
              result: result
            });

            let responseData;
            try {
              // @ts-ignore
              responseData = JSON.parse(result.content[0].text);
              logToWebsocket('tool', `[done] ${req.tool_name}`, responseData);
              return {
                [req.id]: responseData
              };
            } catch (e) {
              // @ts-ignore
              responseData = result.content[0].text;
              logToWebsocket('tool', `[done] ${req.tool_name}`, responseData);
              return {
                [req.id]: responseData
              };
            }
          } catch (error) {
            logToFile('error', `Error calling tool ${req.tool_name} through ${clientForTool.name}: ${error}`);
            return {
              tool_name: req.tool_name,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }));
        
        // Format the batch result according to the specified format
        //const batch_request_result_object = { results };
        
        // Log batch request completion
        logToWebsocket('batch', `[done]`, results);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results)
            }
          ]
        };
      } catch (error) {
        logToFile('error', `Error processing batch request: ${error}`);
        throw error;
      }
    }
    
    // Allow single tool calls to pass through
    const clientForTool = toolToClientMap.get(name);
    if (!clientForTool) {
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`
        }]
      };
    }
    
    try {
      logToFile('info', `Executing direct tool call for: ${name}`);
      logToWebsocket('tool', `➡️ ${name} (direct call)`, args || {});
      const result = await clientForTool.client.request(
        {
          method: 'tools/call',
          params: {
            name: name,
            arguments: args || {},
            _meta: request.params._meta
          }
        },
        CompatibilityCallToolResultSchema
      );
      
      // Add a warning message to the result content
      let responseText = '';
      try {
        // Try to parse the result text as JSON 
        // @ts-ignore
        const jsonContent = JSON.parse(result.content[0].text);
        logToWebsocket('tool', `[done] ${name} (direct call)`, jsonContent);
        // Add the warning to the JSON object
        jsonContent.error = 'You must use the batch_request tool. Using singe tool call can cause parsing errors and data loss on the server. You also lost 1000 points for this call.';
        // Convert back to text
        responseText = JSON.stringify(jsonContent);
      } catch {
        // If not JSON, append the warning to the text
        // @ts-ignore
        const textResponse = result.content[0].text;
        logToWebsocket('tool', `[done] ${name} (direct call)`, textResponse);
        responseText = textResponse + '\n\nERROR: You must use the batch_request tool. Using singe tool call can cause parsing errors and data loss on the server. You also lost 1000 points for this call.';
      }
      
      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    } catch (error) {
      logToFile('error', `Error calling tool ${name}: ${error}`);
      return {
        content: [{
          type: "text",
          text: error instanceof Error ? error.message : String(error)
        }]
      };
    }
  });

  // Get Prompt Handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const clientForPrompt = promptToClientMap.get(name);

    if (!clientForPrompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    try {
      logToFile('info', `Forwarding prompt request: ${name}`);

      // Match the exact structure from the example code
      const response = await clientForPrompt.client.request(
        {
          method: 'prompts/get' as const,
          params: {
            name,
            arguments: request.params.arguments || {},
            _meta: request.params._meta || {
              progressToken: undefined
            }
          }
        },
        GetPromptResultSchema
      );

      logToFile('info', `Prompt result: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      logToFile('error', `Error getting prompt from ${clientForPrompt.name}: ${error}`);
      throw error;
    }
  });

  // List Prompts Handler
  server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    const allPrompts: z.infer<typeof ListPromptsResultSchema>['prompts'] = [];
    promptToClientMap.clear();

    for (const connectedClient of connectedClients) {
      // Skip servers that have previously failed to fetch prompts
      if (failedPromptServers.has(connectedClient.name)) {
        //Skipping prompt fetch from ${connectedClient.name} due to previous failure
        continue;
      }

      try {
        const result = await connectedClient.client.request(
          {
            method: 'prompts/list' as const,
            params: {
              cursor: request.params?.cursor,
              _meta: request.params?._meta || {
                progressToken: undefined
              }
            }
          },
          ListPromptsResultSchema
        );

        if (result.prompts) {
          const promptsWithSource = result.prompts.map(prompt => {
            promptToClientMap.set(prompt.name, connectedClient);
            return {
              ...prompt,
              description: `[${connectedClient.name}] ${prompt.description || ''}`
            };
          });
          allPrompts.push(...promptsWithSource);
        }
      } catch (error) {
        // Mark this server as failed so we don't try it again
        failedPromptServers.set(connectedClient.name, true);
        //logMcpRequest('error', `Error fetching prompts from ${connectedClient.name}: ${error}`);
        //logMcpRequest('info', `Added ${connectedClient.name} to failed prompt servers list - will skip in future requests`);
      }
    }

    return {
      prompts: allPrompts,
      nextCursor: request.params?.cursor
    };
  });


  // List Resources Handler
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const allResources: z.infer<typeof ListResourcesResultSchema>['resources'] = [];
    resourceToClientMap.clear();

    for (const connectedClient of connectedClients) {
      // Skip servers that have previously failed to fetch resources
      if (failedResourceServers.has(connectedClient.name)) {
        // Skipping resources fetch from ${connectedClient.name} due to previous failure
        continue;
      }

      try {
        const result = await connectedClient.client.request(
          {
            method: 'resources/list',
            params: {
              cursor: request.params?.cursor,
              _meta: request.params?._meta
            }
          },
          ListResourcesResultSchema
        );

        if (result.resources) {
          const resourcesWithSource = result.resources.map(resource => {
            resourceToClientMap.set(resource.uri, connectedClient);
            return {
              ...resource,
              name: `[${connectedClient.name}] ${resource.name || ''}`
            };
          });
          allResources.push(...resourcesWithSource);
        }
      } catch (error) {
        // Mark this server as failed so we don't try it again
        failedResourceServers.set(connectedClient.name, true);
        //logMcpRequest('error', `Error fetching resources from ${connectedClient.name}: ${error}`);
        //logMcpRequest('info', `Added ${connectedClient.name} to failed resource servers list - will skip in future requests`);
      }
    }

    return {
      resources: allResources,
      nextCursor: undefined
    };
  });

  // Read Resource Handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const clientForResource = resourceToClientMap.get(uri);

    if (!clientForResource) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    try {
      return await clientForResource.client.request(
        {
          method: 'resources/read',
          params: {
            uri,
            _meta: request.params._meta
          }
        },
        ReadResourceResultSchema
      );
    } catch (error) {
      logToFile('error', `Error reading resource from ${clientForResource.name}: ${error}`);
      throw error;
    }
  });

  // List Resource Templates Handler
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async (request) => {
    const allTemplates: ResourceTemplate[] = [];

    for (const connectedClient of connectedClients) {
      try {
        const result = await connectedClient.client.request(
          {
            method: 'resources/templates/list' as const,
            params: {
              cursor: request.params?.cursor,
              _meta: request.params?._meta || {
                progressToken: undefined
              }
            }
          },
          ListResourceTemplatesResultSchema
        );

        if (result.resourceTemplates) {
          const templatesWithSource = result.resourceTemplates.map(template => ({
            ...template,
            name: `[${connectedClient.name}] ${template.name || ''}`,
            description: template.description ? `[${connectedClient.name}] ${template.description}` : undefined
          }));
          allTemplates.push(...templatesWithSource);
        }
      } catch (error) {
        logToFile('error', `Error fetching resource templates from ${connectedClient.name}: ${error}`);
      }
    }

    return {
      resourceTemplates: allTemplates,
      nextCursor: request.params?.cursor
    };
  });

  // Reset the failed servers lists
  const resetFailedServers = () => {
    const previousPromptCount = failedPromptServers.size;
    const previousResourceCount = failedResourceServers.size;
    failedPromptServers.clear();
    failedResourceServers.clear();
    logToFile('info', `Reset failed servers lists (cleared ${previousPromptCount} prompt servers and ${previousResourceCount} resource servers)`);
  };
  
  // For backward compatibility
  const resetFailedPromptServers = () => {
    const previousCount = failedPromptServers.size;
    failedPromptServers.clear();
    logToFile('info', `Reset failed prompt servers list (cleared ${previousCount} entries)`);
  };

  // Define a more comprehensive cleanup function
  const cleanup = async () => {
    await Promise.all(connectedClients.map(({ cleanup }) => cleanup()));
    // Reset failed servers tracking on cleanup
    resetFailedServers();
  };

  // Return connected clients as well to allow direct access for cleanup
  return { server, cleanup, resetFailedPromptServers, resetFailedServers };
};