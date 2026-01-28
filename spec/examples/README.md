# HarnessOps Example Configurations

This directory contains example `hop.json` files for common scenarios. Use these as starting points for your own HarnessOps configuration.

---

## Examples Overview

| File | Description | Complexity | Best For |
|------|-------------|------------|----------|
| `hop-example-minimal.json` | Bare minimum valid HarnessOps | Minimal | Learning, testing |
| `hop-example-local-dev.json` | Local developer machine | Medium | Laptop/desktop development |
| `hop-example-cloud-ide.json` | Cloud IDE environment | Medium | Cloud IDE, Gitpod, Codespaces |
| `hop-example-vps-server.json` | VPS/cloud server | Full | Production/deployment servers |

---

## 1. hop-example-minimal.json

**The simplest valid HarnessOps configuration.**

```json
{
  "$schema": "https://harnessops.org/schema/v0.1.0/hop.json",
  "schema_version": "0.1.0",
  "machine": {
    "id": "my-machine",
    "name": "My Development Machine"
  }
}
```

**Use when:**
- Learning HarnessOps basics
- Testing HarnessOps tooling
- Starting from scratch and adding incrementally

---

## 2. hop-example-local-dev.json

**Configuration for a local developer machine (laptop/desktop).**

**Use when:**
- Setting up WSL, macOS, or Linux development
- Working with personal and work projects
- Using multiple GitHub accounts

**Features shown:**
- Multiple GitHub accounts (personal + work)
- SSH and HTTPS-PAT authentication
- Account override per project
- BEADS issue tracking
- Basic Memory integration
- Project bundles
- CLI activity log harvesting

---

## 3. hop-example-cloud-ide.json

**Configuration for cloud-based development environments.**

**Use when:**
- Using Gitpod, GitHub Codespaces, or similar
- Working with ephemeral/disposable environments

**Features shown:**
- Cloud VM machine type
- GitHub CLI authentication
- Branch checkout directories
- Multiple CLI activity trackers

---

## 4. hop-example-vps-server.json

**Comprehensive configuration for a production VPS/server.**

**Use when:**
- Setting up a deployment server
- Managing production infrastructure
- Running AI agents on a server

**Features shown:**
- Full machine configuration
- Service accounts (deploy + admin)
- Infrastructure repo clones (read-only)
- Ephemeral session storage
- CLI activity tracking with validation timestamps

---

## Customization Guide

### Adding a New Project

```json
{
  "name": "my-project",
  "path": "/path/to/project",
  "type": "tool",
  "description": "What this project does",
  "git": {
    "remote_url": "git@github.com:my-org/my-project.git",
    "default_branch": "main"
  }
}
```

### Enabling BEADS for a Project

```json
{
  "extensions": {
    "beads": {
      "enabled": true,
      "database_path": "/path/to/project/.beads/",
      "prefix": "proj"
    }
  }
}
```

### Adding a Bundle

```json
{
  "id": "my-bundle",
  "name": "My Project Group",
  "description": "Related projects for a workflow",
  "projects": ["project-a", "project-b"],
  "primary_project": "project-a"
}
```

---

## Validation

```bash
hop validate my-hop.json
```

---

## Version Compatibility

These examples are compatible with:
- **HarnessOps Schema**: 0.1.0
