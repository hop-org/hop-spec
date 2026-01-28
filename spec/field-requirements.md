# HarnessOps Field Requirements Specification

**Version**: 0.1.0

---

## Purpose

This document defines which fields in the HarnessOps schema are **required** vs **optional**, provides rationale for each decision, and specifies default values where applicable.

---

## Design Principles

1. **Minimal Required Set**: Only fields essential for HarnessOps to function are required
2. **Progressive Enhancement**: Optional fields add capabilities without breaking basic use cases
3. **Sensible Defaults**: Optional fields have clear defaults when omitted
4. **Machine Portability**: Required fields enable machine identification and synchronization
5. **Extensions Over Core**: Tool-specific configuration belongs in `extensions`, not in the core schema

---

## Top-Level Fields

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `$schema` | Optional | *none* | Enables editor validation; not required for runtime |
| `schema_version` | **Required** | - | Ensures compatibility across HarnessOps versions |
| `description` | Optional | `""` | Human documentation; not needed for machine parsing |
| `machine` | **Required** | - | Core identity; HarnessOps exists to describe machines |
| `accounts` | Optional | `{}` | Not all machines need account management |
| `preferences` | Optional | `{}` | Defaults to system/user settings |
| `cross_project` | Optional | `null` | Only needed for multi-project workflows |
| `projects` | Optional | `[]` | Minimal HarnessOps can describe machine without projects |
| `bundles` | Optional | `[]` | Workflow organization; not needed for simple setups |
| `infra_repos` | Optional | `null` | Infrastructure repo clones for reference |
| `scripts` | Optional | `{}` | Path references for advanced workflows |
| `extensions` | Optional | `{}` | Machine-scoped tool extensions (see Extensions section) |

### Rationale Summary

- **`schema_version` required**: Without version, parsers cannot know what schema to validate against. Essential for forward compatibility.
- **`machine` required**: The fundamental purpose of HarnessOps is to describe a machine. Without `machine`, there's no context for the rest of the configuration.
- **Tool-specific fields removed from core**: BEADS, Basic Memory, Fireflies, NTM, ClickUp, and CLI activity logs now live under `extensions` — either at machine scope (top-level `extensions`) or project scope (`projects[*].extensions`). Note: `infra_repos` is a first-class top-level field (not an extension) because agents need it for discovery scan roots.

---

## Machine Object

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `id` | **Required** | - | Unique identifier for cross-machine sync |
| `name` | **Required** | - | Human-readable label for UI/logs |
| `type` | Optional | `"unknown"` | Classification helpful but not essential |
| `agent_root` | Optional | *varies* | Critical for agents, but can be discovered |
| `os` | Optional | *auto-detect* | Can be derived from environment |
| `arch` | Optional | *auto-detect* | Can be derived from environment |

### Machine Type Enum Values

```
cloud-vps     # Cloud VPS (DigitalOcean, Linode, etc.)
cloud-vm      # Cloud IDE VM (Codespaces, Gitpod, etc.)
local-desktop # Local desktop machine
local-laptop  # Local laptop
container     # Docker/container environment
wsl           # Windows Subsystem for Linux
unknown       # Default when type not specified
```

---

## Accounts Object

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `github` | Optional | `[]` | Only if GitHub used |
| *(additional)* | Optional | `[]` | Extensible for any service |

### GitHub Account Fields

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `username` | **Required** | - | Primary identifier for the account |
| `role` | Optional | `"default"` | Classification (primary/personal/work) |
| `default` | Optional | `false` | Flag for default account selection |
| `git_alias` | Optional | *username* | Short form for branch naming |
| `auth_method` | Optional | `"ssh"` | Most common auth method |
| `pat_bws_id` | Optional | `null` | Only for HTTPS-PAT auth |
| `active` | Optional | `true` | Assume active unless disabled |
| `note` | Optional | `""` | Documentation field |

---

## Preferences Object

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `timezone` | Optional | `"UTC"` | System default or UTC fallback |
| `timezone_abbreviation` | Optional | *derived* | Can be computed from timezone |
| `branch_patterns` | Optional | `{}` | Only for standardized branching |

### Branch Patterns Fields

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `feature` | Optional | `"feature/${description}"` | Simple default pattern |
| `description` | Optional | `""` | Documentation |
| *(additional)* | Optional | - | Extensible for custom patterns |

---

## Projects Array

Each project entry:

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `name` | **Required** | - | Unique identifier within this HarnessOps |
| `path` | Optional* | `null` | *Required in practice for most tools |
| `type` | Optional | `"project"` | Classification; not required for operation |
| `owner` | Optional | `null` | GitHub org/user; only for git projects |
| `description` | Optional | `""` | Human documentation |
| `git` | Optional | `null` | Only for git-tracked projects |
| `account_override` | Optional | `null` | Only for non-default account |
| `branch_checkouts` | Optional | `null` | IDE-specific (Cloud IDE multi-branch) |
| `note` | Optional | `""` | Documentation |
| `extensions` | Optional | `{}` | Project-scoped tool extensions |

### Project Type Values (Observed)

```
dev-env         # Development environment/tooling
marketplace     # Plugin/extension marketplace
tool            # CLI tools and utilities
research        # Research projects
central         # Cross-repo central directory
commercial      # Business development
website         # Web presence
social          # Social media assets
marketing       # Marketing content
home            # Cross-repo hub
project         # Generic default
```

---

## Git Config (Nested in Project)

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `remote_url` | Optional | `null` | Can be discovered from `.git/config` |
| `default_branch` | Optional | `"main"` | Modern git default |

---

## Bundles Array

Each bundle entry:

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `id` | **Required** | - | Unique identifier for bundle reference |
| `name` | **Required** | - | Human-readable name for UI |
| `projects` | **Required** | - | Must have at least one project |
| `description` | Optional | `""` | Documentation |
| `primary_project` | Optional | *first project* | First project in array if not specified |

---

## Infra Repos Object

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `path` | Optional* | `null` | *Required in practice — directory for clones |
| `readonly` | Optional | `true` | Most infra clones are read-only references |
| `sync` | Optional | `"manual"` | Sync strategy (manual, weekly-cron-pull, etc.) |
| `contribute` | Optional | `null` | Contribution policy for upstream repos |
| `contribute.allowed` | Optional | `false` | Whether PRs back to upstream are permitted |
| `contribute.requires_flags` | Optional | `[]` | Conditions before contributing |
| `repos` | Optional | `[]` | List of repo directory names within path |

---

## Cross-Project Object

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `home_project` | Optional | `null` | Name of hub project |
| `artifacts_path` | Optional | `null` | Path for shared artifacts |
| `description` | Optional | `""` | Documentation |

---

## Extensions Namespace

Extensions provide tool-specific configuration at both machine and project scope. The core HarnessOps schema does not define or validate extension contents — each tool author owns their own sub-schema.

### Extension Entry Fields (Convention)

| Field | Required | Default | Rationale |
|-------|----------|---------|-----------|
| `$schema` | Optional | `null` | URI to tool-specific JSON Schema for validation |
| `enabled` | Optional | `true` | Convention: extensions SHOULD support an enabled flag |
| *(additional)* | Optional | - | Tool-defined; HarnessOps does not constrain |

### Extension Key Format

Extension keys must be lowercase slugs: `^[a-z0-9][a-z0-9_-]*[a-z0-9]$`

Examples: `beads`, `basic-memory`, `fireflies`, `ntm`, `cli-activity-logs`, `clickup`

Note: `infra_repos` is a first-class top-level field, not an extension. The discover system uses `infra_repos.path` as a secondary scan root. Legacy `extensions.infra-repos` is still supported as a fallback.

### Machine-Scoped Extensions (top-level `extensions`)

Used for machine-wide tool configurations that are not project-specific.

```json
{
  "extensions": {
    "cli-activity-logs": { "enabled": true, "output_root": "/logs" },
    "fireflies": { "enabled": true, "api_url": "https://api.fireflies.ai/graphql" },
    "ntm": { "enabled": true, "path": "/tmp/sessions" },
    "infra-repos": { "enabled": true, "path": "/clones", "repos": ["configs"] }
  }
}
```

### Project-Scoped Extensions (`projects[*].extensions`)

Used for per-project tool configurations.

```json
{
  "projects": [{
    "name": "my-app",
    "extensions": {
      "beads": { "enabled": true, "prefix": "app" },
      "basic-memory": { "enabled": true, "project_name": "my-app" }
    }
  }]
}
```

---

## Summary: Required Fields

### Absolute Requirements (Schema Validation Fails Without)

| Path | Field | Type |
|------|-------|------|
| `/` | `schema_version` | string |
| `/` | `machine` | object |
| `/machine` | `id` | string |
| `/machine` | `name` | string |
| `/projects[*]` | `name` | string |
| `/bundles[*]` | `id` | string |
| `/bundles[*]` | `name` | string |
| `/bundles[*]` | `projects` | array (min 1) |
| `/accounts/github[*]` | `username` | string |

### Practical Requirements (Most Tools Expect)

| Path | Field | Practical Use |
|------|-------|---------------|
| `/machine` | `agent_root` | Agent tools need a root directory |
| `/projects[*]` | `path` | Most tools need filesystem location |
| `/bundles[*]` | `primary_project` | Bundle selection needs a default |

---

## Minimal Valid HarnessOps

```json
{
  "schema_version": "0.1.0",
  "machine": {
    "id": "my-machine",
    "name": "My Development Machine"
  }
}
```

## Typical HarnessOps (With Projects)

```json
{
  "schema_version": "0.1.0",
  "machine": {
    "id": "my-machine",
    "name": "My Development Machine",
    "type": "local-laptop",
    "agent_root": "/Users/me/dev"
  },
  "projects": [
    {
      "name": "my-project",
      "path": "/Users/me/dev/my-project",
      "type": "tool"
    }
  ]
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-23 | Initial field requirements specification |
| 0.1.0 | 2026-01-27 | Refactored: moved BEADS, Basic Memory, NTM, Fireflies, ClickUp, CLI activity logs to extensions namespace |
| 0.1.0 | 2026-01-27 | Promoted infra_repos to first-class top-level field with $defs/infraRepos schema, CLI command, and MCP tool |
