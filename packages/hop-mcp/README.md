# @hop-org/hop-spec-mcp

MCP server for [HarnessOps](../../README.md) — exposes `hop.json` data to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Tools

| Tool | Description |
|------|-------------|
| `hop_machine` | Get machine identity (id, name, type, OS, arch, agent_root) |
| `hop_list_projects` | List all projects with optional type filter |
| `hop_get_project` | Get full project details by name |
| `hop_get_account` | Get account info by service, optional username filter |
| `hop_list_bundles` | List all bundles (optional project filter) |
| `hop_get_bundle` | Get bundle details with resolved project objects |
| `hop_list_infra_repos` | List infrastructure repo clones with status |
| `hop_list_systems` | List all systems with project and infra repo counts |
| `hop_get_system` | Get all projects and infra repos in a specific system |

## Usage

### With Claude Code

Add to your `.mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hop-mcp": {
      "command": "npx",
      "args": ["-y", "@hop-org/hop-spec-mcp"],
      "env": {
        "HOP_CONFIG_PATH": "/path/to/your/hop.json"
      }
    }
  }
}
```

### With Bun (development)

```bash
HOP_CONFIG_PATH=../../spec/examples/hop-example-vps-server.json bun src/index.ts
```

### Bundled (local install)

```bash
node /path/to/hop-spec/packages/hop-mcp/dist/hop-mcp.bundle.js
```

## Selective Tool Loading

Set `HOP_MCP_TOOLS` to a comma-separated list of tool names to load only those tools. This saves context window space when you only need a subset.

```json
{
  "mcpServers": {
    "hop-mcp": {
      "command": "npx",
      "args": ["-y", "@hop-org/hop-spec-mcp"],
      "env": {
        "HOP_MCP_TOOLS": "hop_machine,hop_list_projects,hop_get_project"
      }
    }
  }
}
```

Omit `HOP_MCP_TOOLS` to load all 9 tools (default, backward compatible).

### Available tool names

`hop_machine`, `hop_list_projects`, `hop_get_project`, `hop_get_account`, `hop_list_bundles`, `hop_get_bundle`, `hop_list_infra_repos`, `hop_list_systems`, `hop_get_system`

## hop.json Discovery

If `HOP_CONFIG_PATH` is not set, the server discovers `hop.json` by:

1. `~/.hop/settings.json` pointer
2. `~/.hop/hop.json` (default location)
3. Walking up from the current working directory
4. Legacy: `~/.config/hop/hop.json`, `/etc/hop/hop.json`

## Development

```bash
bun install
bun run build    # TypeScript compilation
bun run start    # Run the server
```

## Testing

```bash
bun test
```

## Example Tool Outputs

### hop_machine

```json
{
  "config_path": "/home/user/dev/hop.json",
  "schema_version": "0.1.0",
  "machine": {
    "id": "prod-vps",
    "name": "Production VPS Server",
    "type": "cloud-vps",
    "os": "linux",
    "arch": "x64"
  }
}
```

### hop_list_projects

```json
{
  "count": 3,
  "projects": [
    { "name": "api-prod", "path": "/home/deploy/projects/api", "type": "tool", "system": null },
    { "name": "web-prod", "path": "/home/deploy/projects/web", "type": "website", "system": null },
    { "name": "infra-scripts", "path": "/home/deploy/projects/infra", "type": "dev-env", "system": null }
  ]
}
```

### hop_get_project

```json
{
  "name": "api-prod",
  "path": "/home/deploy/projects/api",
  "type": "tool",
  "owner": "myorg",
  "git": {
    "remote_url": "git@github.com:myorg/api.git",
    "default_branch": "main"
  }
}
```

### hop_get_account

```json
{
  "service": "github",
  "count": 2,
  "accounts": [
    { "username": "deploy-bot", "role": "primary", "default": true },
    { "username": "admin-user", "role": "admin", "auth_method": "https-pat" }
  ]
}
```

### hop_list_systems

```json
{
  "count": 2,
  "systems": [
    {
      "system": "payments",
      "project_count": 2,
      "infra_repo_count": 1,
      "projects": [{ "name": "api-core", "path": "/dev/api-core", "type": "tool" }],
      "infra_repos": [{ "name": "payment-sdk", "description": "Third-party SDK", "upstream": null }]
    }
  ]
}
```
