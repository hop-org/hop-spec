# @harnessops/cli

Command-line tool for querying and managing `hop.json` configurations.

## Install

```bash
npm install -g @harnessops/cli
```

## Commands

### `hop init`

Create a new `hop.json` interactively. Detects machine type, OS, and architecture automatically.

```bash
hop init              # Interactive prompts
hop init -y           # Accept detected defaults
hop init -o ~/dev/hop.json  # Specify output path
```

### `hop validate [file]`

Validate a `hop.json` file against the HarnessOps JSON Schema (Draft 2020-12).

```bash
hop validate                    # Validate discovered hop.json
hop validate /path/to/hop.json  # Validate specific file
hop validate --schema custom-schema.json  # Use custom schema
```

### `hop projects`

List all projects registered in `hop.json`.

```bash
hop projects           # Table output
hop projects --json    # JSON output
hop projects -t tool   # Filter by type
```

### `hop path <name>`

Resolve a project's filesystem path by name. Useful in scripts:

```bash
cd $(hop path my-project)
```

### `hop machine`

Show machine identity and configuration.

```bash
hop machine         # Human-readable
hop machine --json  # JSON output
```

### `hop account [username]`

Show GitHub account details. Without a username, shows the default account.

```bash
hop account            # Default account
hop account work-user  # Specific account
hop account --json     # JSON output
```

### `hop discover [dir]`

Auto-scan a directory for projects by detecting git repos and build files.

```bash
hop discover              # Scan current directory
hop discover ~/dev        # Scan specific directory
hop discover --json       # Output as hop.json project entries
hop discover -d 5         # Scan 5 levels deep (default: 3)
```

### `hop where`

Print the path to the discovered `hop.json`.

```bash
hop where
```

## Configuration Discovery

The CLI finds `hop.json` using this resolution order:

1. `$HOP_CONFIG_PATH` environment variable
2. Walk up from current directory
3. `~/.config/hop/hop.json`
4. `/etc/hop/hop.json`

## Development

```bash
cd packages/hop-cli
bun install
bun run build    # Compile TypeScript
bun run dev      # Watch mode
bun test         # Run integration tests
```

## License

MIT
