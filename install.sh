#!/bin/bash
# Installation script for SystemPulse

set -e

EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/system-pulse@mengweili02.github.com"

echo "Installing SystemPulse extension..."

# Create extension directory
mkdir -p "$EXTENSION_DIR"

# Copy extension files
cp metadata.json "$EXTENSION_DIR/"
cp extension.js "$EXTENSION_DIR/"
cp prefs.js "$EXTENSION_DIR/"
cp org.gnome.shell.extensions.system-all-in-one.gschema.xml "$EXTENSION_DIR/"

echo "Extension installed to: $EXTENSION_DIR"
echo ""
echo "Please restart GNOME Shell:"
echo "  - On X11: Press Alt+F2, type 'r', press Enter"
echo "  - On Wayland: Log out and back in"
echo ""
echo "Then enable the extension via Extensions app"
