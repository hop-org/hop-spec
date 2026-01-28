# Proposal: Environment Inheritance (`extends`) for hop.json

**Status**: EXPLORE
**Date**: 2026-01-27

---

## Problem Statement

Developers who work across multiple machines (laptop, VPS, cloud IDE) share most of their configuration — same GitHub accounts, same projects, same bundles, same preferences. Only machine-specific fields differ (paths, machine identity, OS/arch).

Today, each machine needs a complete standalone `hop.json`. This means:

1. **Duplication** — accounts, bundles, preferences are copy-pasted
2. **Drift** — adding a project on one machine requires updating all others
3. **Maintenance burden** — N machines = N files to keep in sync

## Precedent: How Other Specs Handle Inheritance

### tsconfig.json (`extends`)
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist" }
}
```
- Single string or array of paths
- Deep merge of `compilerOptions`, shallow merge of top-level fields
- Relative paths resolved from the extending file
- Well-understood, widely adopted

### devcontainer.json (no `extends`, but features)
- No inheritance. Each devcontainer is standalone.
- Composability via `features` (additive, not inherited)
- Each workspace has exactly one devcontainer config

### ESLint flat config (`extends` removed in v9)
- Old: `"extends": ["eslint:recommended", "plugin:react/recommended"]`
- New: Array-based config where you compose by importing and spreading
- Moved away from inheritance toward explicit composition

### Docker Compose (`extends`)
```yaml
services:
  web:
    extends:
      file: common-services.yml
      service: webapp
```
- Service-level inheritance
- Deep merge of most properties
- Some fields cannot be extended (depends_on, volumes)

### Biome (`extends`)
```json
{ "extends": ["./biome.base.json"] }
```
- Array of paths
- Deep merge

### Key Takeaway
`extends` with deep merge is the dominant pattern. ESLint moved away from it, but that was due to plugin resolution complexity — not a problem HarnessOps has.

---

## Proposed Design

### Option A: Simple `extends` (Recommended)

Add an optional `extends` field to the top level of `hop.json`:

```json
{
  "$schema": "https://harnessops.org/schema/v0.1.0/hop.json",
  "schema_version": "0.1.0",
  "extends": "../base-hop.json",
  "machine": {
    "id": "my-vps",
    "name": "Production VPS",
    "type": "cloud-vps",
    "agent_root": "/home/me/dev"
  }
}
```

**Base file** (`base-hop.json`):
```json
{
  "schema_version": "0.1.0",
  "accounts": {
    "github": [
      {
        "username": "myusername",
        "role": "primary",
        "default": true,
        "auth_method": "ssh"
      }
    ]
  },
  "preferences": {
    "timezone": "America/Chicago",
    "branch_patterns": {
      "feature": "feature/${description}"
    }
  },
  "projects": [
    {
      "name": "my-app",
      "type": "tool",
      "owner": "myusername",
      "git": {
        "remote_url": "git@github.com:myusername/my-app.git",
        "default_branch": "main"
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
  ]
}
```

**Machine file** (per-machine `hop.json`):
```json
{
  "extends": "../base-hop.json",
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
      "path": "/Users/me/dev/my-app"
    }
  ]
}
```

### Merge Semantics

| Field | Merge Strategy | Rationale |
|-------|---------------|-----------|
| `schema_version` | Override (child wins) | Child must declare its own version |
| `machine` | Deep merge | Child adds machine-specific fields |
| `accounts` | Deep merge by service key, merge arrays by `username` | Same account, different machines |
| `preferences` | Deep merge | Child can override timezone etc. |
| `projects` | Merge by `name` (match + deep merge) | Child adds `path`, overrides per-machine fields |
| `bundles` | Merge by `id` | Child can override bundle config |
| `extensions` | Deep merge by extension key | Child can override extension settings |
| `scripts` | Shallow merge (child wins per key) | Machine-specific script paths |

**Critical rule**: Projects merge by `name`. If both base and child define `"name": "my-app"`, the entries are deep-merged. The child typically adds `path` (machine-specific) while inheriting `type`, `owner`, `git`, and `extensions` from the base.

### Schema Addition

```json
{
  "extends": {
    "oneOf": [
      {
        "type": "string",
        "description": "Path to a base hop.json to inherit from"
      },
      {
        "type": "array",
        "items": { "type": "string" },
        "description": "Ordered list of base hop.json files (later files override earlier)"
      }
    ]
  }
}
```

### Resolution Rules

1. `extends` paths are resolved relative to the extending file's directory
2. Remote URLs are NOT supported in v0.1.0 (security, offline concerns)
3. Circular extends are an error
4. Maximum chain depth: 5 (prevents runaway resolution)
5. The base file is validated independently before merging
6. After merging, the final result is validated against the schema

---

## Option B: Named Profiles (Alternative)

Instead of file-level inheritance, support inline profiles within a single file:

```json
{
  "schema_version": "0.1.0",
  "profiles": {
    "base": {
      "accounts": { "..." : "..." },
      "projects": [ "..." ]
    },
    "laptop": {
      "extends": "base",
      "machine": { "id": "dev-laptop", "type": "local-laptop" }
    },
    "vps": {
      "extends": "base",
      "machine": { "id": "my-vps", "type": "cloud-vps" }
    }
  },
  "active_profile": "laptop"
}
```

**Pros**: Single file, no resolution issues
**Cons**: File gets large, defeats the purpose of per-machine config, `active_profile` needs a mechanism to select (env var?)

**Recommendation**: Reject. This adds complexity without solving the core problem (each machine should have its own file).

---

## Option C: No Inheritance, Use Tooling

Don't add `extends` to the spec. Instead, provide CLI tooling:

```bash
# Generate a machine-specific hop.json from a base + overrides
hop generate --base ../base-hop.json --machine-id dev-laptop --agent-root /Users/me/dev

# Scaffold a new machine config from an existing one
hop clone --from ../laptop/hop.json --machine-id my-vps --agent-root /home/me/dev
```

**Pros**: Spec stays simple, no merge complexity
**Cons**: Generated files still drift, doesn't solve the maintenance problem

---

## Recommendation

**Option A (Simple `extends`)** is the recommended approach.

### Why

1. **Proven pattern** — tsconfig, Biome, Docker Compose all use it successfully
2. **Solves the real problem** — shared config with per-machine overrides
3. **Minimal spec change** — one new optional field
4. **Backward compatible** — files without `extends` work exactly as before
5. **JSON Schema stays valid** — `extends` is resolved by tools before validation

### Implementation Priority

This should be a **v0.2.0** feature, not v0.1.0. Reasons:

1. v0.1.0 should ship with the minimal spec and prove the concept
2. `extends` adds merge complexity that needs careful specification
3. Tooling (CLI, MCP server) needs to implement resolution
4. Real-world multi-machine usage should inform the design

### Open Questions

1. **Should `extends` support globs?** (e.g., `"extends": "./machines/*.json"`) — Probably not. Keep it simple.
2. **Should projects merge or replace?** Merge-by-name is powerful but has edge cases (what if you want to remove a project from the base?). Consider an explicit `"$remove": true` marker.
3. **Should the MCP server resolve extends?** Yes — the MCP server should expose the fully-resolved config, not the raw file with `extends`.
4. **Should `hop validate` validate the base file too?** Yes, both individually and the merged result.

---

## Use Cases

### Use Case 1: Developer with Laptop + VPS

```
~/dev/hop-base.json          # Shared: accounts, projects (no paths), bundles
~/dev/laptop/hop.json        # extends: ../hop-base.json, adds paths + machine
~/dev/vps/hop.json           # extends: ../hop-base.json, adds paths + machine
```

### Use Case 2: Team Shared Base

```
repo/.harnessops/base.json   # Team defaults: branch patterns, project types
developer/hop.json           # extends: path/to/repo/.harnessops/base.json
```

### Use Case 3: Organization Standards

```
org/standards/hop-base.json  # Org accounts, auth methods, compliance extensions
team/hop.json                # extends: ../standards/hop-base.json, team projects
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| Draft | 2026-01-27 | Initial proposal |
