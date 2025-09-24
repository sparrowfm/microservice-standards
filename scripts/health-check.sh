#!/bin/bash

# Health check script for your service
# Usage: ./health-check.sh [environment]

ENVIRONMENT=${1:-dev}
API_KEY=${API_KEY:-"your-api-key"}
BASE_URL=${BASE_URL:-"https://api-${ENVIRONMENT}.your-domain.com"}

echo "🔍 Running health check for $ENVIRONMENT environment..."

# Basic health check endpoint
echo "Checking health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health endpoint: OK"
else
    echo "❌ Health endpoint: FAILED (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

# API functionality test
echo "Testing API functionality..."
API_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/test" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"test": "health-check"}')

if [ $? -eq 0 ]; then
    echo "✅ API functionality: OK"
else
    echo "❌ API functionality: FAILED"
    exit 1
fi

echo "🎉 All health checks passed for $ENVIRONMENT!"
exit 0