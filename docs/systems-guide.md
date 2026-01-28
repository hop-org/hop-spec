# Systems Guide

> How to think about systems, bundles, and projects in HarnessOps.

---

## The Three Levels

HarnessOps organizes work at three levels:

| Level | What it represents | Example |
|-------|-------------------|---------|
| **Project** | A single repository on disk | `api-core` |
| **System** | A logical product/capability — repos that ship together | `payments` (includes api-core, api-gateway, payment-sdk) |
| **Bundle** | A workflow grouping — repos you work on together | `morning-work` (includes api-core, dashboard, docs) |

### Project

The atomic unit. One repo, one path, one git remote. Every project has a unique name (slug).

### System

Groups repos that cooperate to deliver **one capability**. Inspired by [Backstage's System Model](https://backstage.io/docs/features/software-catalog/system-model/).

A system:
- Spans both **projects** (your repos) and **infra repos** (reference clones)
- Is identified by a lowercase slug on each entry: `"system": "payments"`
- Describes **architecture** — what belongs to the payments product?

Use system when:
- Multiple repos deploy together or share a release cycle
- You want to ask "what repos make up the analytics product?"
- A new team member needs to understand the product architecture

### Bundle

Groups projects for **workflow convenience**. Ad-hoc, human-defined.

A bundle:
- Lists project names in an array
- Has a `primary_project` for default context
- Describes **workflow** — what do I work on today?

Use bundle when:
- You want a quick-switch context for your IDE or agent
- You have cross-system work (fixing a bug that touches payments + analytics)
- The grouping is personal preference, not architecture

---

## When to Use System vs Bundle

| Question | Use |
|----------|-----|
| "What repos make up the payments product?" | **System** |
| "What should I work on today?" | **Bundle** |
| "Which repos need to be deployed together?" | **System** |
| "Group my personal projects vs work projects" | **Bundle** |
| "What infra repos are related to this product?" | **System** (spans infra_repos too) |
| "Which repos does the new dev need to clone?" | **System** |

### Can They Overlap?

Yes. A bundle can contain projects from multiple systems. A system's projects can appear in multiple bundles. They're orthogonal concepts.

```
System "payments":  [api-core, api-gateway] + infra: [payment-sdk]
System "analytics": [dashboard, data-pipeline]
Bundle "morning":   [api-core, dashboard]  ← spans two systems
Bundle "deploy":    [api-core, api-gateway] ← one system
```

---

## System Field Format

- **Type:** Optional string on projects and infra repo objects
- **Pattern:** `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (lowercase slug)
- **Examples:** `payments`, `agent-flywheel`, `brand`, `uap`

### On Projects

```json
{
  "name": "api-core",
  "system": "payments",
  "path": "/dev/api-core"
}
```

### On Infra Repos

Infra repos support two formats — string (simple) or object (with metadata):

```json
{
  "infra_repos": {
    "repos": [
      "simple-repo",
      {
        "name": "payment-sdk",
        "system": "payments",
        "description": "Third-party payment SDK",
        "upstream": "https://github.com/example/payment-sdk.git"
      }
    ]
  }
}
```

---

## Querying Systems

### CLI

```bash
hop system list              # All systems with counts
hop system show payments     # Projects + infra repos in a system
hop system show payments --json  # Machine-readable
hop projects --system payments   # Filter project list
```

### MCP (for AI agents)

```
hop_list_systems {}                     → all systems with projects + infra
hop_get_system { name: "payments" }     → full details for one system
hop_list_projects { type: "uap" }       → projects include system field
```

### jq (raw config)

```bash
# All projects in a system
jq '.projects[] | select(.system == "payments")' ~/.hop/hop.json

# All infra repos in a system
jq '.infra_repos.repos[] | select(type == "object" and .system == "payments")' ~/.hop/hop.json

# Unique system names
jq '[.projects[].system // empty] | unique' ~/.hop/hop.json
```

---

## For AI Agents

When an agent encounters a project with a `system` field:

1. **Context expansion** — Query `hop_get_system` to understand related repos
2. **Cross-repo awareness** — Changes to `api-core` might affect `api-gateway` (same system)
3. **Infra discovery** — Reference clones in the same system contain relevant source code
4. **Architecture understanding** — System membership reveals product boundaries

When deciding whether to check related repos:
- Same system → likely relevant, check for impacts
- Same bundle → working together but may be unrelated architecturally
- Neither → probably unrelated
