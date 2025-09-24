#!/bin/bash

# OpenAPI v3 Comprehensive Sample Generation Script
# This script generates TypeScript client from the comprehensive OpenAPI v3 specification

set -e

echo "🚀 Generating TypeScript client from OpenAPI v3 Comprehensive specification"
echo "=========================================================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Input and output paths
SPEC_FILE="$SCRIPT_DIR/comprehensive-test-spec.yaml"
OUTPUT_DIR="$SCRIPT_DIR/generated"

echo "📄 Input spec: $SPEC_FILE"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# Check if spec file exists
if [ ! -f "$SPEC_FILE" ]; then
    echo "❌ Error: OpenAPI spec file not found: $SPEC_FILE"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Change to project root to run the CLI
cd "$PROJECT_ROOT"

# Run the generation command
echo "🔧 Running openapi-to-ts generate..."
npx openapi-to-ts generate "$SPEC_FILE" \
    --output "$OUTPUT_DIR" \
    --namespace "ComprehensiveAPI" \
    --axios-instance "comprehensiveApiClient" \
    --type-output "group-by-tag"

echo ""
echo "✅ Generation completed successfully!"
echo "📁 Generated files are in: $OUTPUT_DIR"
echo ""
echo "📋 Generated files:"
ls -la "$OUTPUT_DIR"
