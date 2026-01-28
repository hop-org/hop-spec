# Extension Registry Proposal: How Tool Authors Publish hop.json Extension Specs

**Task**: hopr-3ii
**Status**: DESIGN PROPOSAL
**Date**: 2026-01-27
**Depends on**: [extension-registry-models.md](./extension-registry-models.md) (research)

---

## Executive Summary

This proposal defines the complete lifecycle for how tool authors create, publish, and register hop.json extensions. It follows the **decentralized self-declaration** model recommended by our registry research: tools own their schemas in their own repos, and hop.json provides conventions, a base schema, and an optional discovery index.

The design is phased: Phase 1 (v0.1.0) ships with conventions only. Phase 2 adds an optional index. Phase 3 adds CLI-assisted discovery.

---

## Design Principles

1. **Tool authors own their schemas.** The hop-spec repo does not define, review, or gate extension contents.
2. **No central approval.** Any tool can declare a hop.json extension by following the naming convention. No PR to hop-spec required.
3. **Progressive complexity.** Phase 1 requires zero infrastructure. Authors just document their extension key and fields.
4. **Schema-first validation.** Extensions that publish a JSON Schema get editor autocomplete, `hop validate` checks, and CI integration for free.
5. **Follow proven patterns.** The `devcontainer.json` customizations model and SchemaStore's catalog approach are the primary precedents.
6. **Only non-discoverable config.** Extensions should only contain information an agent can't figure out on its own. The litmus test: *"Would an agent waste time or make mistakes without this?"* If yes, it belongs. If the agent can run `which tool` or `--version` and get the answer in 2 seconds, it doesn't belong in hop.json. This keeps extensions lean and high-signal.

---

## Phase 1: Conventions (v0.1.0)

Phase 1 ships with the current spec. No schema changes needed. Tool authors follow these conventions.

### Extension Key Naming

Extension keys MUST follow these rules:

| Rule | Valid | Invalid |
|------|-------|---------|
| Lowercase alphanumeric + hyphens/underscores | `beads`, `basic-memory`, `cli-activity-logs` | `Beads`, `BasicMemory`, `CLI_Logs` |
| Match package/tool name | `beads` (for the Beads tool) | `task-tracker` (if tool is called Beads) |
| No vendor prefix for single-product tools | `beads` | `mycompany-beads` |
| Vendor prefix for multi-product companies | `google-gemini`, `anthropic-claude` | `gemini` (too generic) |
| Minimum 2 chars, maximum 64 chars | `go` | `a`, `my-really-long-extension-name-that-...` |
| Regex: `^[a-z0-9][a-z0-9_-]*[a-z0-9]$\|^[a-z0-9]$` | (already in schema) | |

**Conflict resolution**: First-come, first-served in the optional index (Phase 2). For Phase 1, tool authors are responsible for choosing non-conflicting names. The naming convention makes collisions unlikely (use your tool's actual name).

### What Tool Authors Do (Phase 1)

A tool author wanting to integrate with hop.json does three things:

#### Step 1: Define the extension schema

Create a JSON Schema file in your repo that describes your extension's configuration shape:

```
your-tool/
  schemas/
    hop-extension.schema.json    # JSON Schema for your hop.json extension
```

Example (`hop-extension.schema.json`):
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-tool.dev/schemas/v1/hop-extension.json",
  "title": "YourTool hop.json Extension",
  "description": "Configuration for YourTool in hop.json",
  "type": "object",
  "properties": {
    "enabled": {
      "type": "boolean",
      "default": true,
      "description": "Enable/disable this extension"
    },
    "api_endpoint": {
      "type": "string",
      "format": "uri",
      "description": "Custom API endpoint URL"
    },
    "sync_interval": {
      "type": "integer",
      "minimum": 30,
      "description": "Sync interval in seconds"
    }
  },
  "required": [],
  "additionalProperties": true
}
```

**Schema requirements:**
- MUST be valid JSON Schema Draft 2020-12
- MUST include `$id` with a stable, versioned URI
- MUST include `title` and `description`
- SHOULD include `enabled` (boolean, default true) per hop.json convention
- SHOULD use `additionalProperties: true` for forward compatibility
- MUST NOT require properties that the tool can default itself

**Schema hosting:** Host the schema at the `$id` URI. Options:
- GitHub Pages (free, common)
- Raw GitHub URL (works but less stable across renames)
- Your project's docs site
- Any CDN or static host

#### Step 2: Document the extension in your README

Add a section to your tool's README showing how users add the extension to hop.json:

```markdown
## hop.json Integration

Add to your `hop.json` at the appropriate scope:

**Machine-scoped** (global config):
```json
{
  "extensions": {
    "your-tool": {
      "$schema": "https://your-tool.dev/schemas/v1/hop-extension.json",
      "enabled": true,
      "api_endpoint": "https://api.your-tool.dev"
    }
  }
}
```

**Project-scoped** (per-project config):
```json
{
  "projects": [{
    "name": "my-app",
    "extensions": {
      "your-tool": {
        "$schema": "https://your-tool.dev/schemas/v1/hop-extension.json",
        "enabled": true,
        "sync_interval": 60
      }
    }
  }]
}
```
```

#### Step 3: (Optional) Read hop.json at runtime

If your tool wants to read its own configuration from hop.json, use the discovery chain:

```
1. $HOP_CONFIG_PATH environment variable
2. Walk up from current directory looking for hop.json
3. ~/.config/hop/hop.json
4. /etc/hop/hop.json
```

Or use the `@harnessops/core` library:

```typescript
import { loadConfig } from '@harnessops/core';

const config = await loadConfig();
const myExtension = config?.extensions?.['your-tool'];
// or per-project:
const projectExt = config?.projects
  ?.find(p => p.name === 'my-app')
  ?.extensions?.['your-tool'];
```

### Extension Scoping Rules

Extensions can appear at two scopes:

| Scope | Location in hop.json | Use case |
|-------|---------------------|----------|
| **Machine** | `extensions.your-tool` | Global settings: API endpoints, credentials refs, install paths |
| **Project** | `projects[].extensions.your-tool` | Per-project settings: prefixes, workspace paths, feature flags |

**Merge behavior** (when both scopes exist): Tool authors define their own merge strategy. The recommendation is project-scoped values override machine-scoped values (shallow merge). The `@harnessops/core` library will provide a helper:

```typescript
import { resolveExtension } from '@harnessops/core';

// Returns merged config: machine defaults + project overrides
const config = resolveExtension(hopConfig, 'your-tool', 'my-app');
```

### Validation Behavior

The `hop validate` command handles extensions as follows:

1. **Structural validation**: Always runs. Checks that extension keys match the naming pattern and values are objects.
2. **Schema validation**: If an extension entry has a `$schema` property, fetch and validate the entry against that schema. Report errors as warnings (not failures) if the schema URL is unreachable.
3. **No validation**: If no `$schema` is present, the entry passes structural validation only. This is fine — not all extensions need schemas.

```
$ hop validate
✓ Schema version valid (0.1.0)
✓ Machine section valid
✓ 3 projects valid
✓ Extension "beads" valid (schema: https://beads-project.org/schema/v1/hop-extension.json)
⚠ Extension "my-internal-tool" has no $schema — skipping deep validation
✓ hop.json is valid
```

---

## Phase 2: Discovery Index (v0.2.0+)

When the ecosystem grows beyond ~10 extensions, add an optional discovery index. This is a **phone book**, not a code registry.

### Index Structure

```
hop-spec/
  registry/
    index.json              # Machine-readable catalog
    extensions/
      beads.md              # Human-readable docs per extension
      basic-memory.md
      claude-code.md
```

### index.json Format

```json
{
  "$schema": "https://harnessops.dev/schemas/v1/extension-index.json",
  "version": "1",
  "updated": "2026-01-27T00:00:00Z",
  "extensions": {
    "beads": {
      "name": "Beads Task Tracking",
      "description": "Lightweight issue tracking with bead files",
      "repo": "https://github.com/org/beads",
      "schema_url": "https://beads-project.org/schema/v1/hop-extension.json",
      "scopes": ["project", "machine"],
      "homepage": "https://beads-project.org",
      "keywords": ["tasks", "issues", "tracking"],
      "maintainers": ["@beads-maintainer"]
    },
    "basic-memory": {
      "name": "Basic Memory",
      "description": "Knowledge management for AI agents",
      "repo": "https://github.com/org/basic-memory",
      "schema_url": "https://basic-memory.dev/schemas/hop-extension.json",
      "scopes": ["project"],
      "homepage": "https://basic-memory.dev",
      "keywords": ["memory", "knowledge", "agents"],
      "maintainers": ["@basic-memory-team"]
    }
  }
}
```

**Required fields**: `name`, `description`, `repo`, `scopes`
**Optional fields**: `schema_url`, `homepage`, `keywords`, `maintainers`

### Submission Process

To add an extension to the index:

1. Fork `hop-spec`
2. Add your entry to `registry/index.json`
3. Add a `registry/extensions/your-tool.md` with:
   - Extension name and description
   - Supported scopes (machine, project, or both)
   - Example configuration
   - Link to schema and docs
4. Open a PR

**Review criteria** (intentionally minimal):
- Extension key follows naming convention
- Key doesn't collide with an existing entry
- Repo URL is valid and public
- Schema URL (if provided) returns valid JSON Schema
- Markdown doc exists and is non-empty

This is NOT a code review. No approval of the extension's design or implementation.

### Index Schema

The index itself has a JSON Schema for validation:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://harnessops.dev/schemas/v1/extension-index.json",
  "title": "HarnessOps Extension Index",
  "type": "object",
  "required": ["version", "extensions"],
  "properties": {
    "version": { "type": "string", "const": "1" },
    "updated": { "type": "string", "format": "date-time" },
    "extensions": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["name", "description", "repo", "scopes"],
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string", "maxLength": 200 },
          "repo": { "type": "string", "format": "uri" },
          "schema_url": { "type": "string", "format": "uri" },
          "scopes": {
            "type": "array",
            "items": { "enum": ["machine", "project"] },
            "minItems": 1
          },
          "homepage": { "type": "string", "format": "uri" },
          "keywords": {
            "type": "array",
            "items": { "type": "string" },
            "maxItems": 10
          },
          "maintainers": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## Phase 3: CLI Discovery (v0.3.0+)

If the ecosystem warrants it, add CLI commands for extension discovery:

```bash
# Search the index
hop extensions search "task tracking"
# Output:
#   beads — Lightweight issue tracking with bead files
#   clickup — ClickUp project management integration

# Show extension details
hop extensions info beads
# Output:
#   Name: Beads Task Tracking
#   Repo: https://github.com/org/beads
#   Schema: https://beads-project.org/schema/v1/hop-extension.json
#   Scopes: project, machine
#
#   Example:
#   {
#     "extensions": {
#       "beads": { "enabled": true, "prefix": "app" }
#     }
#   }

# Add an extension to hop.json (interactive)
hop extensions add beads
# Output:
#   Adding "beads" extension to hop.json...
#   ? Scope: (project / machine) project
#   ? Project: my-app
#   ? prefix: app
#   ✓ Added beads extension to project "my-app"
```

### Schema Auto-Fetch

The `hop validate` command can optionally fetch schemas from the index:

```bash
# Validate with remote schema resolution
hop validate --fetch-schemas

# This does:
# 1. For each extension with $schema → fetch and validate against it
# 2. For each extension WITHOUT $schema → look up in index.json, use schema_url if found
# 3. Report results
```

---

## Comparison to Prior Art

| Feature | hop.json (proposed) | devcontainer.json | SchemaStore | Terraform Registry |
|---------|-------------------|-------------------|-------------|-------------------|
| Schema ownership | Tool author's repo | Feature author's repo | SchemaStore repo or external | Provider author's repo |
| Central approval | No (Phase 1), minimal (Phase 2) | No (self-published OCI) | Yes (PR review) | Yes (GitHub release + signing) |
| Distribution | JSON Schema via URL | OCI registry tarball | JSON Schema via URL | GitHub releases |
| Discovery | README (Phase 1), index (Phase 2), CLI (Phase 3) | `devcontainers/features` index | SchemaStore catalog.json | registry.terraform.io |
| Versioning | URI-based (`/v1/`, `/v2/`) | Semver via OCI tags | N/A (latest) | Semver via Git tags |
| Validation | `$schema` property | Built into devcontainer CLI | Editor integration | `terraform validate` |

**Key difference from devcontainer features**: Devcontainer features are executable (install scripts + Dockerfile fragments). Hop.json extensions are declarative only (JSON configuration). This makes the model simpler — no OCI packaging, no install lifecycle, no security review needed.

**Key difference from SchemaStore**: SchemaStore catalogs schemas for file formats. Hop's index catalogs schemas for extension namespaces within a single file format. SchemaStore is a possible future integration point (list hop.json in SchemaStore's catalog.json).

---

## Implementation Checklist

### Phase 1 (v0.1.0) — Convention Only

- [ ] Write `EXTENSIONS.md` guide for tool authors (this document distilled)
- [ ] Add extension authoring section to docs/getting-started.md
- [ ] Implement `$schema` validation in `hop validate` (fetch + validate)
- [ ] Add `resolveExtension()` helper to `@harnessops/core`
- [ ] Create example extension schema in `spec/examples/extension-schema-example.json`
- [ ] Document merge behavior (project overrides machine) in spec

### Phase 2 (v0.2.0+) — Discovery Index

- [ ] Create `registry/index.json` with seed extensions (beads, basic-memory, etc.)
- [ ] Create `extension-index.schema.json` for index validation
- [ ] Add PR template for extension submissions
- [ ] Set up CI to validate index.json on PR
- [ ] Write `registry/extensions/*.md` docs for seed extensions

### Phase 3 (v0.3.0+) — CLI Discovery

- [ ] Implement `hop extensions search` command
- [ ] Implement `hop extensions info` command
- [ ] Implement `hop extensions add` command (interactive)
- [ ] Add `--fetch-schemas` flag to `hop validate`
- [ ] Consider SchemaStore integration (add hop.json to catalog.json)

---

## Open Questions

1. **Should extension schemas be cached locally?** Probably yes — `~/.cache/hop/schemas/` with TTL-based expiry. Avoids network calls on every `hop validate`.

2. **Should we define a "well-known" extensions list?** A small set of extension keys (beads, basic-memory, claude-code, codex, gemini-cli) could be documented in the spec as "known" without implying endorsement. This helps discoverability before the index exists.

3. **What about private/internal extensions?** Extensions that aren't in the index still work — they just don't get CLI discovery. Private schema URLs work fine. No changes needed.

4. **Should extension schemas support JSON Schema `$ref` to hop.json types?** Yes — extension schemas should be able to reference hop.json's `$defs` (e.g., `$ref: "https://harnessops.dev/schemas/v1/hop.json#/$defs/gitConfig"`). This enables schema composition.

5. **Version negotiation?** If an extension schema introduces breaking changes, the URI-based versioning (`/v1/`, `/v2/`) handles it. The `$schema` property in hop.json points to the exact version the user configured against.

---

## Recommendation

Ship Phase 1 with v0.1.0. The conventions and `$schema` support are already in the spec. What's needed is:

1. An **EXTENSIONS.md** guide that walks tool authors through the three steps
2. `$schema` validation in `hop validate`
3. A `resolveExtension()` helper in `@harnessops/core`

Phase 2 and 3 are post-v0.1.0 and should be driven by actual ecosystem adoption. Don't build the index until there are >5 extensions that would benefit from it.

---

*Proposal based on research in [extension-registry-models.md](./extension-registry-models.md). See that document for detailed analysis of DefinitelyTyped, Terraform Registry, K8s CRDs, devcontainer features, ESLint plugins, SchemaStore, and other ecosystems.*
