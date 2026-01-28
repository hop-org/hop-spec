# HarnessOps

> One JSON file. Every AI tool knows your machine.

[![Schema Version](https://img.shields.io/badge/schema-v0.1.0-blue)](spec/hop-schema.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## The Problem

You use Claude Code on your laptop. You spin up a VPS. You switch to a Cloud IDE. Each time: MCP servers need reconfiguring, paths break, plugins fail. You waste time recreating what every tool already needs to know.

## The Solution

One `hop.json` per machine. It describes what the machine is, what projects live on it, and how accounts are configured. Tools read it. Agents understand it.

```json
{
  "schema_version": "0.1.0",
  "machine": {
    "id": "dev-laptop",
    "name": "MacBook Pro",
    "type": "local-laptop",
    "agent_root": "/Users/me/dev"
  },
  "projects": [
    {
      "name": "my-app",
      "path": "/Users/me/dev/my-app",
      "git": { "remote_url": "git@github.com:me/my-app.git" }
    }
  ]
}
```

Only `schema_version` and `machine` (with `id` and `name`) are required. Everything else is opt-in.

---

## Quick Start

```bash
bun install -g @harnessops/cli   # or: npm install -g @harnessops/cli

hop init              # Create ~/.hop/hop.json interactively
hop machine           # Show machine identity
hop projects          # List projects
hop path my-app       # Get a project's filesystem path
hop discover          # Auto-scan for projects in a directory
hop validate          # Check against schema
```

Tools discover `hop.json` automatically:

1. `$HOP_CONFIG_PATH` environment variable (CI / tests / scripts)
2. `~/.hop/hop.json` — the default home, created by `hop init`
3. `~/.hop/settings.json` pointer — redirects to a hop.json stored elsewhere
4. Walk up from current directory
5. Legacy: `~/.config/hop/hop.json`, `/etc/hop/hop.json`

---

## What Goes in hop.json

| Section | Purpose |
|---------|---------|
| `machine` | Identity — id, name, type, OS, arch, agent root |
| `accounts` | GitHub accounts with auth methods (SSH, PAT, OAuth) |
| `projects` | Project registry with paths, git config, extensions |
| `bundles` | Logical groups of projects for workflow switching |
| `systems` | Cross-repo grouping — multiple repos in one logical product |
| `infra_repos` | Infrastructure repo clones — read-only reference copies |
| `preferences` | Timezone, branch naming patterns |
| `extensions` | Machine-scoped tool config (see below) |

### Extensions

Extensions follow the `devcontainer.json` customizations pattern — the core spec doesn't define their contents. Each tool owns its own sub-schema.

**When to add an extension:** Only when an agent can't self-discover the info and would waste time or make mistakes without it. If `which tool` or `--version` gives the agent what it needs, don't add an extension.

Good extensions: beads prefix per project (agent can't guess `api` vs `web`), basic-memory project name routing, agent-mail project keys.

Not extensions: npm version, Docker install path, PostgreSQL host — agents discover these trivially.

Extensions live at two scopes:

**Machine-scoped** (top-level `extensions`):
```json
{ "extensions": { "cass": { "agent_name": "my-agent" } } }
```

**Project-scoped** (`projects[*].extensions`):
```json
{ "extensions": { "beads": { "prefix": "api", "sync_branch": "beads-sync" } } }
```

### Systems

A **system** groups multiple repos (projects and infra clones) that cooperate to deliver one capability. Inspired by [Backstage's System Model](https://backstage.io/docs/features/software-catalog/system-model/).

Add `system` to any project or infra repo entry:

```json
{
  "projects": [
    { "name": "api-core", "system": "payments", "path": "/dev/api-core" },
    { "name": "api-gateway", "system": "payments", "path": "/dev/api-gateway" }
  ],
  "infra_repos": {
    "repos": [
      { "name": "payment-sdk", "system": "payments", "description": "Third-party SDK" },
      "unrelated-tool"
    ]
  }
}
```

Query systems with the CLI:
```bash
hop system list          # All systems with project/infra counts
hop system show payments # All repos in the "payments" system
hop projects -s payments # Filter projects by system
```

**System vs Bundle vs Project:**

| Concept | Purpose | Scope |
|---------|---------|-------|
| **Project** | A single repo on disk | One repo |
| **System** | Logical product grouping — repos that ship together | Cross-repo (projects + infra) |
| **Bundle** | Workflow grouping — what you work on together | Ad-hoc project sets |

Systems are about **architecture** ("these repos form the payments system"). Bundles are about **workflow** ("I work on these repos together today"). A bundle can span systems; a system can span bundles.

---

## Tooling

| Package | Purpose |
|---------|---------|
| [`@harnessops/core`](packages/hop-core/) | Shared library — types, discovery, validation |
| [`@harnessops/cli`](packages/hop-cli/) | CLI — `hop init`, `hop discover`, `hop projects`, `hop bundle`, etc. |
| [`@harnessops/mcp`](packages/hop-mcp/) | MCP server — `hop_machine`, `hop_list_projects`, `hop_get_project`, `hop_get_account`, `hop_list_bundles`, `hop_get_bundle`, `hop_list_infra_repos`, `hop_list_systems`, `hop_get_system` |

---

## Specification

| Document | Description |
|----------|-------------|
| [hop-schema.json](spec/hop-schema.json) | JSON Schema (Draft 2020-12) |
| [field-requirements.md](spec/field-requirements.md) | Required vs optional fields |
| [validation-rules.md](spec/validation-rules.md) | Semantic validation rules |
| [Examples](spec/examples/) | Minimal, local-dev, cloud-ide, vps-server |
| [Templates](templates/) | Copy-and-customize starters |
| [Getting Started](docs/getting-started.md) | Step-by-step guide |

---

## The `~/.hop/` Directory

HarnessOps stores its configuration in `~/.hop/`:

```
~/.hop/
├── hop.json          # The main machine configuration
└── settings.json     # Optional: pointer to hop.json if stored elsewhere
```

`hop init` creates this directory and writes `hop.json` into it. If you keep your `hop.json` in a non-default location (e.g., a dotfiles repo), use `hop config set-path <path>` to write a `settings.json` pointer.

---

## Relationship to Other Standards

| Standard | How HarnessOps Differs |
|----------|------------------------|
| **devcontainer.json** | Broader — not container-specific, covers any machine |
| **MCP** | HarnessOps describes *where* things are; MCP is the protocol |
| **AGENTS.md** | Agent instructions vs machine configuration |
| **.tool-versions** | Complements version managers, doesn't replace them |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and the RFC process.

---

## License

MIT — see [LICENSE](LICENSE).
