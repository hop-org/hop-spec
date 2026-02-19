#!/usr/bin/env bash
# install.sh — Install hop CLI and hop-mcp to ~/.hop/bin/
# Run from repo root: bash scripts/install.sh
# Or via: bun run install-user

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOP_HOME="${HOP_HOME:-$HOME/.hop}"
HOP_BIN="$HOP_HOME/bin"
LOCAL_BIN="${LOCAL_BIN:-$HOME/.local/bin}"

CLI_BUNDLE="$REPO_DIR/packages/hop-cli/dist/hop-cli.bundle.js"
MCP_BUNDLE="$REPO_DIR/packages/hop-mcp/dist/hop-mcp.bundle.js"

# Verify bundles exist
for f in "$CLI_BUNDLE" "$MCP_BUNDLE"; do
  if [ ! -f "$f" ]; then
    echo "Error: Bundle not found: $f"
    echo "Run 'bun run bundle' first."
    exit 1
  fi
done

# Safety: this script NEVER touches hop.json or settings.json.
# It only installs CLI/MCP binaries into ~/.hop/bin/.
# To create or modify hop.json, use 'hop init' or edit it manually.

# Create directories
mkdir -p "$HOP_BIN" "$LOCAL_BIN"

# Copy bundles to ~/.hop/bin/ (only bin artifacts, never config)
cp "$CLI_BUNDLE" "$HOP_BIN/hop-cli.js"
cp "$MCP_BUNDLE" "$HOP_BIN/hop-mcp.js"

# Create ~/.local/bin/hop wrapper
cat > "$LOCAL_BIN/hop" << 'WRAPPER'
#!/usr/bin/env bash
exec node "$HOME/.hop/bin/hop-cli.js" "$@"
WRAPPER
chmod +x "$LOCAL_BIN/hop"

# Record installed version
COMMIT="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$HOP_BIN/version.json" << EOF
{
  "version": "0.1.0",
  "commit": "$COMMIT",
  "installed": "$DATE",
  "source": "$REPO_DIR"
}
EOF

echo "Installed hop CLI  → $LOCAL_BIN/hop"
echo "Installed hop-mcp  → $HOP_BIN/hop-mcp.js"
echo "Version: 0.1.0 ($COMMIT)"

# Guide first-time users; don't touch existing hop.json
if [ -f "$HOP_HOME/hop.json" ]; then
  echo ""
  echo "Using existing hop.json at $HOP_HOME/hop.json"
else
  echo ""
  echo "No hop.json found. Run 'hop init' to create one."
fi
