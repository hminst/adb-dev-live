#!/bin/bash

# Start DeepL Translation Proxy
# Usage: ./start.sh [API_KEY]
# The API key can also be provided via:
# - .env file (DEEPL_API_KEY=your_key)
# - Environment variable (DEEPL_API_KEY=your_key)

API_KEY="${1:-${DEEPL_API_KEY}}"

# If API key is provided as argument, pass it to node
# Otherwise, let server.js load it from .env or environment variable
if [ -n "$API_KEY" ]; then
  echo "Starting DeepL Translation Proxy on port 3001..."
  echo "API Key: ${API_KEY:0:10}..."
  echo ""
  node server.js "$API_KEY"
else
  echo "Starting DeepL Translation Proxy on port 3001..."
  echo "Loading API key from .env file or environment variable..."
  echo ""
  node server.js
fi

