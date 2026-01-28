# @harnessops/mcp

MCP server for [HarnessOps](../../README.md) — exposes `hop.json` data to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Tools

| Tool | Description |
|------|-------------|
| `hop_machine` | Get machine identity (id, name, type, OS, arch, agent_root) |
| `hop_list_projects` | List all projects with optional type filter |
| `hop_get_project` | Get full project details by name |
| `hop_get_account` | Get account info by service, optional username filter |

## Usage

### With Claude Code

Add to your `claude_desktop_config.json` or project MCP settings:

```json
{
  "mcpServers": {
    "harnessops": {
      "command": "npx",
      "args": ["-y", "@harnessops/mcp"],
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

### hop.json Discovery

If `HOP_CONFIG_PATH` is not set, the server discovers `hop.json` by:

1. Walking up from the current working directory
2. Checking `~/.config/hop/hop.json`
3. Checking `/etc/hop/hop.json`

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
    { "name": "api-prod", "path": "/home/deploy/projects/api", "type": "tool" },
    { "name": "web-prod", "path": "/home/deploy/projects/web", "type": "website" },
    { "name": "infra-scripts", "path": "/home/deploy/projects/infra", "type": "dev-env" }
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
