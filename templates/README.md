# HarnessOps Starter Templates

Copy one of these templates to start your `hop.json` configuration.

---

## Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| `minimal.hop.json` | Bare minimum to get started | Learning, testing |
| `local.hop.json` | Local development machine | Laptops, desktops, WSL |
| `cloud-ide.hop.json` | Cloud IDE environment | Gitpod, Codespaces, Cloud IDE |
| `vps.hop.json` | VPS or server | Production servers, CI/CD |

---

## Quick Start

```bash
# Copy template to your preferred location
cp templates/local.hop.json ~/.config/hop/hop.json

# Or to system location
sudo cp templates/local.hop.json /etc/hop/hop.json
```

Then edit the file to customize:
1. Replace `YOUR-MACHINE-ID` with a unique identifier
2. Replace `YOUR-USERNAME` with your GitHub username
3. Update paths to match your system
4. Add your projects

---

## Customization Guide

### Required Changes

Every template has these placeholders that MUST be replaced:

| Placeholder | Replace With | Example |
|-------------|--------------|---------|
| `YOUR-MACHINE-ID` | Unique machine slug | `dev-laptop`, `prod-vps` |
| `YOUR-MACHINE-NAME` | Human-readable name | `MacBook Pro`, `Digital Ocean VPS` |
| `YOUR-USERNAME` | GitHub username | `octocat` |
| `/path/to/...` | Actual filesystem paths | `/home/dev/projects/my-app` |

### Optional Customizations

- Add more projects to the `projects` array
- Add more GitHub accounts to `accounts.github`
- Create bundles to group related projects
- Configure AI CLI activity log harvesting

---

## Template Differences

### minimal.hop.json
- Only required fields
- No projects or accounts
- Use to understand the minimum viable HarnessOps

### local.hop.json
- Single GitHub account (SSH auth)
- One sample project with BEADS
- One bundle
- Basic CLI activity logging

### cloud-ide.hop.json
- GitHub CLI authentication (typical for cloud IDEs)
- Workspace-based paths (`/workspace/`)
- Branch checkout support
- UTC timezone

### vps.hop.json
- Deploy and admin accounts
- Infrastructure repo configuration
- Script paths for operations
- Comprehensive CLI logging with validation

---

## Validation

After customizing, validate your HarnessOps file:

```bash
# Install validator
npm install -g ajv-cli

# Validate against schema
ajv validate -s spec/hop-schema.json -d your-hop.json
```

---

## Need More Examples?

See `spec/examples/` for fully-populated example configurations that demonstrate all HarnessOps features.

---

*Templates version: HarnessOps Schema 0.1.0*
