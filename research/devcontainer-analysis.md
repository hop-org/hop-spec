# devcontainer.json Analysis for HOP Spec

---

## Executive Summary

`devcontainer.json` is a mature specification for configuring development containers, widely adopted through VS Code's Remote Containers extension and GitHub Codespaces. While HOP and devcontainer.json address different layers of the development environment stack, there are several patterns HOP can borrow.

**Key Insight**: devcontainer.json describes *how to bootstrap a container*. HOP describes *where things live on an already-running machine*. They are complementary, not competing.

---

## 1. Specification Overview

### What devcontainer.json Is

A JSON file that tells tools how to:
- Create or access a development container
- Configure the container's tooling and runtime stack
- Set up lifecycle hooks for container events
- Forward ports and manage environment variables

### Official Specification

- **URL**: https://containers.dev/implementors/json_reference/
- **Schema**: https://github.com/devcontainers/spec/blob/main/schemas/devContainer.base.schema.json
- **Governance**: Open specification under containers.dev

### Adoption

| Platform | Support Level |
|----------|--------------|
| VS Code Remote - Containers | Full native support |
| GitHub Codespaces | Full native support |
| JetBrains IDEs | Plugin support |
| Docker Desktop | Integration |
| Devcontainer CLI | Reference implementation |
| Cloud IDEs (Gitpod, Cloud IDE) | Compatible implementations |

---

## 2. Specification Structure

### 2.1 General Properties

Core configuration that applies regardless of container source:

```json
{
  "name": "My Dev Container",
  "forwardPorts": [3000, "db:5432"],
  "portsAttributes": {
    "3000": { "label": "Application port" }
  },
  "containerEnv": {
    "MY_VAR": "${localEnv:MY_VAR}"
  },
  "remoteEnv": {
    "PATH": "${containerEnv:PATH}:/custom/path"
  },
  "remoteUser": "vscode",
  "features": {
    "ghcr.io/devcontainers/features/github-cli": {}
  },
  "customizations": {
    "vscode": {
      "extensions": ["ms-python.python"]
    }
  }
}
```

### 2.2 Image/Dockerfile Properties

For container creation from images:

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  // OR
  "build": {
    "dockerfile": "Dockerfile",
    "context": "..",
    "args": { "VARIANT": "22.04" },
    "target": "development"
  },
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspace,type=bind",
  "workspaceFolder": "/workspace",
  "runArgs": ["--cap-add=SYS_PTRACE"]
}
```

### 2.3 Docker Compose Properties

For multi-container orchestration:

```json
{
  "dockerComposeFile": ["docker-compose.yml", "docker-compose.dev.yml"],
  "service": "app",
  "runServices": ["app", "db"],
  "workspaceFolder": "/workspace"
}
```

### 2.4 Lifecycle Scripts

Ordered execution hooks:

| Hook | When | Where |
|------|------|-------|
| `initializeCommand` | During initialization | Host machine |
| `onCreateCommand` | After container creation | Inside container |
| `updateContentCommand` | After onCreateCommand | Inside container |
| `postCreateCommand` | After user assignment | Inside container |
| `postStartCommand` | Each container start | Inside container |
| `postAttachCommand` | Each tool attachment | Inside container |

Example:
```json
{
  "initializeCommand": "npm install",
  "onCreateCommand": "pip install -r requirements.txt",
  "postCreateCommand": ["git", "config", "--global", "user.name", "${localEnv:GIT_USER}"],
  "postStartCommand": {
    "server": "npm start",
    "db": ["mysql", "-u", "root"]
  }
}
```

### 2.5 Host Requirements

Resource constraints:

```json
{
  "hostRequirements": {
    "cpus": 4,
    "memory": "8gb",
    "storage": "32gb",
    "gpu": true
  }
}
```

### 2.6 Variables

Supported variable interpolation:

| Variable | Description |
|----------|-------------|
| `${localEnv:VAR}` | Host environment variable |
| `${containerEnv:VAR}` | Container environment variable |
| `${localWorkspaceFolder}` | Host workspace path |
| `${containerWorkspaceFolder}` | Container workspace path |
| `${devcontainerId}` | Unique container identifier |

---

## 3. What HOP Can Borrow

### 3.1 Variables Syntax ✅ RECOMMENDED

**devcontainer.json pattern**:
```json
"MY_VAR": "${localEnv:HOST_VAR}"
```

**HOP could adopt** for dynamic path resolution:
```json
{
  "machine": {
    "agent_root": "${localEnv:DEV_ROOT:-/home/user/dev}"
  }
}
```

**Benefit**: Allows HOP configs to reference environment variables, making them more portable.

---

### 3.2 Tool-Specific Customizations ✅ RECOMMENDED

**devcontainer.json pattern**:
```json
{
  "customizations": {
    "vscode": { ... },
    "codespaces": { ... },
    "jetbrains": { ... }
  }
}
```

**HOP could adopt** for harness-specific settings:
```json
{
  "customizations": {
    "claude_code": {
      "max_context_tokens": 100000,
      "auto_compact": true
    },
    "cursor": {
      "rules_path": ".cursorrules"
    }
  }
}
```

**Benefit**: Single config file can support multiple tools without conflicts.

---

### 3.3 Host Requirements Pattern ⚠️ CONSIDER

**devcontainer.json pattern**:
```json
{
  "hostRequirements": {
    "cpus": 4,
    "memory": "8gb"
  }
}
```

**HOP could adopt** for agent workload hints:
```json
{
  "machine": {
    "capabilities": {
      "memory": "16gb",
      "gpu": true,
      "recommended_for": ["heavy_compute", "multi_agent_swarms"]
    }
  }
}
```

**Benefit**: Agents could make intelligent decisions about task distribution.

---

### 3.4 Lifecycle Hooks ⚠️ CONSIDER

**devcontainer.json pattern**:
```json
{
  "postCreateCommand": "npm install",
  "postStartCommand": "echo 'Ready'"
}
```

**HOP could adopt** for session lifecycle:
```json
{
  "lifecycle": {
    "on_session_start": "hop-validate && hop-sync-context",
    "on_project_activate": "./scripts/setup-env.sh"
  }
}
```

**Benefit**: Automated setup when switching contexts or starting sessions.

---

### 3.5 Schema Versioning ✅ ALREADY ADOPTED

**devcontainer.json pattern**:
```json
{
  "$schema": "https://raw.githubusercontent.com/devcontainers/spec/main/schemas/devContainer.schema.json"
}
```

**HOP already does**:
```json
{
  "$schema": "https://hop-spec.org/schema/v2.0/hop.json",
  "schema_version": "2.0"
}
```

**Status**: HOP already follows this pattern correctly.

---

## 4. What HOP Does Differently

### 4.1 Machine Identity (HOP-Only)

devcontainer.json doesn't track which machine a config belongs to. HOP's `machine` object provides:
- Unique machine identifier
- Human-readable name
- Machine type classification
- OS and architecture info

### 4.2 Project Mapping (HOP-Only)

devcontainer.json handles one workspace at a time. HOP handles:
- Multiple projects with consistent names
- Machine-specific paths per project
- Cross-environment project discovery

### 4.3 Account Configuration (HOP-Only)

devcontainer.json doesn't handle multi-account scenarios. HOP provides:
- Multiple GitHub accounts per machine
- Auth method configuration
- Account overrides per project

### 4.4 Bundles (HOP-Only)

devcontainer.json has no concept of grouping related projects. HOP bundles enable:
- Logical project grouping
- Context switching
- Primary project designation

### 4.5 Integration Configuration (HOP-Only)

devcontainer.json focuses on container setup. HOP configures:
- BEADS (issue tracking)
- Basic Memory (knowledge management)
- CLI activity logging

---

## 5. Relationship Model

```
┌─────────────────────────────────────────────────────────┐
│                    DEVELOPMENT STACK                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  devcontainer.json                                      │
│  ├─ Bootstraps container environment                    │
│  ├─ Installs dependencies                               │
│  ├─ Configures ports, extensions                        │
│  └─ Runs lifecycle scripts                              │
│                                                         │
│           ↓ Container is running                        │
│                                                         │
│  hop.json                                               │
│  ├─ Identifies this machine                             │
│  ├─ Maps project locations                              │
│  ├─ Configures accounts                                 │
│  └─ Sets up agent tooling                               │
│                                                         │
│           ↓ Machine is configured                       │
│                                                         │
│  CLAUDE.md / .cursorrules / AGENT.md                    │
│  ├─ Project-specific instructions                       │
│  └─ AI behavior customization                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: devcontainer.json and HOP operate at different layers. They can coexist:
- devcontainer.json sets up the container
- HOP tells tools where things are once the container is running

---

## 6. Recommendations for HOP Spec

### High Priority

1. **Add variable interpolation** - Borrow `${localEnv:VAR}` syntax for dynamic values
2. **Add customizations block** - Enable tool-specific settings without conflicts

### Medium Priority

3. **Consider lifecycle hooks** - `on_session_start`, `on_project_activate` could be useful
4. **Document coexistence** - Clarify how HOP and devcontainer.json work together

### Low Priority

5. **Consider host requirements** - Could help with multi-machine task distribution
6. **Feature parity tracking** - Monitor devcontainer.json evolution for relevant patterns

---

## 7. Sources

1. **Dev Container Specification**: https://containers.dev/implementors/json_reference/
2. **VS Code Documentation**: https://code.visualstudio.com/docs/devcontainers/containers
3. **GitHub Codespaces**: https://docs.github.com/en/codespaces
4. **Schema**: https://github.com/devcontainers/spec/blob/main/schemas/devContainer.base.schema.json
