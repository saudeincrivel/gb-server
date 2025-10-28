#!/bin/bash

# Test script for Gb server Lambda function using SAM local invoke
set -e  # Exit on any error

echo "🧪 Testing GB Server Lambda function locally..."

# Check if the Docker image exists
if ! docker image inspect gb-server:latest >/dev/null 2>&1; then
    echo "❌ Docker image 'gb-server:latest' not found. Please run ./scripts/build.sh first."
    exit 1
fi

echo "✅ Docker image found. Running SAM local invoke..."

sam local invoke GBServerLambdaFunction \
  --event localEvent.json \
  --template template.yaml \
  --env-vars .env.json \
  --skip-pull-image

echo "✅ Test completed successfully!"