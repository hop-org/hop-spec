---
name: hop-operate
description: Query and manage HarnessOps (hop.json) machine configuration via CLI or MCP tools. Use when you need machine context, project paths, account info, bundle groupings, infra repos, or system topology.
version: 1.0.0
---

# HarnessOps Operation Skill

> Query your machine's identity, projects, accounts, bundles, infra repos, and systems — via CLI or MCP.

---

## When to Use This Skill

Use HOP when you need to:
- **Find a project path** — `hop path <name>` or `hop_get_project`
- **Discover what's on this machine** — `hop machine`, `hop projects`
- **Look up accounts** — `hop account` or `hop_get_account`
- **Navigate multi-repo systems** — `hop system show <name>`
- **Check infra reference repos** — `hop infra`
- **Find project groupings** — `hop bundles` or `hop bundle <id>`
- **Validate configuration** — `hop validate`
- **Bootstrap a new machine** — `hop init` or `hop discover`

---

## Quick Reference

### CLI Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `hop machine` | Machine identity (id, name, type, OS, arch) | `hop machine --json` |
| `hop projects` | List all projects | `hop projects --system fv-ops` |
| `hop path <name>` | Resolve project path (scriptable) | `cd $(hop path my-app)` |
| `hop account [user]` | GitHub account info | `hop account --json` |
| `hop bundles` | List project bundles | `hop bundles --json` |
| `hop bundle <id>` | Bundle detail with member projects | `hop bundle content-pipeline` |
| `hop infra` | Infra repo clones and status | `hop infra --json` |
| `hop system list` | All systems with counts | `hop system list --json` |
| `hop system show <n>` | Projects + infra repos in a system | `hop system show fv-ops` |
| `hop validate [file]` | Validate hop.json against schema | `hop validate ~/hop.json` |
| `hop discover [dir]` | Auto-scan directory for projects | `hop discover ~/dev --json` |
| `hop init` | Create new hop.json interactively | `hop init -o ~/.hop/hop.json` |
| `hop where` | Show discovered hop.json path | `hop where` |
| `hop config show` | Show config and discovery path | `hop config show` |
| `hop config set-path` | Pin hop.json location | `hop config set-path ~/.hop/hop.json` |

### MCP Tools

| Tool | Purpose |
|------|---------|
| `hop_machine` | Machine identity and config path |
| `hop_list_projects` | List projects (optional `type` filter) |
| `hop_get_project` | Full project details by name |
| `hop_get_account` | Account info by service + optional username |
| `hop_list_bundles` | List bundles (optional `project` filter) |
| `hop_get_bundle` | Bundle detail with resolved projects |
| `hop_list_infra_repos` | Infra repo clones with status |
| `hop_list_systems` | All systems with project/infra counts |
| `hop_get_system` | Full details for one system |

---

## Common Patterns

### 1. Navigate to a Project

```bash
# CLI — resolve path and cd
cd $(hop path my-project)

# In scripts
PROJECT_PATH=$(hop path my-project 2>/dev/null)
if [ -z "$PROJECT_PATH" ]; then
  echo "Project not found"
  exit 1
fi
```

### 2. Discover Machine Context on First Run

When starting work on an unfamiliar machine:

```bash
# What machine is this?
hop machine

# What projects are here?
hop projects

# What systems group them?
hop system list

# What infra repos are cloned?
hop infra
```

Or via MCP (single call):
```
hop_machine → get machine identity
hop_list_projects → see everything available
```

### 3. Find Projects in a System

Systems group repos that cooperate to deliver one capability:

```bash
# List all systems
hop system list

# Show a specific system (projects + infra repos)
hop system show fv-ops

# JSON for programmatic use
hop system show fv-ops --json | jq '.projects[].path'
```

### 4. Work with Bundles

Bundles are curated project groupings for workflows:

```bash
# List all bundles
hop bundles

# Get bundle members with paths
hop bundle content-pipeline --json | jq '.resolved_projects[]'

# Find which bundles contain a project
# (MCP only)
hop_list_bundles { project: "my-app" }
```

### 5. Check Git Account for a Project

```bash
# Default account
hop account

# Specific account
hop account my-work-username --json
```

### 6. Filter Projects by Type

```bash
# Only websites
hop projects --type website

# Only tools
hop projects --type tool --json
```

### 7. Validate Before Committing

```bash
# Validate current hop.json
hop validate

# Validate a specific file
hop validate ./templates/vps.hop.json
```

### 8. Bootstrap a New Machine

```bash
# Auto-scan and generate project entries
hop discover ~/dev --json > discovered.json

# Interactive init
hop init -o ~/.hop/hop.json

# Or non-interactive with defaults
hop init -y -o ~/.hop/hop.json
```

---

## Configuration Discovery

HOP searches for `hop.json` in this order:

1. **`~/.hop/settings.json`** → `hop_config` field (pinned path)
2. **`$HOP_CONFIG_PATH`** environment variable
3. **`~/.hop/hop.json`** (default location)
4. **Parent directory walk** from current directory

Pin a specific location:
```bash
hop config set-path /path/to/hop.json
```

---

## MCP Server Setup

Add to your MCP client config (e.g., Claude Code `settings.json`):

```json
{
  "mcpServers": {
    "harnessops": {
      "command": "npx",
      "args": ["-y", "@harnessops/mcp"]
    }
  }
}
```

Or if installed locally:
```json
{
  "mcpServers": {
    "harnessops": {
      "command": "node",
      "args": ["/path/to/hop-spec/packages/hop-mcp/dist/index.js"]
    }
  }
}
```

The MCP server discovers `hop.json` using the same resolution order as the CLI.

---

## Schema Reference

Top-level `hop.json` fields:

| Field | Required | Description |
|-------|----------|-------------|
| `schema_version` | ✅ | Schema version (e.g., `"0.1.0"`) |
| `machine` | ✅ | Machine identity (`id`, `name` required; `type`, `os`, `arch`, `agent_root` optional) |
| `projects` | — | Array of project definitions (name, path, type, git, system, extensions) |
| `accounts` | — | Service accounts (e.g., `github: [{ username, role, auth_method }]`) |
| `bundles` | — | Logical project groupings (id, name, projects[], primary_project) |
| `infra_repos` | — | Infrastructure repo clones (path, repos[], readonly, sync, contribute) |
| `preferences` | — | User/machine preferences (editor, shell, theme) |
| `scripts` | — | Named scripts for common operations |
| `cross_project` | — | Cross-project configuration (shared settings) |
| `extensions` | — | Extension point for tools (e.g., `extensions.beads`) |
| `description` | — | Human-readable machine description |

### Project Fields

```json
{
  "name": "my-app",           // Required: unique slug
  "path": "/home/user/my-app", // Filesystem path
  "type": "website",          // Project type
  "system": "my-platform",    // System grouping
  "git": {
    "remote_url": "git@github.com:user/my-app.git",
    "default_branch": "main"
  },
  "extensions": {}            // Tool-specific config
}
```

### Infra Repo Entries

Repos can be strings or objects:
```json
{
  "infra_repos": {
    "path": "/home/user/infra-clones",
    "repos": [
      "simple-repo-name",
      {
        "name": "detailed-repo",
        "system": "my-platform",
        "description": "What this repo is for",
        "upstream": "https://github.com/org/repo"
      }
    ]
  }
}
```

---

## Tips

- **Use `--json` for scripting** — all CLI commands support JSON output
- **`hop path` is your friend** — pipe it to `cd`, `ls`, `git` for quick navigation
- **Systems > Bundles** for multi-repo projects — systems are semantic (what belongs together), bundles are workflow (what you work on together)
- **MCP tools return errors gracefully** — they include `available_*` lists when a lookup fails
- **Validate early** — run `hop validate` after editing hop.json to catch schema issues
