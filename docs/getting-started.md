# Getting Started with HarnessOps

This guide walks you through creating and using your first HarnessOps configuration.

---

## Prerequisites

- A development machine (local, VPS, or cloud IDE)
- Basic familiarity with JSON
- [Bun](https://bun.sh/) 1.0+ or Node.js 18+ (for CLI and MCP server)
- (Optional) A text editor with JSON Schema support

---

## Step 1: Install the CLI

```bash
bun install -g @harnessops/cli   # or: npm install -g @harnessops/cli
```

Or use without installing:

```bash
bunx @harnessops/cli init   # or: npx @harnessops/cli init
```

## Step 2: Create Your First hop.json

The fastest way is with the CLI:

```bash
hop init
```

This walks you through creating `~/.hop/hop.json` interactively. The `~/.hop/` directory is the canonical home for HarnessOps configuration.

### Minimal Configuration

Start with the absolute minimum:

```json
{
  "schema_version": "0.1.0",
  "machine": {
    "id": "my-machine",
    "name": "My Development Machine"
  }
}
```

**Required fields:**
- `schema_version` - Always `"0.1.0"` for current spec
- `machine.id` - Unique identifier (lowercase, hyphens allowed)
- `machine.name` - Human-readable name

### Add Machine Details

Expand with optional but useful fields:

```json
{
  "schema_version": "0.1.0",
  "machine": {
    "id": "my-laptop",
    "name": "MacBook Pro Development",
    "type": "local-laptop",
    "agent_root": "/Users/me/dev",
    "os": "darwin",
    "arch": "arm64"
  }
}
```

**Machine types:**
- `local-laptop` - Personal laptop
- `local-desktop` - Desktop workstation
- `cloud-vps` - Cloud VPS (DigitalOcean, Linode, etc.)
- `cloud-vm` - Cloud IDE (Cloud IDE, Gitpod, Codespaces)
- `container` - Docker container
- `wsl` - Windows Subsystem for Linux

---

## Step 3: Add Your Projects

You can auto-discover projects on your machine:

```bash
hop discover ~/dev --json
```

This scans for git repos and project markers, outputting hop.json-compatible entries you can paste into your config.

### Basic Project

```json
{
  "schema_version": "0.1.0",
  "machine": { ... },
  "projects": [
    {
      "name": "my-app",
      "path": "/Users/me/dev/my-app",
      "type": "tool",
      "description": "My main application"
    }
  ]
}
```

### Project with Git

```json
{
  "name": "my-app",
  "path": "/Users/me/dev/my-app",
  "type": "tool",
  "owner": "myusername",
  "description": "My main application",
  "git": {
    "remote_url": "git@github.com:myusername/my-app.git",
    "default_branch": "main"
  }
}
```

### Project with BEADS

Enable issue tracking:

```json
{
  "name": "my-app",
  "path": "/Users/me/dev/my-app",
  "extensions": {
    "beads": {
      "enabled": true,
      "database_path": "/Users/me/dev/my-app/.beads/",
      "prefix": "app"
    }
  }
}
```

### Project with Basic Memory

Enable MCP knowledge management:

```json
{
  "name": "my-app",
  "path": "/Users/me/dev/my-app",
  "extensions": {
    "basic-memory": {
      "enabled": true,
      "project_name": "my-app",
      "root_path": "/Users/me/dev/my-app/.memory/"
    }
  }
}
```

---

## Step 4: Configure Accounts

### Single GitHub Account

```json
{
  "accounts": {
    "github": [
      {
        "username": "myusername",
        "role": "primary",
        "default": true,
        "auth_method": "ssh",
        "active": true
      }
    ]
  }
}
```

### Multiple Accounts

Useful for separating personal and work:

```json
{
  "accounts": {
    "github": [
      {
        "username": "personal-me",
        "role": "primary",
        "default": true,
        "git_alias": "me",
        "auth_method": "ssh"
      },
      {
        "username": "work-account",
        "role": "work",
        "default": false,
        "git_alias": "work",
        "auth_method": "https-pat",
        "pat_bws_id": "uuid-from-bitwarden-secrets"
      }
    ]
  }
}
```

### Using Account Overrides

In a project, specify a non-default account:

```json
{
  "name": "work-project",
  "path": "/Users/me/dev/work-project",
  "account_override": "work-account"
}
```

---

## Step 5: Group Repos into Systems

If multiple repos cooperate to deliver one product, give them the same `system` identifier:

```json
{
  "projects": [
    { "name": "api-core", "system": "payments", "path": "/dev/api-core", "type": "tool" },
    { "name": "api-gateway", "system": "payments", "path": "/dev/api-gateway", "type": "tool" },
    { "name": "dashboard", "system": "analytics", "path": "/dev/dashboard", "type": "website" }
  ]
}
```

You can also tag infra repo clones with a system:

```json
{
  "infra_repos": {
    "path": "/dev/clones",
    "repos": [
      { "name": "payment-sdk", "system": "payments", "description": "Third-party payment SDK" },
      "generic-tool"
    ]
  }
}
```

Query with:
```bash
hop system list              # All systems
hop system show payments     # All repos in a system
hop projects --system payments   # Filter projects
```

**System vs Bundle:** Systems are about architecture ("these repos *are* the payments product"). Bundles are about workflow ("I *work on* these repos together"). Use both — they serve different purposes.

---

## Step 6: Organize with Bundles

Group related projects:

```json
{
  "bundles": [
    {
      "id": "personal",
      "name": "Personal Projects",
      "description": "My open source and hobby projects",
      "projects": ["my-app", "my-library", "experiments"],
      "primary_project": "my-app"
    },
    {
      "id": "client-work",
      "name": "Client Projects",
      "description": "Billable client work",
      "projects": ["client-api", "client-web"],
      "primary_project": "client-api"
    }
  ]
}
```

**Bundle benefits:**
- Quick context switching
- Logical grouping for workflows
- Primary project selection

---

## Step 7: Set Preferences

### Timezone

```json
{
  "preferences": {
    "timezone": "America/Chicago",
    "timezone_abbreviation": "CT"
  }
}
```

### Branch Naming Patterns

```json
{
  "preferences": {
    "branch_patterns": {
      "feature": "feature/${description}",
      "bugfix": "bugfix/${description}",
      "hotfix": "hotfix/${date}-${description}",
      "description": "Use kebab-case for description"
    }
  }
}
```

---

## Step 8: Register Infrastructure Repo Clones

If you clone external repos for reference (reading source code, checking APIs, building tools from source), register them:

```json
{
  "infra_repos": {
    "path": "/Users/me/tool-clones",
    "readonly": true,
    "sync": "weekly-cron-pull",
    "contribute": {
      "allowed": true,
      "requires_flags": ["fork-first", "explicit-pr-approval"]
    },
    "repos": ["some-cli-tool", "agent-framework", "config-templates"]
  }
}
```

**Fields:**
- `path` — Directory containing your clones
- `readonly` — Whether clones are read-only (default: `true`)
- `sync` — How you keep clones updated (`manual`, `weekly-cron-pull`, etc.)
- `contribute` — Policy for contributing back to upstream
- `repos` — List of repo directory names

AI agents use this to discover reference repos on your machine without scanning the entire filesystem.

---

## Step 9: Track AI CLI Activity

### Configure Log Harvesting

```json
{
  "extensions": {
    "cli-activity-logs": {
      "enabled": true,
      "output_root": "/Users/me/dev/.cli-logs",
      "machine_id": "my-laptop",
      "clis": [
        {
          "name": "claude_code",
          "display_name": "Claude Code",
          "enabled": true,
          "storage_locations": [
            {
              "path": "/Users/me/.claude/projects",
              "type": "projects_dir",
              "pattern": "*.jsonl"
            }
          ],
          "output": {
            "subdir": "claude-code",
            "filename_prefix": "claude_sessions"
          }
        }
      ]
    }
  }
}
```

**Supported CLIs:**
- `claude_code` - Anthropic Claude Code
- `codex_cli` - OpenAI Codex CLI
- `gemini_cli` - Google Gemini CLI
- `opencode_cli` - OpenCode CLI

---

## Step 10: Validate Your Configuration

### Using the CLI

```bash
hop validate
```

This validates your discovered `hop.json` against the HarnessOps JSON Schema, with detailed error messages for any issues.

### Using JSON Schema in Your Editor

Add the `$schema` reference for IDE support (autocomplete, inline validation):

```json
{
  "$schema": "https://harnessops.org/schema/v0.1.0/hop.json",
  "schema_version": "0.1.0",
  ...
}
```

### Alternative: Direct Schema Validation

```bash
# Using ajv-cli
npm install -g ajv-cli
ajv validate -s hop-schema.json -d hop.json
```

### Common Validation Errors

| Error | Fix |
|-------|-----|
| Missing `schema_version` | Add `"schema_version": "0.1.0"` |
| Missing `machine.id` | Add a unique identifier |
| Duplicate project names | Each project needs a unique name |
| Invalid bundle reference | Ensure project exists in projects array |

---

## Step 11: Query Your Configuration

Use the CLI to query your hop.json:

```bash
# List all projects
hop projects

# Get a project path (scriptable)
cd $(hop path my-app)

# Show machine info
hop machine

# Show default GitHub account
hop account

# Find your hop.json location
hop where

# All commands support --json for machine-readable output
hop projects --json
hop machine --json
```

### CLI `--json` Output Format

**Important**: CLI `--json` output differs from the hop.json file structure.

Collection commands (`projects`, `bundles`) return **bare arrays**:

```bash
# CLI output: bare array
hop projects --json
# → [{name: "my-app", ...}, {name: "my-lib", ...}]

hop bundles --json
# → [{id: "default", ...}]

# hop.json FILE: wrapped in named keys
jq '.projects' ~/.hop/hop.json
# → [{name: "my-app", ...}]  (same array, but accessed via .projects key)
```

When scripting, use `.[]` to iterate CLI output, not `.projects[]`:

```bash
# ✅ Correct: bare array from CLI
hop projects --json | jq -r '.[].name'

# ❌ Wrong: .projects[] fails on CLI output (bare array has no "projects" key)
hop projects --json | jq -r '.projects[].name'

# ✅ Correct: .projects[] when reading the file directly
jq -r '.projects[].name' ~/.hop/hop.json
```

Singleton commands (`machine`, `account`) return **objects**:

```bash
hop machine --json
# → {id: "my-machine", name: "My Dev Machine", ...}
```

---

## Step 12: Set Up the MCP Server

The HarnessOps MCP server lets AI agents (Claude Code, etc.) query your hop.json automatically.

### Install

```bash
bun install -g @harnessops/mcp   # or: npm install -g @harnessops/mcp
```

### Configure in Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "harnessops": {
      "command": "harnessops-mcp",
      "env": {
        "HOP_CONFIG_PATH": "/path/to/your/hop.json"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `hop_machine` | Get machine identity (id, name, type, OS, arch) |
| `hop_list_projects` | List all projects with optional type filter |
| `hop_get_project` | Get full project details by name |
| `hop_get_account` | Get account info by service and username |
| `hop_list_bundles` | List all bundles with project names |
| `hop_get_bundle` | Get bundle details with resolved project objects |
| `hop_list_infra_repos` | List infrastructure repo clones |
| `hop_list_systems` | List all systems with their projects and infra repos |
| `hop_get_system` | Get all repos in a specific system |

AI agents can now query your machine configuration, find project paths, and resolve accounts — without you manually providing context.

---

## Step 13: Multi-Machine Sync

### Same Developer, Multiple Machines

Create a `hop.json` on each machine with:
- **Same** account configuration
- **Same** project names
- **Different** machine.id
- **Different** paths (machine-specific)

### Example: Laptop + VPS

**Laptop:**
```json
{
  "machine": { "id": "my-laptop", ... },
  "projects": [
    { "name": "my-app", "path": "/Users/me/dev/my-app" }
  ]
}
```

**VPS:**
```json
{
  "machine": { "id": "my-vps", ... },
  "projects": [
    { "name": "my-app", "path": "/home/me/dev/my-app" }
  ]
}
```

Tools can now find `my-app` on either machine by name.

---

## Complete Example

Here's a complete, production-ready `hop.json`:

```json
{
  "$schema": "https://harnessops.org/schema/v0.1.0/hop.json",
  "schema_version": "0.1.0",
  "description": "HarnessOps Registry - Development Laptop",

  "machine": {
    "id": "dev-laptop",
    "name": "MacBook Pro Development",
    "type": "local-laptop",
    "agent_root": "/Users/me/dev",
    "os": "darwin",
    "arch": "arm64"
  },

  "accounts": {
    "github": [
      {
        "username": "myusername",
        "role": "primary",
        "default": true,
        "git_alias": "me",
        "auth_method": "ssh",
        "active": true
      }
    ]
  },

  "preferences": {
    "timezone": "America/New_York",
    "timezone_abbreviation": "ET",
    "branch_patterns": {
      "feature": "feature/${description}",
      "bugfix": "bugfix/${description}"
    }
  },

  "projects": [
    {
      "name": "my-app",
      "path": "/Users/me/dev/my-app",
      "type": "tool",
      "owner": "myusername",
      "description": "Main application",
      "git": {
        "remote_url": "git@github.com:myusername/my-app.git",
        "default_branch": "main"
      },
      "extensions": {
        "beads": {
          "enabled": true,
          "database_path": "/Users/me/dev/my-app/.beads/",
          "prefix": "app"
        }
      }
    }
  ],

  "bundles": [
    {
      "id": "default",
      "name": "Default Bundle",
      "projects": ["my-app"],
      "primary_project": "my-app"
    }
  ],

  "extensions": {
    "cli-activity-logs": {
      "enabled": true,
      "output_root": "/Users/me/dev/.cli-logs",
      "machine_id": "dev-laptop",
      "clis": [
        {
          "name": "claude_code",
          "display_name": "Claude Code",
          "enabled": true,
          "storage_locations": [
            {
              "path": "/Users/me/.claude/projects",
              "pattern": "*.jsonl"
            }
          ]
        }
      ]
    }
  }
}
```

---

## Next Steps

1. **Explore examples** - See [spec/examples/](../spec/examples/) for more configurations
2. **Read the spec** - Check [field-requirements.md](../spec/field-requirements.md) for all fields
3. **Validate your config** - Run `hop validate` to catch issues early
4. **Set up the MCP server** - Give your AI agents machine awareness
5. **Discover projects** - Run `hop discover ~/dev --json` to bootstrap your projects list

---

## Troubleshooting

### "Project not found"

- Check that `projects[].name` is unique
- Verify `projects[].path` exists on disk
- Ensure project is not in a bundle with invalid references

### "Account not found"

- Verify `accounts.github[].username` matches exactly
- Check `account_override` spelling in project

### "Invalid schema version"

- Must be semver format: `"0.1.0"` or `"0.1"`
- Current version is `"0.1.0"`

### "Duplicate machine.id"

- Each machine needs a unique ID
- Consider adding a suffix for similar machines

---

*Need help? Open an issue on the [HarnessOps spec repository](https://github.com/hop-spec/hop-spec/issues).*
