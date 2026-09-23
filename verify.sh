#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
bend engine.bend
test_output_dir="$(mktemp -d)"
trap 'rm -rf "$test_output_dir"' EXIT
bend tests/index.html -o "$test_output_dir"
node "$test_output_dir"/chunk-*.js
