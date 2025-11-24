#!/bin/bash

# Start DeepL Translation Proxy
# Usage: ./start.sh [API_KEY]

API_KEY="${1:-${DEEPL_API_KEY}}"

if [ -z "$API_KEY" ]; then
  echo "Error: DeepL API key not provided"
  echo ""
  echo "Usage:"
  echo "  ./start.sh YOUR_API_KEY"
  echo "  DEEPL_API_KEY=YOUR_KEY ./start.sh"
  echo ""
  echo "Get a free API key at: https://www.deepl.com/pro-api"
  exit 1
fi

echo "Starting DeepL Translation Proxy on port 3001..."
echo "API Key: ${API_KEY:0:10}..."
echo ""
node server.js "$API_KEY"

