#!/bin/bash

# Build script for Gb server Lambda function
# Assumes Docker is installed and running

set -e  # Exit on any error

# Define image name and tag
IMAGE_NAME="gb-server"
IMAGE_TAG="latest"
FULL_IMAGE_TAG="${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Docker image: ${FULL_IMAGE_TAG}"

# Build the Docker image
docker build -t "${FULL_IMAGE_TAG}" .

echo "✅ Successfully built Docker image: ${FULL_IMAGE_TAG}"
echo "You can now run 'sam local invoke' to test the function locally"
