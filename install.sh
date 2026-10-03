#!/bin/bash
# Installs claude-revive from this checkout.
# Links the helper into ~/.local/bin, so edits here take effect at once.
# Packages and installs the VS Code extension; reload the window afterwards.
# Run it from a VS Code terminal, so `code` installs into this host.
# The extension offers to add the Claude hooks on its first start.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p ~/.local/bin
ln -sfn "$PWD/bin/claude-revive" ~/.local/bin/claude-revive

mkdir -p dist
npx --yes @vscode/vsce package --out dist/claude-revive.vsix
code --install-extension dist/claude-revive.vsix --force

echo "Installed. Run 'Developer: Reload Window' in VS Code."
