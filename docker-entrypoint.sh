#!/bin/sh
# Prepares the upload volume, then drops root and runs the command.
# The volume is mounted at /data and arrives owned by root and empty on first
# boot (ADR-005). The release machine has no volume, so there this only creates
# plain directories in the container and does no harm.
set -eu

UPLOAD_DIR="${UPLOAD_DIR:-/data}"
mkdir -p "$UPLOAD_DIR/media" "$UPLOAD_DIR/proofs"
chown -R node:node "$UPLOAD_DIR"

exec su-exec node "$@"
