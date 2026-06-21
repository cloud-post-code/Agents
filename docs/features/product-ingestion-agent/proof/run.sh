#!/usr/bin/env bash
set -euo pipefail

cd /Users/christophermauri/Auto_Business/artisan-platform/backend

# Ensure venv exists
if [[ ! -f .venv/bin/python ]]; then
    echo "ERROR: Virtual environment not found at .venv/"
    echo "Run: ~/.zeroclaw/scripts/ensure_venv"
    exit 1
fi

# Run the proof tests
.venv/bin/python -m pytest \
    /Users/christophermauri/Auto_Business/artisan-platform/docs/features/product-ingestion-agent/proof/tests/ \
    -v \
    --tb=short

echo ""
echo "✓ Product Ingestion Agent proof tests complete"
