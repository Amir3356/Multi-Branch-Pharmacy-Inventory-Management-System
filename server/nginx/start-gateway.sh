#!/usr/bin/env bash
# Starts Nginx API Gateway container for local development
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="local-api-gateway"

if docker ps -q -f name="^${CONTAINER_NAME}$" | grep -q .; then
    echo "Gateway container '${CONTAINER_NAME}' is already running."
    exit 0
fi

# Remove stopped container if exists
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

echo "Starting Nginx API Gateway on http://localhost:8000 ..."
docker run -d \
    --name "${CONTAINER_NAME}" \
    --network host \
    -v "${DIR}/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:alpine

echo "Nginx API Gateway is running on http://localhost:8000"
echo "To view logs: docker logs -f ${CONTAINER_NAME}"
echo "To stop:      docker stop ${CONTAINER_NAME}"
