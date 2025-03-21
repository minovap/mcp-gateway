# MCP Gateway

An MCP gateway that aggregates multiple MCP resource servers through a single interface.

## Features

- **MCP Proxy**: A single endpoint for accessing multiple MCP servers
- **Batch Request Tool**: Optimized parallel execution for multiple tool calls
- **Configuration Merging**: Works with Claude desktop configuration

## Quick Setup

```bash
npm install @thinkware/mcp-gateway

# Create a config file
cp node_modules/@thinkware/mcp-gateway/config.example.json config.json

# Edit the config.json to add your MCP servers
```

## Configuration Paths

The gateway looks for configuration files in the following order:

1. **Environment variable:** `MCP_CONFIG_PATH` if set
2. **Claude desktop config:** 
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`
3. **Default:** `config.json` in current directory

## Config Merging with Claude

The gateway can read the `proxyBatchMcpServers` section from your Claude desktop config:

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "npx",
      "args": [
        "-y",
        "@thinkware/mcp-gateway"
      ]
    }
  },
  "proxyBatchMcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/path/to/other/allowed/dir"
      ],
      "toolOverrides": {
        "read_file": {
          "enabled": true,
          "description": "Read complete contents of a file\nInput: path (string)\nReads complete file contents with UTF-8 encoding"
        },
        "read_multiple_files": {
          "enabled": false
        }
      }
    },
    "server-1": {
      "command": "/path/to/server1/build/index.js",
      "toolOverrides": {
        "some_tool": {
          "enabled": true,
          "description": "Custom description"
        }
      }
    }
  }
}
```

## Server Configuration Options

| Option | Type | Description | Required |
|--------|------|-------------|----------|
| `command` | string | Path to server executable | Yes (for command servers) |
| `args` | string[] | Command arguments | No |
| `env` | object | Environment variables | No |
| `url` | string | SSE endpoint URL | Yes (for SSE servers) |
| `toolOverrides` | object | Tool customization | No |

### Tool Override Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `enabled` | boolean | Enable/disable tool | `true` |
| `description` | string | Custom tool description | Original description |
| `disabled` | boolean | Disable entire tool | `false` |

## Environment Variables

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "npx",
      "args": [
        "-y",
        "@thinkware/mcp-gateway"
      ],
      "env": {
        "MCP_GATEWAY_LOG_FILE": "/path/to/logs/mcp-gateway.log"
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Development with auto-rebuild
npm run dev

# Build
npm run build
```
